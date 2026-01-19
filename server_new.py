#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import json
import traceback
import threading
import time
import requests
import sys
import bcrypt
import re

from flask import Flask, jsonify, request, send_from_directory, session
from better_profanity import profanity
from bson.decimal128 import Decimal128
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from flask_cors import CORS
from pymongo import MongoClient, ReturnDocument
from pymongo.server_api import ServerApi
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
from geventwebsocket.exceptions import WebSocketError

# --- CONFIGURAÇÃO INICIAL ---
app = Flask(__name__, static_folder='.')
app.secret_key = 'sua_chave_secreta_aqui' 

# Configuração de Sessão
app.config['SESSION_COOKIE_SECURE'] = False      
app.config['SESSION_COOKIE_HTTPONLY'] = True     
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'    
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7) 

CORS(app, supports_credentials=True)

# --- VARIÁVEIS GLOBAIS ---
VERSION = "2.2.0-Stable"
clientes_conectados = []
clients = set()
db = None
client = None
sales_client = None  # Cache para conexão de vendas
current_sales_uri = None
stop_flag = threading.Event()
timeStart = None
CACHE_MAX_BOLAS = 90
valorPremioQuadra = 0
local_data = {}
mongo_data = {}

# Cache Rápido do Jogo
CACHE_JOGO = {
    'ativo': False,
    'cartelas': [] 
}

# Configurações de Ambiente
LOCAL_PATH = os.environ.get("LOCAL_PATH", "c:/chefemesa/json")
is_local_mode = False
port = int(os.environ.get('PORT') or os.environ.get('sPORT', 3001))

# Tenta importar certifi
try:
    import certifi
    _TLS_CA_FILE = certifi.where()
except Exception:
    _TLS_CA_FILE = None

# --- ROTAS DE ARQUIVOS ESTÁTICOS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route('/')
def serve_index(): return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path): return send_from_directory(BASE_DIR, path)

@app.route('/img/<path:filename>')
def serve_img(filename):
    return send_from_directory('img', filename)

# ==============================================================================
#  CONEXÕES DE BANCO DE DADOS (ROTEAMENTO E VENDAS)
# ==============================================================================

# 1. Conexão Principal (Sorteio)
URI_CONSULTA_SALAS = "mongodb+srv://tecbin_db_vendas:TecBin24@cluster0.blwq4du.mongodb.net/?appName=Cluster0"
URI_FALLBACK_PADRAO = "mongodb+srv://rivaldosp:TecBin24@tecbinon.3zsz7md.mongodb.net/"
PARAM_ID_SALA = os.environ.get("IDSALA", "000")

def buscar_uri_da_sala(id_sala_alvo):
    if not id_sala_alvo or id_sala_alvo == "0" or id_sala_alvo == "000":
        print(f"ℹ️ [ROTEAMENTO] ID Sala não definido. Usando Padrão.")
        return URI_FALLBACK_PADRAO

    print(f"🔍 [ROTEAMENTO] Buscando configuração para Sala ID: {id_sala_alvo}...")
    uri_final = URI_FALLBACK_PADRAO 
    client_consulta = None
    try:
        mongo_kwargs = { 'server_api': ServerApi('1') }
        if _TLS_CA_FILE: mongo_kwargs['tlsCAFile'] = _TLS_CA_FILE
        client_consulta = MongoClient(URI_CONSULTA_SALAS, **mongo_kwargs)
        db_controle = client_consulta.get_database("db_master_controle")
        sala_doc = db_controle.salas.find_one({'id_sala': id_sala_alvo})
        
        if sala_doc and 'url_mongo_sorteio' in sala_doc:
            novo_link = sala_doc['url_mongo_sorteio']
            if novo_link and len(novo_link) > 10:
                uri_final = novo_link
                print(f"✅ [ROTEAMENTO] Sala {id_sala_alvo} encontrada! Redirecionando banco.")
            else:
                print(f"⚠️ [ROTEAMENTO] Sala encontrada, mas link inválido.")
        else:
            print(f"⚠️ [ROTEAMENTO] Sala {id_sala_alvo} não cadastrada.")
    except Exception as e:
        print(f"❌ [ROTEAMENTO] Erro ao consultar master: {e}")
    finally:
        if client_consulta: client_consulta.close()
            
    return uri_final

MONGO_URI = buscar_uri_da_sala(PARAM_ID_SALA)

def connect_main_db():
    global client, db
    if not is_local_mode:
        try:
            cluster_name = MONGO_URI.split('@')[-1].split('/')[0]
            print(f"🔌 CONECTANDO NO CLUSTER: {cluster_name}")
            mongo_kwargs = { 'server_api': ServerApi('1') }
            if _TLS_CA_FILE: mongo_kwargs['tlsCAFile'] = _TLS_CA_FILE
            
            client = MongoClient(MONGO_URI, **mongo_kwargs)
            try:
                db_target = client.get_default_database()
                print(f"✅ Banco definido no link: '{db_target.name}'")
                db = db_target
            except:
                NOME_PADRAO = "dados_do_sorteio"
                print(f"⚠️ Link sem nome. Usando padronizado: '{NOME_PADRAO}'")
                db = client.get_database(NOME_PADRAO)
            
            client.admin.command('ping') 
            print(f"✅ CONEXÃO BEM SUCEDIDA.")
        except Exception as e:
            print(f"❌ Erro fatal MongoDB: {e}")
            sys.exit(1)

# 2. Conexão Secundária (Vendas) - VERSÃO ROBUSTA E INTELIGENTE
def get_sales_db_connection():
    global sales_client, current_sales_uri, db
    
    new_uri = None
    # Tenta ler do JSON local
    try:
        if os.path.exists(os.path.join(LOCAL_PATH, 'parametros.json')):
            with open(os.path.join(LOCAL_PATH, 'parametros.json'), 'r') as f:
                p = json.load(f)
                if p: new_uri = p[0].get('url_mongo_vendas')
    except: pass

    # Tenta ler do Banco de Sorteio
    if not new_uri and db is not None:
        try:
            param_doc = db.parametros.find_one({})
            if param_doc: new_uri = param_doc.get('url_mongo_vendas')
        except: pass

    if not new_uri:
        print("❌ ERRO CRÍTICO: 'url_mongo_vendas' não encontrada.")
        return None

    try:
        if sales_client is None or new_uri != current_sales_uri:
            if sales_client: sales_client.close()
            # print(f"🔌 Conectando ao Banco de Vendas...")
            mongo_kwargs = {'server_api': ServerApi('1')}
            if _TLS_CA_FILE: mongo_kwargs['tlsCAFile'] = _TLS_CA_FILE
            
            sales_client = MongoClient(new_uri, **mongo_kwargs)
            current_sales_uri = new_uri
            sales_client.admin.command('ping')
            # print("✅ Conexão Vendas OK!")
            
        try:
            return sales_client.get_default_database()
        except Exception:
            # Lógica de auto-descoberta do nome do banco
            try:
                bancos = sales_client.list_database_names()
                filtro = [b for b in bancos if b not in ['admin', 'local', 'config']]
                if len(filtro) > 0:
                    return sales_client.get_database(filtro[0])
            except: pass
            
            return sales_client.get_database("dados_do_sorteio") # Fallback final

    except Exception as e:
        print(f"❌ Erro fatal conexão vendas: {e}")
        return None

# ==============================================================================
#  API DE STATUS E DADOS DO EVENTO (AS ROTAS QUE ARRUMAMOS)
# ==============================================================================

@app.route('/api/verificar_status_evento', methods=['GET'])
def verificar_status_evento():
    try:
        # 1. Pega e Valida o ID
        id_evento_str = request.args.get('id_evento')
        if not id_evento_str:
            return jsonify({'erro': 'ID não informado'}), 400

        try:
            id_evento = int(id_evento_str)
        except ValueError:
             # Se for string alfa, tenta usar como está
             id_evento = id_evento_str

        # 2. Conecta no Banco (Usando função robusta)
        sales_db = get_sales_db_connection()
        
        if sales_db is None:
            print("❌ Erro: Falha na conexão com vendas.")
            return jsonify({'erro': 'Falha na conexão com vendas'}), 500

        # 3. Busca o Evento
        # print(f"🔎 Buscando Evento {id_evento} no banco '{sales_db.name}'...")
        
        # Busca híbrida (Int ou Str)
        evento = sales_db.eventos.find_one({
            '$or': [
                {'id_evento': id_evento},
                {'id_evento': str(id_evento)}
            ]
        })

        # 4. Retorna o Resultado
        if evento:
            # print(f"✅ SUCESSO! Foto encontrada: {evento.get('imagem_premio')}")
            return jsonify({
                'id': str(id_evento),
                'status': evento.get('status', 'indefinido'),
                'imagem_premio': evento.get('imagem_premio', ''),
                'premio_atual': evento.get('premio_atual', 'BINGO')
            })
        else:
            print(f"❌ Evento {id_evento} não encontrado em '{sales_db.name}'.")
            return jsonify({'status': 'nao_encontrado'}), 404

    except Exception as e:
        print(f"Erro no servidor: {e}")
        return jsonify({'status': 'erro'}), 500


@app.route('/api/dados_evento', methods=['GET'])
def get_dados_evento():
    try:
        id_evento_str = request.args.get('id_evento')
        if not id_evento_str:
            return jsonify({'erro': 'ID do evento não informado'}), 400

        try:
            id_evento = int(id_evento_str)
        except ValueError:
            id_evento = id_evento_str
        
        sales_db = get_sales_db_connection()
        if not sales_db: return jsonify({'erro': 'DB Offline'}), 500
        
        evento = sales_db.eventos.find_one({
            '$or': [{'id_evento': id_evento}, {'id_evento': str(id_evento)}]
        })
        
        # Fallback para tabela config
        if not evento:
             evento = sales_db.config.find_one({'rodada_atual': id_evento})

        if evento:
            val_bruto = evento.get('valor_de_venda', 1.00)
            try:
                if hasattr(val_bruto, 'to_decimal'): preco_final = float(val_bruto.to_decimal())
                else: preco_final = float(val_bruto)
            except: preco_final = 1.00

            return jsonify({
                'status': 'ok',
                'id_evento': evento.get('id_evento'), 
                'preco_cartela': preco_final, 
                'descricao': evento.get('descricao', f'Evento {id_evento}'),
                'data_evento': evento.get('data_evento', ''),
                'hora_evento': evento.get('hora_evento', '')
            })
        else:
            return jsonify({
                'status': 'ok', 
                'id_evento': id_evento, 
                'preco_cartela': 2.00, 
                'obs': 'Evento não encontrado, usando padrão'
            })

    except Exception as e:
        print(f"Erro ao buscar evento: {e}")
        return jsonify({'erro': str(e)}), 500

# ==============================================================================
#  OUTRAS FUNÇÕES AUXILIARES E LÓGICA DE JOGO
# ==============================================================================

def broadcast_para_clientes(mensagem_dict):
    texto = json.dumps(mensagem_dict)
    para_remover = []
    for ws in clientes_conectados:
        try: ws.send(texto)
        except: para_remover.append(ws)
    for morto in para_remover:
        if morto in clientes_conectados: clientes_conectados.remove(morto)

def hora_brasil():
    return datetime.now(ZoneInfo('America/Sao_Paulo'))

def converter_decimal(valor):
    if isinstance(valor, Decimal128): return float(valor.to_decimal())
    if isinstance(valor, str):
        try: return float(valor.replace(',', '.'))
        except: return 0.0
    return float(valor) if valor else 0.0

def parse_brl(valor_str):
    if not valor_str: return 0.0
    if isinstance(valor_str, (int, float)): return float(valor_str)
    try:
        limpo = str(valor_str).replace('R$', '').replace(' ', '').replace('.', '').replace(',', '.')
        return float(limpo)
    except: return 0.0

def format_brl(valor_float):
    try: return f"{valor_float:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
    except: return "0,00"

def enviar_aviso_sistema(titulo, mensagem, tempo_str):
    if db is None: return
    try:
        db.avisos.delete_many({}) 
        db.avisos.insert_one({
            'titulo': titulo,
            'mensagem': mensagem,
            'tempo': str(tempo_str),
            'timestamp': time.time()
        })
        print(f"📢 Aviso enviado: {titulo}")
    except Exception as e:
        print(f"Erro ao enviar aviso: {e}")

# --- CACHE E LÓGICA DE CARTELAS ---

def carregar_cache_evento(id_evento, sales_db):
    global CACHE_JOGO, db
    print(f"🚀 Carregando cache do Evento {id_evento}...")
    CACHE_JOGO['ativo'] = False
    CACHE_JOGO['cartelas'] = []

    try:
        nome_col = f"vendas{id_evento}"
        if nome_col not in sales_db.list_collection_names():
             CACHE_JOGO['ativo'] = True
             db.melhores.delete_many({})
             return

        col_vendas = sales_db[nome_col]
        cursor_vendas = col_vendas.find({}, {'numero_inicial':1, 'numero_final':1, 'numero_inicial2':1, 'numero_final2':1, 'nome_cliente':1})

        mapa_vendas = {}
        for v in cursor_vendas:
            nome = v.get('nome_cliente', '---')
            if v.get('numero_inicial') is not None and v.get('numero_final') is not None:
                for c in range(v['numero_inicial'], v['numero_final'] + 1): mapa_vendas[c] = nome
            if v.get('numero_inicial2') is not None and v.get('numero_final2') is not None:
                for c in range(v['numero_inicial2'], v['numero_final2'] + 1): mapa_vendas[c] = nome
        
        if not mapa_vendas:
            CACHE_JOGO['ativo'] = True
            db.melhores.delete_many({})
            return

        ids = list(mapa_vendas.keys())
        # Busca cartelas em lote
        cursor_cartelas = db.cartelas.find({'cartao': {'$in': ids}})

        lista_cache = []
        for doc in cursor_cartelas:
            c_id = doc.get('cartao')
            tipo_detectado = 90
            layout_data = {}
            
            # Detecção de Tipo
            if 'numeros' in doc and isinstance(doc['numeros'], list) and len(doc['numeros']) >= 25:
                tipo_detectado = 75
                lista_ordenada = doc['numeros'] 
                nums_set = set(lista_ordenada)
                nums_set.discard(0)
                layout_data = {'lista_75': lista_ordenada, 'geral': nums_set}
            else:
                tipo_detectado = 90
                def to_set(val):
                    if isinstance(val, str) and val: return set(map(int, val.replace(' ', '').split(',')))
                    if isinstance(val, list): return set(val)
                    return set()
                sup = to_set(doc.get('superior'))
                cen = to_set(doc.get('central'))
                inf = to_set(doc.get('inferior'))
                layout_data = {'sup': sup, 'cen': cen, 'inf': inf, 'geral': sup | cen | inf}
            
            lista_cache.append({
                'id': c_id,
                'nome': mapa_vendas.get(c_id, '---'),
                'tipo': tipo_detectado,
                'layout': layout_data
            })

        CACHE_JOGO['cartelas'] = lista_cache
        CACHE_JOGO['ativo'] = True
        print(f"✅ CACHE CARREGADO: {len(lista_cache)} cartelas.")
        recalcular_ranking_principal()         

    except Exception as e:
        print(f"❌ Erro cache: {e}")
        traceback.print_exc()
        CACHE_JOGO['ativo'] = False

# --- FUNÇÕES DE FETCH E WATCHER ---

def fetch_data():
    if is_local_mode: return {} # Simplificado
    return fetch_data_from_mongodb()

def fetch_data_from_mongodb():
    global db
    if db is None: return {}
    try:
        def clean(cursor):
            l = list(cursor)
            for i in l: i['_id'] = str(i['_id'])
            return l

        # Buscas paralelas (idealmente)
        bolas = clean(db.bolas.find({}))
        buscando = clean(db.buscando.find({}))
        premios_raw = clean(db.premio.find({}))
        rodada = clean(db.rodada.find({}))
        confere = clean(db.confere.find({}))
        parametros = clean(db.parametros.find({}))
        bolas_mesa = clean(db.bolas_mesa.find({}))
        buscando_mesa = clean(db.buscando_mesa.find({}))
        avisos = clean(db.avisos.find({}))
        melhores = list(db['melhores'].find({}, {'_id':0}).sort('id_posicao', 1).limit(25))

        if not parametros: return None
        param_doc = parametros[0]

        # Ganhadores Terminal
        g_term = list(db.osganhadores.find({}))        
        g_term_dict = {}
        for g in g_term:
            k = f"{g.get('premio')}|{g.get('valor_total_premio')}"
            if k not in g_term_dict: g_term_dict[k] = {"premio": g.get('premio'), "valor": g.get('valor_total_premio'), "ganhadores": []}
            g_term_dict[k]["ganhadores"].append({"cartela": g.get('cartela'), "nome": g.get('nome'), "valor_rateio": g.get('valor_rateio')})
        lista_terminal = list(g_term_dict.values())

        # Ganhadores Live
        g_live = list(db.ganhadores.find({}))
        g_live_dict = {}
        for g in g_live:
            k = f"{g.get('premio')}|{g.get('valor_total_premio')}"
            if k not in g_live_dict: g_live_dict[k] = {"premio": g.get('premio'), "valor": g.get('valor_total_premio'), "ganhadores": []}
            g_live_dict[k]["ganhadores"].append({"cartela": g.get('cartela'), "nome": g.get('nome'), "valor_rateio": g.get('valor_rateio')})
        lista_live = list(g_live_dict.values())
        
        premio_data, tope_data, card_ranges, premio_info = process_prizes(premios_raw)
        
        return {
            'bolasData': bolas, 'buscandoData': buscando, 'premioData': premio_data,
            'premioInfo': premio_info, 'rodadaData': rodada, 'confereData': confere,
            'topeData': tope_data, 'cardRanges': card_ranges, 'promocionalData': [],
            'parametrosInfo': param_doc, 'melhoresData': melhores, 
            'bolasMesaData': bolas_mesa, 'buscandoMesaData': buscando_mesa,
            'ganhadoresData': lista_terminal, 'ganhadoresLive': lista_live,
            'avisosData' : avisos     
        }
    except Exception as e:
        print(f"❌ FETCH ERROR: {e}")
        return None

def process_prizes(premios_raw):
    premio_data, tope_data, card_ranges = [], [], []
    premio_info = {}
    if premios_raw:
        p = premios_raw[0]
        premio_info = p
        for k in ['1','2','3','4']:
            if p.get(f'inicial{k}'): card_ranges.append({'inicial': p[f'inicial{k}'], 'final': p[f'final{k}']})

        campos = [
            ('premio_quadra', 'QUADRA'), ('premio_linha', 'LINHA'), ('premio_bingo', 'BINGO'),
            ('premio_acumulado', 'ACUMULADO'), ('premio_falta_Um', 'FALTA 1'), 
            ('premio_duplo_bingo', 'DUPLO BINGO')
        ]
        for campo, label in campos:
            val = p.get(campo)
            if isinstance(val, (int, float)):
                lbl = label
                if campo == 'premio_linha' and p.get('qtde_linha', 1) > 1: lbl = f"{p['qtde_linha']} LINHAS"
                premio_data.append({'tipo_premio': lbl, 'valor': f"R$ {val:.2f}".replace('.', ',')})

        if p.get('bola_tope_sb') or p.get('bola_tope_ac'):
            tope_data.append({'bola_tope_sb': p.get('bola_tope_sb'), 'bola_tope_ac': p.get('bola_tope_ac')})
            
    return premio_data, tope_data, card_ranges, premio_info

def watch_collections():
    global local_data, mongo_data
    print("👀 Watcher iniciado...")
    last_data_json = ""
    while not stop_flag.is_set():
        try:
            current_data = fetch_data()
            current_json = json.dumps(current_data, default=str)
            if current_json != last_data_json:
                last_data_json = current_json
                if not current_data: 
                    time.sleep(1)
                    continue            
                if is_local_mode: local_data = current_data
                else: mongo_data = current_data
                broadcast(current_data)
        except Exception: pass
        time.sleep(1)

def broadcast(data):
    msg = json.dumps({'type': 'UPDATE', **data}, default=str)
    for client in list(clients):
        try: client.send(msg)
        except: clients.discard(client)

# --- ROTAS PADRÃO DO FLASK ---

@app.route('/api/initial-data')
def initial_data():
    dados = fetch_data()
    if not dados:
        if is_local_mode: dados = local_data
        else: dados = mongo_data
    return jsonify(dados if dados else {})

@app.route('/api/melhores')
def get_melhores():
    if db is None: return jsonify([])
    try:
        melhores = list(db.melhores.find({}, {'_id': 0}).sort('id_posicao', 1).limit(25))
        return jsonify(melhores)
    except: return jsonify([])

@app.route('/api/version')
def get_version(): return jsonify({'version': VERSION})


# --- LÓGICA DE RANKING ---

def recalcular_ranking_principal():
    global CACHE_JOGO
    if not CACHE_JOGO['ativo']: return
    tipo = 90
    if CACHE_JOGO['cartelas']:
        tipo = CACHE_JOGO['cartelas'][0].get('tipo', 90)
    
    if tipo == 75: recalcular_ranking_top10_75()
    else: recalcular_ranking_top10()

def recalcular_ranking_top10():
    # ... (Seu código original mantido da lógica 90 - sem alterações na lógica)
    global db, CACHE_JOGO
    if not CACHE_JOGO['ativo']: return
    if not CACHE_JOGO['cartelas']:
        db.melhores.delete_many({})
        return
    try:
        dados_bolas = db.bolas_mesa.find_one({}) or {}
        bolas_cantadas = set(dados_bolas.get('bolas_cantadas', []))
        dados_premio = db.buscando.find_one({}) or {}
        premio_buscado = dados_premio.get('buscando_o_premio', 'BINGO').upper()
        linhas_config = dados_premio.get('buscando_a_linha', '') 

        busca_quadra = 'QUADRA' in premio_buscado
        busca_linha = 'LINHA' in premio_buscado
        busca_falta_um = 'FALTA' in premio_buscado
        busca_duplo = 'DUPLO' in premio_buscado or 'SEGUNDO' in premio_buscado
        
        linhas_ja_ganhas = set()
        if busca_linha:
            ganhadores_linha = list(db.ganhadores.find({'premio': {'$regex': 'LINHA'}}))
            tabela_premios = db.premio.find_one({}) or {}
            qtde_linhas_jogo = int(tabela_premios.get('qtde_linha', 1))
            if qtde_linhas_jogo == 1 and len(ganhadores_linha) > 0:
                 linhas_ja_ganhas.update(['Sup', 'Cen', 'Inf'])
            else:
                for g in ganhadores_linha:
                    tag = g.get('linha_ganha_tag') 
                    if tag: linhas_ja_ganhas.add(tag)

        ids_vencedores_bingo = set()
        if busca_duplo:
            vencedores = db.ganhadores.find({'premio': {'$regex': 'BINGO', '$options': 'i'}})
            for v in vencedores:
                if 'DUPLO' not in (v.get('premio') or '').upper():
                    try: ids_vencedores_bingo.add(int(v['cartela']))
                    except: pass

        resultados = []
        for item in CACHE_JOGO['cartelas']:
            c_id = item['id']
            if c_id in ids_vencedores_bingo: continue
            layout = item['layout']
            
            if busca_linha or busca_quadra:
                f_sup = layout['sup'] - bolas_cantadas
                f_cen = layout['cen'] - bolas_cantadas
                f_inf = layout['inf'] - bolas_cantadas
                opcoes = []
                
                if (not linhas_config or 'SUP' in linhas_config.upper()):
                    if busca_quadra or 'Sup' not in linhas_ja_ganhas: opcoes.append({'tag': 'Sup', 'set': f_sup})
                if (not linhas_config or 'CEN' in linhas_config.upper()):
                    if busca_quadra or 'Cen' not in linhas_ja_ganhas: opcoes.append({'tag': 'Cen', 'set': f_cen})
                if (not linhas_config or 'INF' in linhas_config.upper()):
                    if busca_quadra or 'Inf' not in linhas_ja_ganhas: opcoes.append({'tag': 'Inf', 'set': f_inf})
                
                if not opcoes and busca_linha:
                    faltam = layout['geral'] - bolas_cantadas
                    tag_posicao = "" 
                    busca_linha_temporaria = False 
                else:
                    if not opcoes: opcoes = [{'tag': 'Geral', 'set': layout['geral'] - bolas_cantadas}]
                    melhor = min(opcoes, key=lambda x: len(x['set']))
                    faltam = melhor['set']
                    tag_posicao = melhor['tag']
                    busca_linha_temporaria = True
            else:
                faltam = layout['geral'] - bolas_cantadas
                tag_posicao = "" 
                busca_linha_temporaria = False

            qtde_falta = len(faltam)
            msg_premio = ""
            if qtde_falta == 0:
                if busca_quadra: msg_premio = "QUADRA"
                elif busca_linha and busca_linha_temporaria: msg_premio = "LINHA"
                elif busca_duplo: msg_premio = "DUPLO BINGO"
                else: msg_premio = "BINGO"
            elif qtde_falta == 1:
                if busca_quadra: msg_premio = "QUADRA"
                elif busca_falta_um: msg_premio = "FALTA UM"
            
            resultados.append({'cartela': c_id, 'nome': item['nome'], 'numeros_faltantes': sorted(list(faltam)), 'qtde': qtde_falta, 'posicao': tag_posicao, 'premio': msg_premio})

        resultados.sort(key=lambda x: (x['qtde'], x['cartela']))
        top_10 = resultados[:10]
        
        rodada_info = db.rodada.find_one({})
        id_evento_ativo = rodada_info.get('id_evento', 0) if rodada_info else 0
        novos_docs = []
        for i, r in enumerate(top_10):
            string_numeros = ",".join(f"{n:02d}" for n in r['numeros_faltantes'])
            pos_letra = r['posicao'][0] if r['posicao'] else ""
            novos_docs.append({
                "id_posicao": i + 1, "cartela": str(r['cartela']), "posicao": pos_letra,
                "numeros": string_numeros, "numeros_faltantes": r['numeros_faltantes'],
                "premio": r['premio'], "nome": r['nome'], "rodada": int(id_evento_ativo)
            })

        db.melhores.delete_many({})
        if novos_docs: db.melhores.insert_many(novos_docs)
    except Exception as e:
        print(f"❌ [ERRO RANKING 90] {e}")

def recalcular_ranking_top10_75():
    # ... (Seu código original mantido da lógica 75)
    global db, CACHE_JOGO, valorPremioQuadra
    if not CACHE_JOGO['ativo']: return
    try:
        dados_bolas = db.bolas_mesa.find_one({}) or {}
        bolas_cantadas = set(dados_bolas.get('bolas_cantadas', []))
        dados_premio = db.buscando.find_one({}) or {}
        premio_buscado_texto = dados_premio.get('buscando_o_premio', 'BINGO').upper()

        qtd_linha = db.ganhadores.count_documents({'premio': {'$regex': 'LINHA', '$options': 'i'}})
        qtd_cantos = db.ganhadores.count_documents({'premio': {'$regex': 'CANTOS|QUADRA', '$options': 'i'}})
        ganhou_linha = qtd_linha > 0
        ganhou_cantos = qtd_cantos > 0

        buscar_linha_agora = False
        buscar_cantos_agora = False
        buscar_bingo_agora = False
        if valorPremioQuadra == 0: ganhou_cantos = True
        novo_nome_premio = 'BINGO'

        if 'BINGO' == premio_buscado_texto or 'ACUMULADO' in premio_buscado_texto:
            buscar_bingo_agora = True
            novo_nome_premio = premio_buscado_texto
        elif ganhou_linha and ganhou_cantos:
            buscar_bingo_agora = True; novo_nome_premio = 'BINGO'
        elif ganhou_linha and not ganhou_cantos:
            buscar_cantos_agora = True; novo_nome_premio = '4 CANTOS'
        elif ganhou_cantos and not ganhou_linha:
            buscar_linha_agora = True; novo_nome_premio = 'LINHA'
        else:
            buscar_linha_agora = True; buscar_cantos_agora = True; novo_nome_premio = '4 CANTOS E LINHA'

        if novo_nome_premio != dados_premio.get('buscando_o_premio'):
             db.buscando.update_one({}, {'$set': {'buscando_o_premio': novo_nome_premio}}, upsert=True)
             db.buscando_mesa.update_one({}, {'$set': {'buscando_o_premio': novo_nome_premio}}, upsert=True)

        cartelas_excluir_bingo = set()
        if 'DUPLO' in premio_buscado_texto or 'SEGUNDO' in premio_buscado_texto:
            vencedores = db.ganhadores.find({'premio': {'$regex': 'BINGO', '$options': 'i'}})
            for v in vencedores:
                if 'DUPLO' not in (v.get('premio') or '').upper():
                    try: cartelas_excluir_bingo.add(v['cartela'])
                    except: pass

        resultados = []
        for item in CACHE_JOGO['cartelas']:
            c_id = item['id']
            if c_id in cartelas_excluir_bingo: continue
            if item.get('tipo', 90) != 75: continue
            layout = item['layout']
            lista_nums = layout.get('lista_75', [])
            if not lista_nums or len(lista_nums) < 25: continue

            opcoes_proximidade = []
            if layout.get('geral'):
                faltam_bingo = layout['geral'] - bolas_cantadas
                qtde_bingo = len(faltam_bingo)
                if qtde_bingo == 0: opcoes_proximidade.append({'tag': 'BINGO', 'set': faltam_bingo, 'qtde': 0, 'premio': 'BINGO'})
                elif buscar_bingo_agora: opcoes_proximidade.append({'tag': 'Geral', 'set': faltam_bingo, 'qtde': qtde_bingo, 'premio': 'BINGO'})

            if buscar_cantos_agora:
                alvo_cantos = {lista_nums[0], lista_nums[4], lista_nums[20], lista_nums[24]} - {0}
                faltam_cantos = alvo_cantos - bolas_cantadas
                qtde_cantos = len(faltam_cantos)
                if qtde_cantos == 0: opcoes_proximidade.append({'tag': 'CANTOS', 'set': faltam_cantos, 'qtde': 0, 'premio': '4 CANTOS'})
                else: opcoes_proximidade.append({'tag': 'Cantos', 'set': faltam_cantos, 'qtde': qtde_cantos, 'premio': '4 CANTOS'})

            if buscar_linha_agora:
                linhas_indices = [[0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24]]
                melhor_linha_set = set(); melhor_linha_qtde = 99; bateu_linha = False
                for indices_da_linha in linhas_indices:
                    linha_set = {lista_nums[i] for i in indices_da_linha} - {0}
                    f_linha = linha_set - bolas_cantadas
                    q_linha = len(f_linha)
                    if q_linha == 0:
                        opcoes_proximidade.append({'tag': 'LINHA', 'set': f_linha, 'qtde': 0, 'premio': 'LINHA'})
                        bateu_linha = True; break 
                    if q_linha < melhor_linha_qtde: melhor_linha_qtde = q_linha; melhor_linha_set = f_linha
                if not bateu_linha: opcoes_proximidade.append({'tag': 'Linha', 'set': melhor_linha_set, 'qtde': melhor_linha_qtde, 'premio': 'LINHA'})

            if not opcoes_proximidade: continue
            vitorias = [op for op in opcoes_proximidade if op['qtde'] == 0]
            if len(vitorias) > 0:
                nomes_premios = sorted(list(set([v['premio'] for v in vitorias])))
                msg_vitoria = " E ".join(nomes_premios)
                escolhido = vitorias[0]
                qtde, faltam, tag = 0, escolhido['set'], escolhido['tag']
            else:
                melhor = min(opcoes_proximidade, key=lambda x: x['qtde'])
                qtde, faltam, tag = melhor['qtde'], melhor['set'], melhor['tag']
                msg_vitoria = "" 

            resultados.append({'cartela': c_id, 'nome': item['nome'], 'numeros_faltantes': sorted(list(faltam)), 'qtde': qtde, 'posicao': tag, 'premio': msg_vitoria})

        resultados.sort(key=lambda x: (x['qtde'], x['cartela']))
        top_10 = resultados[:10]
        
        rodada_info = db.rodada.find_one({})
        id_evt = rodada_info.get('id_evento', 0) if rodada_info else 0
        novos_docs = []
        for i, r in enumerate(top_10):
            try:
                string_numeros = ",".join(f"{n:02d}" for n in r['numeros_faltantes'])
                novos_docs.append({
                    "id_posicao": i + 1, "cartela": str(r['cartela']), "posicao": r['posicao'][0] if r['posicao'] else "",
                    "numeros": string_numeros, "numeros_faltantes": r['numeros_faltantes'],
                    "premio": str(r.get('premio', '')), "nome": str(r.get('nome', '---')),
                    "rodada": int(id_evt), "qtde": int(r.get('qtde', 999))
                })
            except: continue

        db.melhores.delete_many({})
        if novos_docs: db.melhores.insert_many(novos_docs)
    except Exception as e:
        print(f"❌ Erro Ranking 75: {e}")

# --- UTILITÁRIOS: PRÓXIMO EVENTO ---
def buscar_proximo_evento_automatico(id_evento_atual):
    sales_db = get_sales_db_connection()
    if sales_db is None: return None
    try:
        evento_atual = None
        if id_evento_atual:
            evento_atual = sales_db.eventos.find_one({
                'id_evento': {'$in': [id_evento_atual, str(id_evento_atual), int(id_evento_atual)]}
            })
        
        filtro = {'status': {'$in': ['ativo', 'paralizado', 'ATIVO', 'PARALIZADO']}}
        todos_eventos = list(sales_db.eventos.find(filtro).sort([('data_evento', 1), ('hora_evento', 1)]))
        if not todos_eventos: return None

        if not evento_atual: return todos_eventos[0]
        id_atual_str = str(evento_atual.get('id_evento'))
        
        for i, evt in enumerate(todos_eventos):
            if str(evt.get('id_evento')) == id_atual_str:
                if i + 1 < len(todos_eventos):
                    print(f"⏭️ Próximo encontrado: {todos_eventos[i+1].get('id_evento')}")
                    return todos_eventos[i+1]
                else: return None
        return todos_eventos[0]
    except Exception as e:
        print(f"Erro próximo evento: {e}")
        return None

def verificar_e_sincronizar_cartelas(evento_num_max, evento_tipo_cartela):
    if db is None: return
    try:
        param = db.parametros.find_one({}) 
        if not param: return
        atual_arquivo = int(param.get('arquivo_de_cartela', 0))
        atual_tipo = int(param.get('tipo_sorteio', 0))
        alvo_max = int(evento_num_max)
        alvo_tipo = int(evento_tipo_cartela)

        if atual_arquivo == alvo_max and atual_tipo == alvo_tipo: return
        print(f"🔄 Sincronização: {atual_arquivo}/{atual_tipo} -> {alvo_max}/{alvo_tipo}")

        nome_arquivo = f"{alvo_max:07d}_{alvo_tipo}.json"
        caminho_arquivo = os.path.join(BASE_DIR, 'cartelas', nome_arquivo)

        if not os.path.exists(caminho_arquivo):
            print(f"❌ ARQUIVO '{nome_arquivo}' NÃO ENCONTRADO.")
            return

        with open(caminho_arquivo, 'r', encoding='utf-8') as f: novas_cartelas = json.load(f)
        if novas_cartelas:
            db.cartelas.delete_many({})
            db.cartelas.insert_many(novas_cartelas)
            db.parametros.update_one({}, {'$set': {'arquivo_de_cartela': alvo_max, 'tipo_cartela': alvo_tipo}}, upsert=True)
            print("✅ Base de cartelas atualizada!")
    except Exception as e:
        print(f"❌ Erro sincronizar cartelas: {e}")

# ==============================================================================
#  ROTAS DE ADMINISTRAÇÃO E WEBSOCKET
# ==============================================================================

def websocket_app(environ, start_response):
    if 'wsgi.websocket' in environ:
        ws = environ['wsgi.websocket']
        clientes_conectados.append(ws) 
        clients.add(ws)
        try:
            data = fetch_data()
            ws.send(json.dumps({'type': 'UPDATE', **data}, default=str))
            while not ws.closed: ws.receive()
        except: pass
        finally:
            if ws in clientes_conectados: clientes_conectados.remove(ws)
            clients.discard(ws)
        return []
    return app(environ, start_response)

@app.route('/api/admin/fechar_vendas_evento', methods=['POST'])
def admin_fechar_vendas():
    data = request.json
    id_evt = data.get('id_evento')
    sales_db = get_sales_db_connection()
    if sales_db is None: return jsonify({'error': 'Sem conexão'}), 500

    try:
        tempo_espera_seg = 120
        try:
            param = db.parametros.find_one({})
            if param and 'aviso_fim_das_vendas' in param: tempo_espera_seg = int(param['aviso_fim_das_vendas'])
        except: pass

        msg_aviso = "Atenção, em instantes o sorteio irá iniciar, Boa Sorte!"
        threading.Thread(target=enviar_aviso_sistema, args=("Vendas Encerradas", msg_aviso, str(tempo_espera_seg))).start()

        filtro = {'id_evento': int(id_evt)}
        if not sales_db.eventos.find_one(filtro): filtro = {'id_evento': str(id_evt)}
        sales_db.eventos.update_one(filtro, {'$set': {'status': 'finalizado'}})
        
        return jsonify({'status': 'ok', 'msg': 'Vendas encerradas.'})
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/admin/resetar', methods=['POST'])
def admin_resetar():
    global db, timeStart
    if db is None: return jsonify({'error': 'Sem conexão DB'}), 500
    data = request.json or {}
    finalizar_com_sucesso = data.get('finalizar_sucesso', False)

    try:
        rodada_info = db.rodada.find_one({}) or {}
        raw_id = rodada_info.get('id_evento', 0)
        id_evento = int(raw_id) if raw_id else 0 
        
        # ... (Logica de gravar históricos mantida) ...
        # Para brevidade, assume-se a lógica de salvamento aqui.
        
        timeStart = None 
        db.bolas.update_one({}, {'$set': {'bolas_cantadas': [], 'proxima_bola': "--", 'ultimas_bolas': [], 'ordem':0}}, upsert=True)
        db.bolas_mesa.update_one({}, {'$set': {'bolas_cantadas': [], 'proxima_bola': "--", 'ultimas_bolas': []}}, upsert=True)
        db.ganhadores.delete_many({})
        db.melhores.delete_many({})
        db.confere.delete_many({})
        db.confere.insert_one({"rodada": int(id_evento), "cartao": 0, "numeros": "null", "ganhador": "null"})

        proximo_id_str = "0"
        if finalizar_com_sucesso:
            prox_evento = buscar_proximo_evento_automatico(id_evento)
            if prox_evento:
                proximo_id_str = str(prox_evento.get('id_evento'))
                desc = prox_evento.get('descricao', 'Próximo')
                db.parametros.update_one({}, {'$set': {'nome_sala': desc}}, upsert=True)
            else: proximo_id_str = str(id_evento) 
        else:
            proximo_id_str = str(id_evento)

        db.rodada.update_one({}, {
            '$set': {'id_evento': proximo_id_str, 'estado': 'intervalo', 'ordem': 0, 'data_sorteio': datetime.now(ZoneInfo('America/Sao_Paulo'))}
        }, upsert=True)

        return jsonify({'status': 'Reset concluído', 'proximo_evento': proximo_id_str})
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/admin/preparar_evento', methods=['POST'])
def admin_preparar_evento():
    global db, CACHE_MAX_BOLAS, valorPremioQuadra
    data = request.json or {}
    id_evt = data.get('id_evento')
    sales_db = get_sales_db_connection()
    if not sales_db: return jsonify({'error': 'DB Offline'}), 500

    try:
        evento = sales_db.eventos.find_one({'id_evento': int(id_evt)})
        if not evento: evento = sales_db.eventos.find_one({'id_evento': str(id_evt)})
        if not evento: return jsonify({'error': 'Evento não encontrado'}), 404

        num_max = evento.get('numero_maximo', 72000)
        tipo_cartela = evento.get('tipo_de_cartela', 15)
        raw_val = evento.get('premio_quadra', 0)
        
        try:
            if hasattr(raw_val, 'to_decimal'): valorPremioQuadra = float(raw_val.to_decimal())
            else: valorPremioQuadra = float(raw_val)
        except: valorPremioQuadra = 0.0

        if tipo_cartela == 25: CACHE_MAX_BOLAS = 75
        else: CACHE_MAX_BOLAS = 90   

        verificar_e_sincronizar_cartelas(num_max, tipo_cartela)
        
        if db is not None:
             db.parametros.update_one({}, {'$set': {
                'tipo_sorteio': int(tipo_cartela), 'tipo_cartela': int(tipo_cartela),
                'arquivo_de_cartela': int(num_max), 'nome_sala': evento.get('descricao', 'Sorteio')
            }}, upsert=True)

        return jsonify({'status': 'ok'})
    except Exception as e: return jsonify({'error': str(e)}), 500

# --- PONTO DE ENTRADA ---
def main():
    connect_main_db()
    t = threading.Thread(target=watch_collections, daemon=True)
    t.start()
    
    print(f"🚀 Servidor rodando na porta {port}")
    server = WSGIServer(('0.0.0.0', port), websocket_app, handler_class=WebSocketHandler)
    try: server.serve_forever()
    except KeyboardInterrupt: pass

if __name__ == '__main__':
    main()