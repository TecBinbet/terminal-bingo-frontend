#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import json
import traceback
import threading
import time
from bson.decimal128 import Decimal128
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
from geventwebsocket.exceptions import WebSocketError
import sys

# --- NO TOPO DO SERVER.PY (Logo após os imports) ---

# 1. Lista Global para guardar as TVs conectadas
clientes_conectados = []

# 2. A função que envia mensagem para todos
def broadcast_para_clientes(mensagem_dict):
    import json
    texto = json.dumps(mensagem_dict)
    para_remover = []
    
    for ws in clientes_conectados:
        try:
            ws.send(texto)
        except:
            para_remover.append(ws)
            
    # Limpa conexões mortas
    for morto in para_remover:
        if morto in clientes_conectados:
            clientes_conectados.remove(morto)



def converter_decimal(valor):
    """Converte Decimal128 ou String para Float"""
    if isinstance(valor, Decimal128):
        return float(valor.to_decimal())
    if isinstance(valor, str):
        try:
            return float(valor.replace(',', '.'))
        except:
            return 0.0
    return float(valor) if valor else 0.0


# --- FUNÇÕES AUXILIARES DE MOEDA (RATEIO) ---
def parse_brl(valor_str):
    """Converte 'R$ 1.200,50' ou '1200,50' para float 1200.50"""
    if not valor_str: return 0.0
    if isinstance(valor_str, (int, float)): return float(valor_str)
    try:
        limpo = str(valor_str).replace('R$', '').replace(' ', '').replace('.', '').replace(',', '.')
        return float(limpo)
    except:
        return 0.0

def format_brl(valor_float):
    """Converte float 1200.50 para '1.200,50' (sem R$)"""
    try:
        return f"{valor_float:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
    except:
        return "0,00"


# --- FUNÇÃO PARA ENVIAR AVISOS AO TERMINAL ---
def enviar_aviso_sistema(titulo, mensagem, tempo_str):
    """
    Limpa a tabela de avisos e insere um novo registro.
    O 'tempo_str' pode ser segundos (int/str) ou hora final 'HH:MM:SS'.
    """
    if db is None: return
    try:
        db.avisos.delete_many({}) # Mantém apenas o último
        db.avisos.insert_one({
            'titulo': titulo,
            'mensagem': mensagem,
            'tempo': str(tempo_str),
            'timestamp': time.time() # Útil para controle de cache
        })
        print(f"📢 Aviso enviado: {titulo} - {tempo_str}")
    except Exception as e:
        print(f"Erro ao enviar aviso: {e}")


# Tenta importar certifi para evitar erros de SSL
try:
    import certifi
    _TLS_CA_FILE = certifi.where()
except Exception:
    _TLS_CA_FILE = None

VERSION = "2.1.0-SingleTenant"

# --- CONFIGURAÇÃO DE ROTEAMENTO DE SALAS ---

# 1. URI ONDE BUSCAMOS A LISTA DE SALAS (INTEGRAÇÃO CENTRALIZADA)
# Aqui fica o banco 'db_master_controle' com a tabela 'salas'
URI_CONSULTA_SALAS = "mongodb+srv://tecbin_db_vendas:TecBin24@cluster0.blwq4du.mongodb.net/?appName=Cluster0"

# 2. URI PADRÃO / FALLBACK (LEGADO)
# Se não informar sala, ou se a sala não for encontrada na consulta acima, usa esta:
URI_FALLBACK_PADRAO = "mongodb+srv://rivaldosp:TecBin24@tecbinon.3zsz7md.mongodb.net/"

# Tenta ler o parâmetro 'IDSALA' do ambiente
PARAM_ID_SALA = os.environ.get("IDSALA", "000")

def buscar_uri_da_sala(id_sala_alvo):
    """
    1. Conecta no Cluster de Vendas (URI_CONSULTA_SALAS).
    2. Busca no banco 'db_master_controle', coleção 'salas'.
    3. Se achar, retorna o link específico.
    4. Se não achar ou erro, retorna URI_FALLBACK_PADRAO.
    """
    
    # Se ID for nulo ou 0, já retorna o padrão direto sem nem buscar
    if not id_sala_alvo or id_sala_alvo == "0" or id_sala_alvo == "000":
        print(f"ℹ️ [ROTEAMENTO] ID Sala não definido. Usando Padrão.")
        return URI_FALLBACK_PADRAO

    print(f"🔍 [ROTEAMENTO] Buscando configuração para Sala ID: {id_sala_alvo}...")
    
    uri_final = URI_FALLBACK_PADRAO # Começamos assumindo o padrão

    client_consulta = None
    try:
        # Configura conexão segura
        mongo_kwargs = { 'server_api': ServerApi('1') }
        if _TLS_CA_FILE: mongo_kwargs['tlsCAFile'] = _TLS_CA_FILE
        
        # Conecta no Cluster de Consulta (Vendas)
        client_consulta = MongoClient(URI_CONSULTA_SALAS, **mongo_kwargs)
        
        # Acessa o banco específico de controle
        db_controle = client_consulta.get_database("db_master_controle")
        
        # Busca a sala
        sala_doc = db_controle.salas.find_one({'id_sala': id_sala_alvo})
        
        if sala_doc and 'url_mongo_sorteio' in sala_doc:
            novo_link = sala_doc['url_mongo_sorteio']
            
            if novo_link and len(novo_link) > 10:
                uri_final = novo_link
                print(f"✅ [ROTEAMENTO] Sala {id_sala_alvo} encontrada! Redirecionando banco.")
            else:
                print(f"⚠️ [ROTEAMENTO] Sala encontrada, mas campo 'url_mongo_sorteio' inválido. Usando Padrão.")
        else:
            print(f"⚠️ [ROTEAMENTO] Sala {id_sala_alvo} não cadastrada no Master Controle. Usando Padrão.")

    except Exception as e:
        print(f"❌ [ROTEAMENTO] Erro ao consultar master de salas: {e}")
        print("   -> Mantendo URI Padrão por segurança.")
    
    finally:
        if client_consulta:
            client_consulta.close()
            
    return uri_final

# --- DEFINE A URI REAL DO SISTEMA ---
MONGO_URI = buscar_uri_da_sala(PARAM_ID_SALA)

# O nome do banco principal (pode vir do ambiente ou fixo)
DB_NAME = os.environ.get("DB_NAME", "dados_do_sorteio")

LOCAL_PATH = os.environ.get("LOCAL_PATH", "c:/chefemesa/json")
is_local_mode = False

app = Flask(__name__)
CORS(app)
port = int(os.environ.get('PORT') or os.environ.get('sPORT', 3001))

# --- VARIÁVEIS GLOBAIS ---
db = None
sales_client = None  # Cache para conexão de vendas
current_sales_uri = None
clients = set() # WebSocket clients
local_data = {}
mongo_data = {}
stop_flag = threading.Event()
timeStart = None

# --- CACHE EM MEMÓRIA (VELOCIDADE MÁXIMA) ---
CACHE_JOGO = {
    'ativo': False,
    'cartelas': [] # Lista de objetos: {'id': 100, 'nome': 'José', 'layout': {sup: set, cen: set...}}
}

# SUBSTITUA A FUNÇÃO carregar_cache_evento POR ESTA:

def carregar_cache_evento(id_evento, sales_db):
    global CACHE_JOGO, db
    print(f"🚀 Iniciando carregamento em memória do Evento {id_evento}...")
    
    CACHE_JOGO['ativo'] = False
    CACHE_JOGO['cartelas'] = []

    try:
        # 1. Busca Vendas (Mantido)
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

        # 2. Busca Layouts
        ids = list(mapa_vendas.keys())
        cursor_cartelas = db.cartelas.find({'cartao': {'$in': ids}})

        lista_cache = []

        for doc in cursor_cartelas:
            c_id = doc.get('cartao')
            tipo_detectado = 90
            layout_data = {}
            
            # --- 1. DETECÇÃO E PARSING BINGO 75 ---
            # Checa se é BINGO 75 (Campo 'numeros' é lista e tem 25)
            if 'numeros' in doc and isinstance(doc['numeros'], list) and len(doc['numeros']) >= 25:
                tipo_detectado = 75
                lista_ordenada = doc['numeros'] 
                nums_set = set(lista_ordenada)
                nums_set.discard(0) # Remove o FREE (0)
                
                layout_data = {
                    'lista_75': lista_ordenada, 
                    'geral': nums_set
                }
            
            # --- 2. DETECÇÃO E PARSING BINGO 90 (FALLBACK) ---
            else:
                tipo_detectado = 90
                def to_set(val):
                    if isinstance(val, str) and val: return set(map(int, val.replace(' ', '').split(',')))
                    if isinstance(val, list): return set(val)
                    return set()

                sup = to_set(doc.get('superior'))
                cen = to_set(doc.get('central'))
                inf = to_set(doc.get('inferior'))
                
                layout_data = {
                    'sup': sup, 'cen': cen, 'inf': inf,
                    'geral': sup | cen | inf
                }
            
            # Adiciona ao cache
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
        import traceback
        traceback.print_exc()
        CACHE_JOGO['ativo'] = False


def connect_main_db():
    global db
    if not is_local_mode:
        try:
            # Mostra o Cluster para conferência (Oculta senha)
            cluster_name = MONGO_URI.split('@')[-1].split('/')[0]
            print(f"🔌 CONECTANDO NO CLUSTER: {cluster_name}")
            
            mongo_kwargs = { 'server_api': ServerApi('1') }
            if _TLS_CA_FILE: mongo_kwargs['tlsCAFile'] = _TLS_CA_FILE
            
            client = MongoClient(MONGO_URI, **mongo_kwargs)
            
            # --- LÓGICA DE BANCO PADRONIZADO ---
            # 1. Tenta pegar o nome do banco se estiver escrito no link (ex: ...net/meu_banco)
            # 2. Se não tiver nada no link, assume "dados_do_sorteio" (PADRÃO)
            try:
                db_target = client.get_default_database()
                print(f"✅ Banco definido no link: '{db_target.name}'")
                db = db_target
            except:
                # O link veio limpo (ex: ...mongodb.net). Usamos o nome padrão.
                NOME_PADRAO = "dados_do_sorteio"
                print(f"⚠️ Link sem nome de banco. Usando padronizado: '{NOME_PADRAO}'")
                db = client.get_database(NOME_PADRAO)
            # ------------------------------------

            client.admin.command('ping') 
            print(f"✅ CONEXÃO BEM SUCEDIDA NO CLUSTER: {cluster_name}")
            
        except Exception as e:
            print(f"❌ Erro fatal ao conectar ao MongoDB: {e}")
            sys.exit(1)


# --- FUNÇÃO GENÉRICA DE BUSCA DE DADOS ---
def fetch_data():
    """Busca dados ou do JSON Local ou do MongoDB, dependendo do modo."""
    if is_local_mode:
        return fetch_data_from_local_files()
    else:
        return fetch_data_from_mongodb()


def fetch_data_from_local_files():
    try:
        # Carrega arquivos
        def load_json(name):
            path = os.path.join(LOCAL_PATH, f'{name}.json')
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f: return json.load(f)
            return []

        bolas = load_json('bolas')
        buscando = load_json('buscando')
        premio_raw = load_json('premio')
        rodada = load_json('rodada')
        confere = load_json('confere')
        parametros = load_json('parametros')
        melhores = load_json('melhores')
        
        # --- PROCESSAMENTO DE GANHADORES (Auxiliar para evitar repetição) ---
        def processar_lista(raw_list):
            g_dict = {}
            for g in raw_list:
                # Agrupa por Prêmio + Valor
                k = f"{g.get('premio')}|{g.get('valor_total_premio')}"
                if k not in g_dict:
                    g_dict[k] = {
                        "premio": g.get('premio'), 
                        "valor": g.get('valor_total_premio'), 
                        "ganhadores": []
                    }
                g_dict[k]["ganhadores"].append({
                    "cartela": g.get('cartela'), 
                    "nome": g.get('nome'), 
                    "valor_rateio": g.get('valor_rateio')
                })
            return list(g_dict.values())

        # 1. LISTA PARA O TERMINAL (PÓS-JOGO)
        # Lê do arquivo 'osganhadores.json' (histórico fechado)
        ganhadores_terminal_raw = load_json('osganhadores')
        lista_terminal = processar_lista(ganhadores_terminal_raw)

        # 2. LISTA PARA A MESA ADMIN (TEMPO REAL)
        # Lê do arquivo 'ganhadores.json' (lista dinâmica do jogo atual)
        ganhadores_live_raw = load_json('ganhadores')
        lista_live = processar_lista(ganhadores_live_raw)
        
        # Debug opcional
        # print(f"Live: {len(lista_live)} | Terminal: {len(lista_terminal)}")

        # Processa Prêmios para exibir no frontend
        premio_data, tope_data, card_ranges, premio_info = process_prizes(premio_raw)
        
        param_doc = parametros[0] if parametros else {}
        if 'tipo_entrada_de_cartelas' not in param_doc: param_doc['tipo_entrada_de_cartelas'] = 1
        return {
            'bolasData': bolas, 'buscandoData': buscando, 'premioData': premio_data,
            'premioInfo': premio_info, 'rodadaData': rodada, 'confereData': confere,
            'topeData': tope_data, 'cardRanges': card_ranges, 'promocionalData': [],
            'parametrosInfo': param_doc, 'melhoresData': melhores,
            
            # --- RETORNA AS DUAS LISTAS SEPARADAS ---
            'ganhadoresData': lista_terminal,  # Terminal (osganhadores)
            'ganhadoresLive': lista_live       # Admin (ganhadores)
        }
    except Exception as e:
        print(f"Erro local: {e}")
        return {}


def fetch_data_from_mongodb():
    global db
    if db is None: return {}
    try:
        # Helper para converter ObjectId
        def clean(cursor):
            l = list(cursor)
            for i in l: i['_id'] = str(i['_id'])
            return l

        bolas_mesa = clean(db.bolas_mesa.find({}))
        buscando_mesa = clean(db.buscando_mesa.find({}))

        bolas = clean(db.bolas.find({}))
        buscando = clean(db.buscando.find({}))
        premios_raw = clean(db.premio.find({}))
        rodada = clean(db.rodada.find({}))
        confere = clean(db.confere.find({}))
        parametros = clean(db.parametros.find({}))
        melhores = list(db['melhores'].find({}, {'_id':0}).sort('id_posicao', 1).limit(25))
        
        # --- 1. LISTA PARA O TERMINAL (PÓS-JOGO) ---
        ganhadores_terminal_raw = list(db.osganhadores.find({}))        
        ganhadores_terminal_dict = {}
        for g in ganhadores_terminal_raw:
            k = f"{g.get('premio')}|{g.get('valor_total_premio')}"
            if k not in ganhadores_terminal_dict:
                ganhadores_terminal_dict[k] = {"premio": g.get('premio'), "valor": g.get('valor_total_premio'), "ganhadores": []}
            ganhadores_terminal_dict[k]["ganhadores"].append({"cartela": g.get('cartela'), "nome": g.get('nome'), "valor_rateio": g.get('valor_rateio')})
        
        lista_terminal = list(ganhadores_terminal_dict.values())

        # --- 2. LISTA PARA A MESA ADMIN (TEMPO REAL) ---
        ganhadores_live_raw = list(db.ganhadores.find({}))
        ganhadores_live_dict = {}
        for g in ganhadores_live_raw:
            k = f"{g.get('premio')}|{g.get('valor_total_premio')}"
            if k not in ganhadores_live_dict:
                ganhadores_live_dict[k] = {"premio": g.get('premio'), "valor": g.get('valor_total_premio'), "ganhadores": []}
            ganhadores_live_dict[k]["ganhadores"].append({"cartela": g.get('cartela'), "nome": g.get('nome'), "valor_rateio": g.get('valor_rateio')})
            
        lista_live = list(ganhadores_live_dict.values())
        
        premio_data, tope_data, card_ranges, premio_info = process_prizes(premios_raw)

        param_doc = parametros[0] if parametros else {}
        
        avisos = clean(db.avisos.find({}))
   
        if 'tipo_entrada_de_cartelas' not in param_doc: param_doc['tipo_entrada_de_cartelas'] = 1

        return {
            'bolasData': bolas, 'buscandoData': buscando, 'premioData': premio_data,
            'premioInfo': premio_info, 'rodadaData': rodada, 'confereData': confere,
            'topeData': tope_data, 'cardRanges': card_ranges, 'promocionalData': [],
            'parametrosInfo': param_doc, 'melhoresData': melhores, 
            
            'bolasMesaData': bolas_mesa, 
            'buscandoMesaData': buscando_mesa,
           
            # ENVIA AS DUAS LISTAS
            'ganhadoresData': lista_terminal, 
            'ganhadoresLive': lista_live,
            'avisosData' : avisos     
        }
    except Exception as e:
        # AQUI VAMOS PEGAR SE HOUVE ERRO SILENCIOSO
        print(f"❌ ERRO FATAL EM FETCH_DATA: {e}")
        import traceback
        traceback.print_exc()
        return {}



def process_prizes(premios_raw):
    premio_data = []
    premio_info = {}
    tope_data = []
    card_ranges = []

    if premios_raw:
        p = premios_raw[0]
        premio_info = p
        
        # Ranges
        for k in ['1','2','3','4']:
            if p.get(f'inicial{k}') is not None: 
                card_ranges.append({'inicial': p[f'inicial{k}'], 'final': p[f'final{k}']})

        # Lista Visual
        campos = [
            ('premio_quadra', 'QUADRA'), ('premio_linha', 'LINHA'), ('premio_bingo', 'BINGO'),
            ('premio_acumulado', 'ACUMULADO'), ('premio_falta_Um', 'FALTA 1'), 
            ('premio_duplo_bingo', 'DUPLO BINGO'), ('premio_triplo_bingo', 'TRIPLO BINGO'),
            ('premio_super_bingo', 'SUPER BINGO')
        ]
        for campo, label in campos:
            val = p.get(campo)
            if isinstance(val, (int, float)):
                lbl = label
                if campo == 'premio_linha' and p.get('qtde_linha', 1) > 1: lbl = f"{p['qtde_linha']} LINHAS"
                premio_data.append({'tipo_premio': lbl, 'valor': f"R$ {val:.2f}".replace('.', ',')})

        # Tope
        if p.get('bola_tope_sb') or p.get('bola_tope_ac'):
            tope_data.append({'bola_tope_sb': p.get('bola_tope_sb'), 'bola_tope_ac': p.get('bola_tope_ac')})
            
    return premio_data, tope_data, card_ranges, premio_info

# --- WATCHER LOOP (Único e Simples) ---
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
                
                # Salva na variável correta para o WebSocket usar na conexão inicial
                if is_local_mode: local_data = current_data
                else: mongo_data = current_data
                
                print(f"🔔 Dados atualizados! Enviando broadcast...")
                broadcast(current_data)
                
        except Exception as e:
            print(f"Erro no Watcher: {e}")
            
        time.sleep(1)

def broadcast(data):
    msg = json.dumps({'type': 'UPDATE', **data}, default=str)
    # Copia o set para evitar erro de mudança de tamanho durante iteração
    for client in list(clients):
        try:
            client.send(msg)
        except:
            clients.discard(client)


# Crie esta nova função no seu código:

def recalcular_ranking_principal():
    """
    Função Despachante: Decide qual rotina de ranking (90 ou 75) deve ser executada.
    """
    global CACHE_JOGO
    if not CACHE_JOGO['ativo']:
        return
        
    # Assume 90 como padrão, mas verifica a primeira cartela no cache
    tipo_jogo_atual = 90 
    if CACHE_JOGO['cartelas']:
        # Verifica o tipo de cartela que foi carregada (baseado na tag 'tipo' que definimos)
        tipo_jogo_atual = CACHE_JOGO['cartelas'][0].get('tipo', 90)

    if tipo_jogo_atual == 75:
        # ATENÇÃO: Confirme o nome correto desta sua nova função de 75
        # Ela precisa existir no seu server.py
        recalcular_ranking_top10_75() 
    else:
        # Chamada para o ranking de 90 bolas (a versão que acabamos de corrigir)
        recalcular_ranking_top10()


def recalcular_ranking_top10():
    global db, CACHE_JOGO
    
    # print("🔄 [RANKING] Iniciando cálculo...")

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

        busca_quadra   = 'QUADRA' in premio_buscado
        busca_linha    = 'LINHA' in premio_buscado
        busca_falta_um = 'FALTA' in premio_buscado
        busca_duplo    = 'DUPLO' in premio_buscado or 'SEGUNDO' in premio_buscado
        
        # --- NOVO: IDENTIFICA LINHAS JÁ GANHAS (COM CORREÇÃO PARA 1 LINHA) ---
        linhas_ja_ganhas = set()
        if busca_linha:
            rodada_atual = db.rodada.find_one({})
            id_rodada = rodada_atual.get('id_evento') if rodada_atual else 0
            
            ganhadores_linha = list(db.ganhadores.find({'premio': {'$regex': 'LINHA'}}))
            
            # Busca a configuração de Quantidade de Linhas do Prêmio
            tabela_premios = db.premio.find_one({}) or {}
            qtde_linhas_jogo = int(tabela_premios.get('qtde_linha', 1))

            # SE FOR JOGO DE 1 LINHA E ALGUÉM JÁ GANHOU, BLOQUEIA TODAS AS OUTRAS
            if qtde_linhas_jogo == 1 and len(ganhadores_linha) > 0:
                 linhas_ja_ganhas.add('Sup')
                 linhas_ja_ganhas.add('Cen')
                 linhas_ja_ganhas.add('Inf')
            else:
                # Se for jogo de 2 ou 3 linhas, remove apenas a que saiu
                for g in ganhadores_linha:
                    tag = g.get('linha_ganha_tag') 
                    if tag: linhas_ja_ganhas.add(tag)
        # ---------------------------------------------------------------------

        # Mapa de Ganhadores Gerais (Bingo)
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
            
            # Lógica Condicional de Linhas
            if busca_linha or busca_quadra:
                f_sup = layout['sup'] - bolas_cantadas
                f_cen = layout['cen'] - bolas_cantadas
                f_inf = layout['inf'] - bolas_cantadas
                
                opcoes = []
                
                # SÓ ADICIONA A OPÇÃO SE A LINHA AINDA NÃO FOI GANHA
                # (Ou se for Quadra, que não trava linha)
                
                # Linha Superior
                if (not linhas_config or 'SUP' in linhas_config.upper()):
                    if busca_quadra or 'Sup' not in linhas_ja_ganhas:
                        opcoes.append({'tag': 'Sup', 'set': f_sup})

                # Linha Central
                if (not linhas_config or 'CEN' in linhas_config.upper()):
                    if busca_quadra or 'Cen' not in linhas_ja_ganhas:
                        opcoes.append({'tag': 'Cen', 'set': f_cen})

                # Linha Inferior
                if (not linhas_config or 'INF' in linhas_config.upper()):
                    if busca_quadra or 'Inf' not in linhas_ja_ganhas:
                        opcoes.append({'tag': 'Inf', 'set': f_inf})
                
                # --- FALLBACK IMPORTANTE ---
                # Se 'opcoes' estiver vazio, significa que TODAS as linhas buscadas já foram ganhas.
                # Nesse caso, o sistema deve mostrar a distância para o BINGO (Cartela Cheia)
                # para não travar o ranking nem ficar dando alerta falso.
                if not opcoes and busca_linha:
                    faltam = layout['geral'] - bolas_cantadas
                    tag_posicao = "" # Sem posição, pois é geral
                    # Força modo Bingo visualmente no ranking
                    busca_linha_temporaria = False 
                else:
                    # Segue normal
                    if not opcoes: # Fallback de erro (se config vier errada)
                         opcoes = [{'tag': 'Geral', 'set': layout['geral'] - bolas_cantadas}]
                    
                    melhor = min(opcoes, key=lambda x: len(x['set']))
                    faltam = melhor['set']
                    tag_posicao = melhor['tag']
                    busca_linha_temporaria = True

            else:
                # Bingo/Duplo/FaltaUm
                faltam = layout['geral'] - bolas_cantadas
                tag_posicao = "" 
                busca_linha_temporaria = False

            qtde_falta = len(faltam)
            msg_premio = ""
            
            # Lógica de Status
            if qtde_falta == 0:
                if busca_quadra: msg_premio = "QUADRA"
                elif busca_linha and busca_linha_temporaria: msg_premio = "LINHA"
                elif busca_duplo: msg_premio = "DUPLO BINGO"
                else: msg_premio = "BINGO" # Cai aqui se as linhas acabaram
            
            elif qtde_falta == 1:
                if busca_quadra: msg_premio = "QUADRA"
                elif busca_falta_um: msg_premio = "FALTA UM"
            
            resultados.append({
                'cartela': c_id,
                'nome': item['nome'],
                'numeros_faltantes': sorted(list(faltam)),
                'qtde': qtde_falta,
                'posicao': tag_posicao,
                'premio': msg_premio
            })

        resultados.sort(key=lambda x: (x['qtde'], x['cartela']))
        top_10 = resultados[:10]

        rodada_info = db.rodada.find_one({})
        id_evento_ativo = rodada_info.get('id_evento', 0) if rodada_info else 0

        novos_docs = []
        for i, r in enumerate(top_10):
            lista_original = r['numeros_faltantes']
            string_numeros = ",".join(f"{n:02d}" for n in lista_original)
            
            pos_letra = r['posicao'][0] if r['posicao'] else ""

            novos_docs.append({
                "id_posicao": i + 1,
                "cartela": str(r['cartela']),
                "posicao": pos_letra,
                "numeros": string_numeros, 
                "numeros_faltantes": lista_original,
                "premio": r['premio'],
                "nome": r['nome'],
                "rodada": int(id_evento_ativo)
            })

        db.melhores.delete_many({})
        if novos_docs:
            db.melhores.insert_many(novos_docs)

    except Exception as e:
        print(f"❌ [ERRO RANKING] {e}")
        import traceback
        traceback.print_exc()



def recalcular_ranking_top10_75():
    """
    Calcula ranking para BINGO 75 (Lógica Rígida de Fluxo).
    """
    global db, CACHE_JOGO
    if not CACHE_JOGO['ativo']: return
    
    try:
        dados_bolas = db.bolas_mesa.find_one({}) or {}
        bolas_cantadas = set(dados_bolas.get('bolas_cantadas', []))
        
        # --- BUSCA O ESTADO ATUAL ---
        dados_premio = db.buscando.find_one({}) or {}
        premio_buscado_texto = dados_premio.get('buscando_o_premio', 'BINGO').upper()

        # --- 1. VERIFICAÇÃO DE VENCEDORES NO BANCO ---
        qtd_linha = db.ganhadores.count_documents({'premio': {'$regex': 'LINHA', '$options': 'i'}})
        qtd_cantos = db.ganhadores.count_documents({'premio': {'$regex': 'CANTOS|QUADRA', '$options': 'i'}})

        ganhou_linha = qtd_linha > 0
        ganhou_cantos = qtd_cantos > 0

        # --- 2. ÁRVORE DE DECISÃO DO FLUXO ---
        buscar_linha_agora = False
        buscar_cantos_agora = False
        buscar_bingo_agora = False
        
        novo_nome_premio = 'BINGO' # Default

        if 'BINGO' == premio_buscado_texto or 'ACUMULADO' in premio_buscado_texto:
            buscar_bingo_agora = True
            novo_nome_premio = premio_buscado_texto
        
        elif ganhou_linha and ganhou_cantos:
            buscar_bingo_agora = True
            novo_nome_premio = 'BINGO'
            
        elif ganhou_linha and not ganhou_cantos:
            buscar_cantos_agora = True
            novo_nome_premio = '4 CANTOS'
            
        elif ganhou_cantos and not ganhou_linha:
            buscar_linha_agora = True
            novo_nome_premio = 'LINHA'
            
        else:
            buscar_linha_agora = True
            buscar_cantos_agora = True
            novo_nome_premio = '4 CANTOS E LINHA'

        # --- ATUALIZA O NOME DO PRÊMIO ---
        if novo_nome_premio != dados_premio.get('buscando_o_premio'):
             db.buscando.update_one({}, {'$set': {'buscando_o_premio': novo_nome_premio}}, upsert=True)
             db.buscando_mesa.update_one({}, {'$set': {'buscando_o_premio': novo_nome_premio}}, upsert=True)
             # broadcast_para_clientes({'type': 'UPDATE_PREMIO'}) # Opcional

        # --- EXCLUSÃO DE DUPLO BINGO ---
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
            
            # --- CÁLCULO: BINGO ---
            if layout.get('geral'):
                faltam_bingo = layout['geral'] - bolas_cantadas
                qtde_bingo = len(faltam_bingo)
                if qtde_bingo == 0:
                     opcoes_proximidade.append({'tag': 'BINGO', 'set': faltam_bingo, 'qtde': 0, 'premio': 'BINGO'})
                elif buscar_bingo_agora:
                     opcoes_proximidade.append({'tag': 'Geral', 'set': faltam_bingo, 'qtde': qtde_bingo, 'premio': 'BINGO'})

            # --- CÁLCULO: 4 CANTOS ---
            if buscar_cantos_agora:
                alvo_cantos = {lista_nums[0], lista_nums[4], lista_nums[20], lista_nums[24]} - {0}
                faltam_cantos = alvo_cantos - bolas_cantadas
                qtde_cantos = len(faltam_cantos)
                if qtde_cantos == 0:
                    opcoes_proximidade.append({'tag': 'CANTOS', 'set': faltam_cantos, 'qtde': 0, 'premio': '4 CANTOS'})
                else:
                    opcoes_proximidade.append({'tag': 'Cantos', 'set': faltam_cantos, 'qtde': qtde_cantos, 'premio': '4 CANTOS'})

            # --- CÁLCULO: LINHA ---
            if buscar_linha_agora:
                linhas_indices = [
                    [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24]
                ]
                melhor_linha_set = set()
                melhor_linha_qtde = 99
                bateu_linha = False
                for indices_da_linha in linhas_indices:
                    linha_set = {lista_nums[i] for i in indices_da_linha} - {0}
                    f_linha = linha_set - bolas_cantadas
                    q_linha = len(f_linha)
                    if q_linha == 0:
                        opcoes_proximidade.append({'tag': 'LINHA', 'set': f_linha, 'qtde': 0, 'premio': 'LINHA'})
                        bateu_linha = True
                        break 
                    if q_linha < melhor_linha_qtde:
                        melhor_linha_qtde = q_linha
                        melhor_linha_set = f_linha
                if not bateu_linha:
                    opcoes_proximidade.append({'tag': 'Linha', 'set': melhor_linha_set, 'qtde': melhor_linha_qtde, 'premio': 'LINHA'})

            # --- SELEÇÃO FINAL ---
            if not opcoes_proximidade: continue

            vitorias = [op for op in opcoes_proximidade if op['qtde'] == 0]
            
            if len(vitorias) > 0:
                nomes_premios = sorted(list(set([v['premio'] for v in vitorias])))
                msg_vitoria = " E ".join(nomes_premios)
                escolhido = vitorias[0]
                qtde, faltam, tag = 0, escolhido['set'], escolhido['tag']
            else:
                melhor = min(opcoes_proximidade, key=lambda x: x['qtde'])
                qtde = melhor['qtde']
                faltam = melhor['set']
                tag = melhor['tag']
                
                # --- CORREÇÃO AQUI ---
                # Antes: msg_vitoria = f"Falta {qtde}"
                # Agora: Deixamos vazio para não sujar o campo 'premio' no banco
                msg_vitoria = "" 

            resultados.append({
                'cartela': c_id, 'nome': item['nome'],
                'numeros_faltantes': sorted(list(faltam)),
                'qtde': qtde, 'posicao': tag, 'premio': msg_vitoria
            })

        # --- GRAVAÇÃO ---
        resultados.sort(key=lambda x: (x['qtde'], x['cartela']))
        top_10 = resultados[:10]
        
        rodada_info = db.rodada.find_one({})
        id_evt = rodada_info.get('id_evento', 0) if rodada_info else 0

        novos_docs = []
        for i, r in enumerate(top_10):
            try:
                qtde_segura = int(r.get('qtde', 999))
                pos_raw = r.get('posicao', "")
                pos_letra = pos_raw[0] if pos_raw else "" 
                lista_original = r.get('numeros_faltantes') or []
                string_numeros = ",".join(f"{n:02d}" for n in lista_original)
                
                novos_docs.append({
                    "id_posicao": i + 1, "cartela": str(r['cartela']), "posicao": pos_letra,
                    "numeros": string_numeros, "numeros_faltantes": lista_original,
                    "premio": str(r.get('premio', '')), "nome": str(r.get('nome', '---')),
                    "rodada": int(id_evt), "qtde": qtde_segura
                })
            except: continue

        db.melhores.delete_many({})
        if novos_docs: db.melhores.insert_many(novos_docs)

    except Exception as e:
        print(f"❌ Erro Ranking 75: {e}")
        import traceback
        traceback.print_exc()


def verificar_e_sincronizar_cartelas(evento_num_max, evento_tipo_cartela):
    """
    Verifica se a tabela 'cartelas' está sincronizada com o evento.
    Se não, carrega o arquivo JSON correspondente e atualiza.
    """
    if db is None: return

    try:
        # 1. Busca parâmetros atuais
        param = db.parametros.find_one({}) or {}
        
        # Pega os valores atuais do banco (convertendo para int para comparação segura)
        atual_arquivo = int(param.get('arquivo_de_cartela', 0))
        atual_tipo = int(param.get('tipo_cartela', 0))
        
        # Valores alvo vindos do Evento
        alvo_max = int(evento_num_max)
        alvo_tipo = int(evento_tipo_cartela)

        # 2. Comparação
        if atual_arquivo == alvo_max and atual_tipo == alvo_tipo:
            # Já está tudo certo, não precisa fazer nada
            return

        print(f"🔄 Sincronização necessária! Atual: {atual_arquivo}/{atual_tipo} -> Novo: {alvo_max}/{alvo_tipo}")

        # 3. Formatação do Nome do Arquivo
        # Ex: 72000 -> "0072000" (7 dígitos) + "_" + "15" + ".json"
        nome_arquivo = f"{alvo_max:07d}_{alvo_tipo}.json"
        caminho_arquivo = os.path.join(BASE_DIR, 'cartelas', nome_arquivo)

        print(f"📂 Buscando arquivo: {caminho_arquivo}")

        if not os.path.exists(caminho_arquivo):
            print(f"❌ ERRO CRÍTICO: Arquivo de cartelas '{nome_arquivo}' não encontrado na pasta 'cartelas'.")
            return

        # 4. Carregamento e Atualização
        with open(caminho_arquivo, 'r', encoding='utf-8') as f:
            novas_cartelas = json.load(f)
        
        if novas_cartelas:
            # Limpa tabela antiga
            print("🗑️ Limpando tabela 'cartelas' antiga...")
            db.cartelas.delete_many({})
            
            # Insere novas (Batch insert é mais rápido)
            print(f"📥 Inserindo {len(novas_cartelas)} novas cartelas...")
            db.cartelas.insert_many(novas_cartelas)
            
            # 5. Atualiza Parametros
            db.parametros.update_one({}, {
                '$set': {
                    'arquivo_de_cartela': alvo_max,
                    'tipo_cartela': alvo_tipo
                }
            }, upsert=True)
            
            print("✅ Base de cartelas atualizada com sucesso!")
        else:
            print("⚠️ O arquivo JSON está vazio.")

    except Exception as e:
        print(f"❌ Erro ao sincronizar cartelas: {e}")
        import traceback
        traceback.print_exc()


# --- ROTAS HTTP ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route('/')
def serve_index(): return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path): return send_from_directory(BASE_DIR, path)

@app.route('/api/initial-data')
def initial_data():
    return jsonify(fetch_data())

@app.route('/api/melhores')
def get_melhores():
    # Verifica conexão
    if db is None: return jsonify([])
    
    try:
        # Busca OTIMIZADA: Vai direto na coleção 'melhores', sem carregar o resto do banco
        # Sort 1 = Crescente (1º, 2º, 3º...)
        melhores = list(db.melhores.find({}, {'_id': 0}).sort('id_posicao', 1).limit(25))
        return jsonify(melhores)
    except Exception as e:
        print(f"Erro ao buscar melhores: {e}")
        return jsonify([])


@app.route('/api/version')
def get_version(): return jsonify({'version': VERSION})


# --- SUBSTITUA A FUNÇÃO get_sales_db_connection POR ESTA ---
def get_sales_db_connection():
    global sales_client, current_sales_uri, db
    
    # 1. Busca a URL (Lógica mantida da versão anterior)
    new_uri = None
    try:
        if os.path.exists(os.path.join(LOCAL_PATH, 'parametros.json')):
            with open(os.path.join(LOCAL_PATH, 'parametros.json'), 'r') as f:
                p = json.load(f)
                if p: new_uri = p[0].get('url_mongo_vendas')
    except: pass

    if not new_uri and db is not None:
        try:
            param_doc = db.parametros.find_one({})
            if param_doc: new_uri = param_doc.get('url_mongo_vendas')
        except: pass

    if not new_uri:
        print("❌ ERRO CRÍTICO: 'url_mongo_vendas' não encontrada.")
        return None

    try:
        # Conecta ou Reutiliza conexão
        if sales_client is None or new_uri != current_sales_uri:
            if sales_client: sales_client.close()
            print(f"🔌 Conectando ao Banco de Vendas...")
            mongo_kwargs = {'server_api': ServerApi('1')}
            if _TLS_CA_FILE: mongo_kwargs['tlsCAFile'] = _TLS_CA_FILE
            
            sales_client = MongoClient(new_uri, **mongo_kwargs)
            current_sales_uri = new_uri
            sales_client.admin.command('ping')
            print("✅ Conexão estabelecida com o Cluster de Vendas!")
            
        # --- AQUI ESTÁ A CORREÇÃO DO ERRO ---
        try:
            # Tenta pegar o banco padrão definido no link
            return sales_client.get_default_database()
        except Exception as e_db:
            print(f"⚠️ Aviso: O link não especificou o nome do banco (Erro: {e_db})")
            
            # Lista os bancos disponíveis para ajudar você
            try:
                bancos_disponiveis = sales_client.list_database_names()
                print(f"📋 BANCOS DISPONÍVEIS NO CLUSTER: {bancos_disponiveis}")
                
                # SE TIVER APENAS 1 BANCO (além de admin/local), TENTA USAR ELE AUTOMATICAMENTE
                filtro = [b for b in bancos_disponiveis if b not in ['admin', 'local', 'config']]
                if len(filtro) > 0:
                    banco_escolhido = filtro[0]
                    print(f"🔄 Tentando usar automaticamente o banco: '{banco_escolhido}'")
                    return sales_client.get_database(banco_escolhido)
            except:
                print("❌ Não foi possível listar os bancos automaticamente.")

            # SE A AUTOMATIZAÇÃO FALHAR, USE ESTE NOME HARDCODED:
            # Troque 'dados_do_sorteio' pelo nome que aparecer na lista acima se der erro
            NOME_MANUAL = "dados_do_sorteio" 
            print(f"⚠️ Forçando conexão no banco: '{NOME_MANUAL}'")
            return sales_client.get_database(NOME_MANUAL)

    except Exception as e:
        print(f"❌ Erro fatal na conexão de vendas: {e}")
        return None


# --- ROTA: LISTAR PRÓXIMOS EVENTOS (FILTRADOS) ---
@app.route('/api/proximos_eventos', methods=['GET'])
def proximos_eventos():
    print("🔍 Buscando agenda de eventos...")
    try:
        sales_db = get_sales_db_connection()
        if sales_db is None: 
            return jsonify({'error': 'Sem conexão com DB Vendas'}), 500
        
        if 'eventos' not in sales_db.list_collection_names():
            return jsonify([]), 200

        lista = []
        # FILTRO: Só traz ATIVO ou PARALIZADO (Ignora FINALIZADO/FECHADO)
        # ORDEM: Data e Hora crescentes
        cursor = sales_db.eventos.find({
            'status': {'$in': ['ativo', 'paralizado', 'ATIVO', 'PARALIZADO']}
        }).sort([('data_evento', 1), ('hora_evento', 1)]).limit(5) #  5 Limite opcional
        
        for evt in cursor:
            try:
                valor_safe = converter_decimal(evt.get('valor_de_venda'))
                lista.append({
                    'id_evento': str(evt.get('id_evento')),
                    'descricao': evt.get('descricao', 'Sem Descrição'),
                    'status': evt.get('status', 'ativo'),
                    'data': evt.get('data_evento'),
                    'hora': evt.get('hora_evento'),
                    'valor_cartela': valor_safe,
                    'unidade_venda': evt.get('unidade_de_venda', 1)
                })
            except: continue

        return jsonify(lista)

    except Exception as e:
        print(f"❌ Erro ao listar eventos: {e}")
        return jsonify({'error': str(e)}), 500


# --- ROTA ATUALIZADA: FECHAR VENDAS (CORREÇÃO DE FUSO E MEIA-NOITE) ---
@app.route('/api/admin/fechar_vendas_evento', methods=['POST'])
def admin_fechar_vendas():
    data = request.json
    id_evt = data.get('id_evento')
    
    if not id_evt: return jsonify({'error': 'ID do evento necessário'}), 400

    sales_db = get_sales_db_connection()
    if sales_db is None: return jsonify({'error': 'Sem conexão com DB Vendas'}), 500

    try:
        # 1. Busca configuração de tempo (grace period)
        tempo_espera_seg = 120 # Padrão
        try:
            param = db.parametros.find_one({})
            if param and 'aviso_fim_das_vendas' in param:
                tempo_espera_seg = int(param['aviso_fim_das_vendas'])
        except: pass

        # 2. Calcula Hora Final (Ajustado para Fuso Brasil -3h)
        # Usamos UTC agora e subtraímos 3 horas para garantir horário de Brasília no Log
        agora_br = datetime.utcnow() - timedelta(hours=3)
        hora_final_obj = agora_br + timedelta(seconds=tempo_espera_seg)
        hora_final_str = hora_final_obj.strftime("%H:%M:%S")

        # 3. Envia o Aviso para a tabela (Para o Terminal ler)
        msg_aviso = "Atenção, em instantes o sorteio irá iniciar, Boa Sorte!"
        
        # --- CORREÇÃO AQUI ---
        # Enviamos os SEGUNDOS (str) em vez da hora. 
        # Isso evita que o frontend se perca na virada do dia (ex: 23:59 -> 00:01).
        tempo_para_envio = str(tempo_espera_seg) 
        
        threading.Thread(target=enviar_aviso_sistema, args=("Vendas Encerradas", msg_aviso, tempo_para_envio)).start()

        # 4. Atualiza status no banco de vendas
        filtro = {'id_evento': int(id_evt)}
        if not sales_db.eventos.find_one(filtro):
            filtro = {'id_evento': str(id_evt)}

        # finalizar as vendas
        #result = sales_db.eventos.update_one(filtro, {'$set': {'status': 'finalizado'}})
        
        if result.modified_count > 0:
            print(f"🔒 Evento {id_evt} FINALIZADO. Aviso enviado. Vendas até aprox: {hora_final_str} (BRT)")
            return jsonify({'status': 'ok', 'msg': 'Vendas encerradas e aviso enviado.'})
        else:
            return jsonify({'status': 'warning', 'msg': 'Evento já finalizado (Aviso atualizado).'})

    except Exception as e:
        print(f"Erro fechar vendas: {e}")
        return jsonify({'error': str(e)}), 500


# Rota Consultar Cartelas
@app.route('/api/consultar_cartelas_evento')
def api_consultar_cartelas():
    try:
        id_evt = request.args.get('id_evento')
        id_cli = request.args.get('id_cliente')
        
        if not id_evt or not id_cli: 
            return jsonify({'error': 'Faltam parâmetros'}), 400
        
        s_db = get_sales_db_connection()
        
        # --- CORREÇÃO DO ERRO FATAL AQUI ---
        if s_db is None: 
            return jsonify({'error': 'DB Vendas Offline'}), 500
        # -----------------------------------
        
        col = f"vendas{id_evt}"
        cartelas = []
        
        # Verifica se a tabela de vendas existe
        if col in s_db.list_collection_names():
            # Converte ID cliente para int com segurança
            try:
                id_cli_int = int(id_cli)
            except:
                id_cli_int = id_cli # Tenta buscar como string se falhar
                
            cursor = s_db[col].find({'id_cliente': id_cli_int})
            
            for v in cursor:
                # BLINDAGEM: Garante que os valores sejam inteiros antes de usar range()
                try:
                    # Faixa 1
                    n_ini = int(v.get('numero_inicial') or 0)
                    n_fim = int(v.get('numero_final') or 0)
                    
                    if n_ini > 0 and n_fim >= n_ini:
                        cartelas.extend(range(n_ini, n_fim + 1))
                    
                    # Faixa 2
                    n_ini2 = int(v.get('numero_inicial2') or 0)
                    n_fim2 = int(v.get('numero_final2') or 0)
                    
                    if n_ini2 > 0 and n_fim2 >= n_ini2:
                        cartelas.extend(range(n_ini2, n_fim2 + 1))
                        
                except Exception as e_row:
                    print(f"⚠️ Erro ao processar linha de venda: {e_row}")
                    continue

        return jsonify({'id_evento': id_evt, 'cartelas': cartelas, 'quantidade': len(cartelas)})

    except Exception as e:
        print(f"❌ Erro FATAL na API consultar_cartelas: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



# --- WEBSOCKET CORRIGIDO ---
def websocket_app(environ, start_response):
    # 1. Primeiro verificamos se é uma conexão WebSocket
    if 'wsgi.websocket' in environ:
        ws = environ['wsgi.websocket'] # <--- AQUI O 'ws' NASCE
        
        # 2. AGORA que 'ws' existe, podemos adicionar na lista
        clientes_conectados.append(ws) 
        print(f"TV Conectada! Total: {len(clientes_conectados)}")

        # Se você usa a variável 'clients' antiga, mantenha isso, senão pode apagar
        clients.add(ws)

        try:
            # Envia estado inicial
            data = fetch_data()
            ws.send(json.dumps({'type': 'UPDATE', **data}, default=str))
            
            # Loop para manter a conexão viva
            while not ws.closed:
                ws.receive()
                
        except Exception as e:
            # Ignora erros de desconexão comuns
            pass
            
        finally:
            # 3. Quando o loop acabar (desconectou), removemos da lista
            if ws in clientes_conectados:
                clientes_conectados.remove(ws)
                print(f"TV Saiu. Restam: {len(clientes_conectados)}")
            
            # Removemos também do 'clients' antigo se estiver usando
            clients.discard(ws)
            
        return []

    # Se não for WebSocket, segue o fluxo normal do site
    return app(environ, start_response)


# --- ROTA PARA SALVAR CONFIGURAÇÕES GLOBAIS (ATUALIZADA) ---
@app.route('/api/admin/salvar_config', methods=['POST'])
def admin_salvar_config():
    if db is None: return jsonify({'error': 'Sem conexão DB'}), 500
    
    data = request.json
    
    # Prepara o objeto de atualização
    update_fields = {}

# --- 1. Nome da Sala de Sorteios ---
    # Se vier vazio ou não existir, aplica o padrão "LIVE THE BET"
    nome_sala_input = data.get('nome_sala')
    if nome_sala_input and str(nome_sala_input).strip():
        update_fields['nome_sala'] = str(nome_sala_input).strip()
    else:
        update_fields['nome_sala'] = "LIVE THE BET"

    if 'aguardandoVideo' in data:
        update_fields['aguardandoVideo'] = data.get('aguardandoVideo');


    # --- 2. Controle de Vídeos YouTube ---
    if 'url_padrao' in data:
        update_fields['url_padrao'] = str(data['url_padrao']).strip()
    
    if 'url_live' in data:
        update_fields['url_live'] = str(data['url_live']).strip()


    # --- 3. Link do Banco de Dados de Vendas ---
    # Se vier vazio, aplica a URL padrão do cluster tecbin_db_vendas
    url_vendas_padrao = "mongodb+srv://tecbin_db_vendas:TecBin24@cluster0.blwq4du.mongodb.net/?appName=Cluster0"
    url_vendas_input = data.get('url_mongo_vendas')
    
    if url_vendas_input and str(url_vendas_input).strip():
        update_fields['url_mongo_vendas'] = str(url_vendas_input).strip()
    else:
        update_fields['url_mongo_vendas'] = url_vendas_padrao


    # --- 4. Tipificação do Jogo Terminal Cliente ---
    
    # Tipo Sorteio (int32) - Padrão = 15
    # Nota: A lógica de ler da tabela "eventos" deve ser feita no carregamento (GET). 
    # Aqui no (POST/Gravação), salvamos o que vier ou o padrão 15.
    try:
        t_sorteio = int(data.get('tipo_cartela', 15))
        update_fields['tipo_cartela'] = t_sorteio
    except (ValueError, TypeError):
        update_fields['tipo_cartela'] = 15

    # Tipo Entrada de Cartelas (int32) - Valores: 1 ou 2 (Padrão = 1)
    try:
        t_entrada = int(data.get('tipo_entrada_de_cartelas', 1))
        # Validação extra: Só aceita 1 ou 2. Se for outro número, força 1.
        if t_entrada not in [1, 2]:
            t_entrada = 1
        update_fields['tipo_entrada_de_cartelas'] = t_entrada
    except (ValueError, TypeError):
        update_fields['tipo_entrada_de_cartelas'] = 1
    
    # 1. Tempo Ganhador
    if 'tempo_ganhador' in data:
        try: update_fields['tempo_ganhador'] = int(data['tempo_ganhador'])
        except: pass

    # 2. Modo de Sorteio ('auto' ou 'manual')
    if 'modo_sorteio' in data:
        update_fields['modo_sorteio'] = str(data['modo_sorteio'])

    # 3. Voz Ativa (Boolean)
    if 'voz_ativa' in data:
        update_fields['voz_ativa'] = bool(data['voz_ativa'])
        
    # 4. Câmera Ativa (Boolean)
    if 'camera_ativa' in data:
        update_fields['camera_ativa'] = bool(data['camera_ativa'])

    # 5. Sorteio Automatizado (Boolean)
    if 'sorteio_automatizado' in data:
        update_fields['sorteio_automatizado'] = bool(data['sorteio_automatizado'])

    # 6. Tempo de Espera Pós-Fechamento (Grace Period)
    if 'aviso_fim_das_vendas' in data:
        try: update_fields['aviso_fim_das_vendas'] = int(data['aviso_fim_das_vendas'])
        except: update_fields['aviso_fim_das_vendas'] = 120 # Padrão

    if update_fields:
        try:
            # Atualiza no Banco (Coleção parametros)
            db.parametros.update_one({}, {'$set': update_fields}, upsert=True)
            return jsonify({'status': 'Configurações salvas', 'campos': update_fields})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Nenhum dado válido enviado'}), 400


@app.route('/api/admin/publicar_bola', methods=['POST'])
def publicar_bola():
    try:
        data = request.json
        bola = int(data.get('bola'))
        
        # 1. Busca as bolas que JÁ estavam públicas antes
        dados_atuais = db.bolas.find_one({}) or {}
        lista_publica = dados_atuais.get('bolas_cantadas', [])
        
        # 2. Adiciona a nova bola na lista (se não for repetida)
        if bola not in lista_publica:
            lista_publica.append(bola)
        
        # 3. ATUALIZA o documento existente (Não cria um novo!)
        db.bolas.update_one({}, {
            '$set': {
                'bolas_cantadas': lista_publica,
                'proxima_bola': bola,
                'ordem': len(lista_publica),
                'ultimas_bolas': lista_publica[-3:], # Pega as últimas 3
                'timestamp': datetime.now()
            }
        }, upsert=True)
        
        # 4. Avisa as TVs
        print(f"📢 Enviando bola {bola} para as TVs (Total: {len(lista_publica)})")
        broadcast_para_clientes({
            'type': 'UPDATE',
            'ultimaBola': bola,
            # Opcional: Mandar a lista toda garante que quem reconectar pegue tudo
            'bolasData': [{'bolas_cantadas': lista_publica, 'proxima_bola': bola}]
        })
        
        return jsonify({'status': 'ok'})

    except Exception as e:
        print(f"Erro publicar_bola: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/sortear_mesa', methods=['POST'])
def admin_sortear_mesa():
    global db, timeStart
    if db is None: return jsonify({'error': 'Sem conexão com DB'}), 500
    
    try:
        # Pega dados enviados
        data = request.json or {}
        bola_manual = data.get('bola_manual') 

        # 1. Busca bolas já sorteadas NA MESA (Tabela Interna)
        # --- ALTERADO: Lê da tabela privada da mesa ---
        dados_bolas = db.bolas_mesa.find_one({})
        bolas_cantadas = dados_bolas.get('bolas_cantadas', []) if dados_bolas else []
        
        # Define máximo de bolas (ajuste se for 75 ou 90 conforme sua config global)
        MAX_BOLAS = 90 

        # 2. Verifica fim de jogo
        if len(bolas_cantadas) >= MAX_BOLAS:
            return jsonify({'error': 'Todas as bolas já foram sorteadas'}), 400

        nova_bola = 0

        if bola_manual:
            # --- MODO MANUAL ---
            nova_bola = int(bola_manual)
            if nova_bola < 1 or nova_bola > MAX_BOLAS:
                return jsonify({'error': f'Bola deve ser entre 1 e {MAX_BOLAS}'}), 400
            
            # Valida se já existe na lista da MESA
            if nova_bola in bolas_cantadas:
                return jsonify({'error': f'Bola {nova_bola} já foi registrada na Mesa!'}), 400
        else:
            # --- MODO AUTOMÁTICO (RANDOM) ---
            import random
            todas_bolas = list(range(1, MAX_BOLAS + 1))
            disponiveis = [b for b in todas_bolas if b not in bolas_cantadas]
            if not disponiveis: return jsonify({'error': 'Todas as bolas sorteadas'}), 400
            nova_bola = random.choice(disponiveis)
        
        # 3. Atualiza lista local
        bolas_cantadas.append(nova_bola)

        if len(bolas_cantadas) == 1:
            timeStart = datetime.now()
            print(f"⏰ Jogo Iniciado (Mesa) em: {timeStart.strftime('%H:%M:%S')}")

        # --- ALTERADO: Grava na tabela privada 'bolas_mesa' ---
        db.bolas_mesa.update_one({}, {
            '$set': {
                'bolas_cantadas': bolas_cantadas,
                'proxima_bola': nova_bola,          
                'ordem' : len(bolas_cantadas),
                'ultimas_bolas': bolas_cantadas[-3:]
            }
        }, upsert=True)
        
        # 4. Dispara o Cálculo de Ranking (IMEDIATO)
        # O Admin precisa saber na hora quem ganhou.
        # IMPORTANTE: Sua função 'recalcular_ranking_principal' precisa ser ajustada
        # para ler os números sorteados de 'bolas_mesa' e não de 'bolas'.
        threading.Thread(target=recalcular_ranking_principal).start()

        return jsonify({'bola': nova_bola, 'total_sorteadas': len(bolas_cantadas)})
        
    except Exception as e:
        print(f"Erro ao sortear mesa: {e}")
        return jsonify({'error': str(e)}), 500


# Endpoint para Sortear Bola
@app.route('/api/admin/sortear', methods=['POST'])
def admin_sortear():
    global db, timeStart
    if db is None: return jsonify({'error': 'Sem conexão com DB'}), 500
    
    try:
        # Pega dados enviados (se houver)
        data = request.json or {}
        bola_manual = data.get('bola_manual') # Pode ser None

        # 1. Busca bolas já sorteadas
        dados_bolas = db.bolas.find_one({})
        bolas_cantadas = dados_bolas.get('bolas_cantadas', []) if dados_bolas else []
        
        # 2. Verifica fim de jogo
        if len(bolas_cantadas) >= 90:
            return jsonify({'error': 'Todas as bolas já foram sorteadas'}), 400

        nova_bola = 0

        if bola_manual:
            # --- MODO MANUAL ---
            nova_bola = int(bola_manual)
            if nova_bola < 1 or nova_bola > 90:
                return jsonify({'error': 'Bola deve ser entre 1 e 90'}), 400
            if nova_bola in bolas_cantadas:
                return jsonify({'error': f'Bola {nova_bola} já foi sorteada!'}), 400
        else:
            # --- MODO AUTOMÁTICO (RANDOM) ---
            import random
            todas_bolas = list(range(1, 91))
            disponiveis = [b for b in todas_bolas if b not in bolas_cantadas]
            if not disponiveis: return jsonify({'error': 'Todas as bolas sorteadas'}), 400
            nova_bola = random.choice(disponiveis)
        
        # 3. Atualiza lista
        bolas_cantadas.append(nova_bola)

        if len(bolas_cantadas) == 1:
            timeStart = datetime.now()
            print(f"⏰ Jogo Iniciado em: {timeStart.strftime('%H:%M:%S')}")

        db.bolas.update_one({}, {
            '$set': {
                'bolas_cantadas': bolas_cantadas,
                'proxima_bola': len(bolas_cantadas),  # nova_bola, aquix
                'ordem' : len(bolas_cantadas),
                'ultimas_bolas': bolas_cantadas[-3:]
            }
        }, upsert=True)
        
        threading.Thread(target=recalcular_ranking_principal).start()

        return jsonify({'bola': nova_bola, 'total_sorteadas': len(bolas_cantadas)})
        
    except Exception as e:
        print(f"Erro ao sortear: {e}")
        return jsonify({'error': str(e)}), 500



# --- SUBSTITUIÇÃO DA ROTA ANTIGA DE PRÊMIO ---

# ROTA 1: MESA (Imediata - O Admin vê na hora)
@app.route('/api/admin/definir_premio_mesa', methods=['POST'])
def definir_premio_mesa():
    data = request.json
    nome_premio = data.get('premio')
    if not nome_premio: return jsonify({'error': 'Nome necessário'}), 400
    
    try:
        # Prepara os dados
        update_data = {} 
        update_data['buscando_o_premio'] = nome_premio.upper()
        update_data['buscando_tal_premio'] = nome_premio.upper()
        
        # Lógica de Linhas (Mantida do seu código original)
        tabela_premios = db.premio.find_one({}) or {}
        qtde_linhas = tabela_premios.get('qtde_linha', 1) 
        update_data['qtde_linha'] = qtde_linhas
        
        tipo_jogo = CACHE_JOGO['cartelas'][0].get('tipo', 90) if CACHE_JOGO['cartelas'] else 90
         
        if 'LINHA' in nome_premio.upper() and tipo_jogo == 90:
            if qtde_linhas > 1:
                update_data['buscando_a_linha'] = "SUP,CEN,INF" 
                update_data['buscando_tal_premio'] = f"{qtde_linhas} LINHAS"
            else: 
                 update_data['buscando_a_linha'] = "SUP,CEN,INF"
        elif 'LINHA' in nome_premio.upper() and tipo_jogo == 75:
            update_data['buscando_a_linha'] = "" 
            update_data['buscando_tal_premio'] = 'LINHA'
        else:
            update_data['buscando_a_linha'] = ""
        
        # GRAVA NA TABELA DA MESA (PRIVADA)
        db.buscando_mesa.update_one({}, {'$set': update_data}, upsert=True)

        # Atualiza o Ranking do Admin Imediatamente
        threading.Thread(target=recalcular_ranking_principal).start()
        
        return jsonify({'status': 'OK', 'msg': 'Mesa atualizada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ROTA 2: PÚBLICO (Atrasada - A TV vê depois)
@app.route('/api/admin/definir_premio_publico', methods=['POST'])
def definir_premio_publico():
    data = request.json
    nome_premio = data.get('premio')
    if not nome_premio: return jsonify({'error': 'Nome necessário'}), 400

    try:
        # Repete a lógica para garantir que a tabela pública fique igualzinha à da mesa
        update_data = {} 
        update_data['buscando_o_premio'] = nome_premio.upper()
        update_data['buscando_tal_premio'] = nome_premio.upper()
        
        tabela_premios = db.premio.find_one({}) or {}
        qtde_linhas = tabela_premios.get('qtde_linha', 1) 
        update_data['qtde_linha'] = qtde_linhas
        
        tipo_jogo = CACHE_JOGO['cartelas'][0].get('tipo', 90) if CACHE_JOGO['cartelas'] else 90
       
        if 'LINHA' in nome_premio.upper() and tipo_jogo == 90:
            if qtde_linhas > 1:
                update_data['buscando_a_linha'] = "SUP,CEN,INF" 
                update_data['buscando_tal_premio'] = f"{qtde_linhas} LINHAS"
            else:
                 update_data['buscando_a_linha'] = "SUP,CEN,INF"
        elif 'LINHA' in nome_premio.upper() and tipo_jogo == 75:
            update_data['buscando_a_linha'] = "" 
            update_data['buscando_tal_premio'] = 'LINHA'
        else:
            update_data['buscando_a_linha'] = ""
        
        
        # GRAVA NA TABELA PÚBLICA (OFICIAL)
        db.buscando.update_one({}, {'$set': update_data}, upsert=True)
        
        # AVISA AS TVs
        broadcast_para_clientes({'type': 'UPDATE_PREMIO'})
        
        return jsonify({'status': 'OK', 'msg': 'Público atualizado'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def logica_validacao_bingo_75(cartela_id, cartela_doc, bolas_lista, premio_nome, id_evento_ativo, nome_ganhador):
    """
    Validação Bingo 75 Completa:
    - Verifica Linha, Cantos, Bingo.
    - Gera string visual formatada (01+05*...) para a TV.
    - Calcula valor do prêmio e grava ganhador.
    """
    global db
    
    # 1. BUSCA O LAYOUT
    lista_nums = cartela_doc.get('numeros', []) 
    if not lista_nums:
        lista_nums = cartela_doc.get('lista_75', []) 

    bolas_set = set(bolas_lista)
    ultima_bola = bolas_lista[-1] if bolas_lista else -1
    
    eh_valido = False
    msg_validacao = "Incompleto"
    tag_premio = ""
    status_code = 'LOSS' 

    if not lista_nums or len(lista_nums) < 25:
        return {'status_code': 'ERROR', 'msg': 'Erro: Layout 75 inválido.'} 

    # 2. VALIDAÇÃO DAS REGRAS
    bateu_cantos = False
    bateu_linha = False
    bateu_bingo = False
    detalhes_msg = []
    tags_vitoria = []

    # Bingo Cheio
    alvo_geral = set(lista_nums) - {0}
    if len(alvo_geral - bolas_set) == 0:
        bateu_bingo = True

    # 4 Cantos
    alvo_cantos = {lista_nums[0], lista_nums[4], lista_nums[20], lista_nums[24]} - {0}
    if len(alvo_cantos - bolas_set) == 0:
        bateu_cantos = True

    # Linha (Colunas no array = Linhas Visuais)
    linhas_indices = [
        [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24]
    ]
    for idxs in linhas_indices:
        linha_set = {lista_nums[i] for i in idxs} - {0}
        if len(linha_set - bolas_set) == 0:
            bateu_linha = True
            break

    # 3. DECISÃO DO PRÊMIO
    if 'BINGO' == premio_nome or 'ACUMULADO' in premio_nome:
        if bateu_bingo:
            eh_valido, msg_validacao, tag_premio = True, "BINGO (Cartela Cheia)!", "BINGO"
        else:
            msg_validacao = f"Faltam {len(alvo_geral - bolas_set)} p/ Bingo."
    else:
        if bateu_cantos: 
            detalhes_msg.append("4 CANTOS")
            tags_vitoria.append("4 CANTOS")
        if bateu_linha: 
            detalhes_msg.append("LINHA")
            tags_vitoria.append("LINHA")
        
        if detalhes_msg:
            eh_valido = True
            msg_validacao = " E ".join(detalhes_msg) + " CONFIRMADO!"
            tag_premio = " E ".join(tags_vitoria)
        else:
            msg_validacao = "Incompleta p/ Linha ou Cantos."

    status_code = 'WIN' if eh_valido else 'LOSS'

    # 4. GERAÇÃO DA STRING VISUAL (PARA A TV CONFERE)
    # Transforma indices de Coluna (0,1,2...) para Ordem Visual de Linha (0,5,10...)
    ordem_visual = [
        0, 5, 10, 15, 20,
        1, 6, 11, 16, 21,
        2, 7, 12, 17, 22,
        3, 8, 13, 18, 23,
        4, 9, 14, 19, 24
    ]
    numeros_visual_ordem = [lista_nums[i] for i in ordem_visual]
    
    str_numeros_formatada = ""
    for i, num in enumerate(numeros_visual_ordem):
        num_str = f"{num:02d}"
        separador = " " 
        
        if i > 0:
            if num == ultima_bola:
                separador = "*" # Última bola (piscar)
            elif num in bolas_set or num == 0: 
                separador = "+" # Já sorteado ou Free
        
        if i == 0: str_numeros_formatada += num_str
        else: str_numeros_formatada += separador + num_str

    # 5. GRAVAÇÃO NA TV (CONFERE)
    db.confere.delete_many({})
    db.confere.insert_one({
        "rodada": int(id_evento_ativo), 
        "cartao": cartela_id,
        "numeros": str_numeros_formatada,    # AQUI VAI A STRING FORMATADA (05+10*22...)
        "mensagem": msg_validacao,        # A mensagem de texto vai num campo separado
        "ganhador": nome_ganhador, 
        "status": "conferindo"
    })
    
    # 6. GRAVAÇÃO DO GANHADOR COM VALORES
    if eh_valido:
        # Busca Valor do Prêmio
        val_total_float = 0.0
        try:
            tabela_premios = db.premio.find_one({}) or {}
            chave_simples = 'LINHA' if 'LINHA' in tag_premio.upper() else ('QUADRA' if 'CANTOS' in tag_premio.upper() else tag_premio)
            
            # Mapeamento para os campos do banco
            chave_premio_map = {
                '4 CANTOS': 'premio_quadra', 'QUADRA': 'premio_quadra', 
                'LINHA': 'premio_linha', 'BINGO': 'premio_bingo', 
                'DUPLO BINGO': 'premio_duplo_bingo'
            }
            campo_valor = chave_premio_map.get(chave_simples)
            
            if campo_valor:
                # Assume que converter_decimal existe no escopo global do server.py
                val_total_float = converter_decimal(tabela_premios.get(campo_valor)) 
        except Exception as e_val:
            print(f"⚠️ Erro valor prêmio: {e_val}")
            
        # Formata valor (Assume que format_brl existe)
        try:
            str_total = f"R$ {format_brl(val_total_float)}"
        except:
            str_total = f"R$ {val_total_float:.2f}".replace('.', ',')

        # Verifica duplicidade antes de inserir
        if not db.ganhadores.find_one({'cartela': cartela_id, 'premio': tag_premio}):
            db.ganhadores.insert_one({
                'premio': tag_premio,
                'valor_total_premio': str_total,
                'cartela': cartela_id,
                'nome': nome_ganhador,
                'valor_rateio': str_total, # Rateio pode ser ajustado depois se houver mais ganhadores
                'linha_ganha_tag': tag_premio,
                'hora': datetime.now().strftime("%H:%M:%S")
            })

    return {
        'status_code': status_code,
        'valid': eh_valido,
        'msg': msg_validacao,
        'ganhador': nome_ganhador,
        'cartela_id': cartela_id,
        'bolas': list(bolas_set)
    }


@app.route('/api/admin/validar_cartela_75', methods=['POST'])
def admin_validar_cartela_75():
    global db
    if db is None: return jsonify({'status_code': 'ERROR', 'msg': 'Sem conexão DB'})
    
    data = request.json or {}
    raw_cartela = data.get('cartela')
    
    try: cartela_id = int(raw_cartela)
    except: return jsonify({'status_code': 'ERROR', 'msg': 'Número de cartela inválido'})
    
    try:
        # 1. Dados Iniciais
        rodada_info = db.rodada.find_one({})
        id_evento_ativo = rodada_info.get('id_evento') if rodada_info else 0
        
        # 2. Venda e Ganhador (Lógica simplificada, adaptada do bloco 90)
        try: sales_db = get_sales_db_connection()
        except: sales_db = None
            
        nome_ganhador = "Desconhecido"
        col_vendas_name = f"vendas{id_evento_ativo}"
        
        if sales_db is not None and col_vendas_name in sales_db.list_collection_names():
             venda_encontrada = sales_db[col_vendas_name].find_one({
                '$or': [
                    { 'numero_inicial': {'$lte': cartela_id}, 'numero_final': {'$gte': cartela_id} },
                    { 'numero_inicial2': {'$lte': cartela_id}, 'numero_final2': {'$gte': cartela_id} }
                ]
             })
             if not venda_encontrada:
                  return jsonify({'status_code': 'NOT_SOLD', 'msg': f'⛔ Cartela {cartela_id} NÃO VENDIDA!'})
             nome_ganhador = venda_encontrada.get('nome_cliente', 'Cliente Balcão')

        # 3. Busca Layout

        cartela_doc = db.cartelas.find_one({'cartao': cartela_id})
        if not cartela_doc: 
            return jsonify({'status_code': 'MISSING_MATRIX', 'msg': 'Layout não cadastrado.'})

        # 4. Dados do Jogo
        dados_bolas = db.bolas.find_one({})
        bolas_lista = dados_bolas.get('bolas_cantadas', []) if dados_bolas else []
        premio_doc = db.buscando.find_one({})
        premio_nome = premio_doc.get('buscando_o_premio', '').replace(" ", "").upper()
        
        # 5. Chama a Lógica de Validação 75
        resultado = logica_validacao_bingo_75(cartela_id, cartela_doc, bolas_lista, premio_nome, id_evento_ativo, nome_ganhador)
      
        return jsonify(resultado)

    except Exception as e:
        print(f"❌ Erro Fatal Validação 75 Rota: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status_code': 'ERROR', 'msg': str(e)}), 500


@app.route('/api/admin/validar_cartela', methods=['POST'])
def admin_validar_cartela():
    global db
    print("📥 [VALIDAÇÃO] Recebendo requisição...") # Log para debug
    
    if db is None: 
        print("❌ Erro: DB desconectado.")
        return jsonify({'status_code': 'ERROR', 'msg': 'Sem conexão DB'})
    
    data = request.json or {}
    raw_cartela = data.get('cartela')
    
    try: cartela_id = int(raw_cartela)
    except: return jsonify({'status_code': 'ERROR', 'msg': 'Número de cartela inválido'})
    
    try:
        # 1. IDENTIFICA O EVENTO ATIVO
        rodada_info = db.rodada.find_one({})
        id_evento_ativo = rodada_info.get('id_evento') if rodada_info else 0
        
        if not id_evento_ativo:
             return jsonify({'status_code': 'ERROR', 'msg': 'Nenhum evento ativo.'})

        # 2. VERIFICA SE A CARTELA FOI VENDIDA
        # (Tenta importar a função de conexão, se não existir, define None)
        try: sales_db = get_sales_db_connection()
        except: sales_db = None
            
        col_vendas_name = f"vendas{id_evento_ativo}"
        venda_encontrada = None
        
        if sales_db is not None and col_vendas_name in sales_db.list_collection_names():
             venda_encontrada = sales_db[col_vendas_name].find_one({
                '$or': [
                    { 'numero_inicial': {'$lte': cartela_id}, 'numero_final': {'$gte': cartela_id} },
                    { 'numero_inicial2': {'$lte': cartela_id}, 'numero_final2': {'$gte': cartela_id} }
                ]
             })
        
        if not venda_encontrada:
            return jsonify({
                'status_code': 'NOT_SOLD', 
                'msg': f'⛔ Cartela {cartela_id} NÃO VENDIDA!',
                'layout': None
            })

        nome_ganhador = venda_encontrada.get('nome_cliente', 'Cliente Balcão')

        # 3. BUSCA O LAYOUT NO BANCO
        cartela_doc = db.cartelas.find_one({'cartao': cartela_id})
        if not cartela_doc: 
            return jsonify({'status_code': 'MISSING_MATRIX', 'msg': 'Layout não cadastrado.'})

        # --- DADOS GERAIS DO JOGO ---
        # a dados_bolas = db.bolas.find_one({})

        dados_bolas = db.bolas_mesa.find_one({})
        bolas_lista = dados_bolas.get('bolas_cantadas', []) if dados_bolas else []
        bolas_set = set(bolas_lista)
        
        premio_doc = db.buscando_mesa.find_one({})
        premio_nome = premio_doc.get('buscando_o_premio', '').replace(" ", "").upper()

        #print(f"ℹ️ Validando Bingo 90 - Bolas  {dados_bolas}")

        #print(f"ℹ️ Validando Bingo 90 - Premio {premio_nome}")
        
        #print(f"ℹ️ Validando Bingo 90 - Cartela {cartela_id}")
        def parse(val):
            if isinstance(val, list): return set(val)
            if isinstance(val, str): return set(map(int, val.replace(' ','').split(',')))
            return set()

        sup_set = parse(cartela_doc.get('superior'))
        cen_set = parse(cartela_doc.get('central'))
        inf_set = parse(cartela_doc.get('inferior'))
        todos_set = sup_set | cen_set | inf_set

        # Formatação Visual
        ultima_bola = bolas_lista[-1] if bolas_lista else -1
        lista_sup, lista_cen, lista_inf = sorted(list(sup_set)), sorted(list(cen_set)), sorted(list(inf_set))
            
        numeros_visual_ordem = lista_sup + lista_cen + lista_inf
        str_numeros_formatada = ""
        for i, num in enumerate(numeros_visual_ordem):
            num_str = f"{num:02d}"
            separador = " " 
            if i > 0:
                if num == ultima_bola: separador = "*" 
                elif num in bolas_set: separador = "+"
            str_numeros_formatada += separador + num_str
           
        # TV Confere
        db.confere.delete_many({})
        db.confere.insert_one({
            "rodada": int(id_evento_ativo), "cartao": cartela_id,
            "numeros": str_numeros_formatada, "ganhador": nome_ganhador, "status": "conferindo"
        })
            
        # Regras 90
        bateu, detalhes, linha_ganha = False, "", ""
        linhas_faltantes = premio_doc.get('buscando_a_linha', '').upper()

        if 'DUPLO' in premio_nome or 'SEGUNDO' in premio_nome:
            ja_ganhou_bingo = db.ganhadores.find_one({'cartela': cartela_id, 'premio': 'BINGO'})
            if ja_ganhou_bingo:
                return jsonify({'status_code': 'LOSS', 'msg': 'Cartela já fez o 1º Bingo.'})
            
        if 'BINGO' in premio_nome or 'ACUMULADO' in premio_nome or 'DUPLO' in premio_nome:
            faltam = todos_set - bolas_set
            bateu = (len(faltam) == 0)
            detalhes = "BINGO!" if bateu else f"Faltam: {len(faltam)}"

        elif 'LINHA' in premio_nome:
            check_sup = len(sup_set - bolas_set) == 0
            check_cen = len(cen_set - bolas_set) == 0
            check_inf = len(inf_set - bolas_set) == 0
                
            if check_sup and ('SUP' in linhas_faltantes or not linhas_faltantes):
                bateu, detalhes, linha_ganha = True, "Linha SUPERIOR!", "Sup"
            elif check_cen and ('CEN' in linhas_faltantes or not linhas_faltantes):
                bateu, detalhes, linha_ganha = True, "Linha CENTRAL!", "Cen"
            elif check_inf and ('INF' in linhas_faltantes or not linhas_faltantes):
                bateu, detalhes, linha_ganha = True, "Linha INFERIOR!", "Inf"
            else:
                bateu, detalhes = False, "Linha incompleta."

        elif 'QUADRA' in premio_nome:
            s, c, i = len(sup_set & bolas_set), len(cen_set & bolas_set), len(inf_set & bolas_set)
            if s>=4 or c>=4 or i>=4: bateu, detalhes = True, "QUADRA!"
            else: bateu, detalhes = False, "Sem quadra."

        elif 'FALTA' in premio_nome:
            faltam = todos_set - bolas_set
            bateu = (len(faltam) == 1)
            detalhes = "Falta 1!" if bateu else f"Faltam {len(faltam)}."
        else:
            bateu, detalhes = True, "Validação Visual."

        status_code = 'WIN' if bateu else 'LOSS'

        if bateu:
            premio_registro = f"{premio_nome} ({linha_ganha})" if linha_ganha else premio_nome
            if not db.ganhadores.find_one({'cartela': cartela_id, 'premio': premio_registro}):
                valor_monetario = "R$ --"
                try:
                    tabela_premios = db.premio.find_one({}) or {}
                    campo_valor = ''
                    if 'QUADRA' in premio_nome: campo_valor = 'premio_quadra'
                    elif 'LINHA' in premio_nome: campo_valor = 'premio_linha'
                    elif 'BINGO' in premio_nome: campo_valor = 'premio_bingo'
                    elif 'DUPLO' in premio_nome: campo_valor = 'premio_duplo_bingo'
                    elif 'ACUMULADO' in premio_nome: campo_valor = 'premio_acumulado'
                    if campo_valor:
                         raw_val = float(str(tabela_premios.get(campo_valor, 0)))
                         valor_monetario = f"R$ {raw_val:,.2f}".replace('.', ',')
                except: pass

                db.ganhadores.insert_one({
                    'premio': premio_registro,
                    'valor_total_premio': valor_monetario,
                    'cartela': cartela_id,
                    'nome': nome_ganhador,
                    'valor_rateio': valor_monetario,
                    'linha_ganha_tag': linha_ganha
                })

        return jsonify({
            'status_code': status_code,
            'valid': bateu,
            'msg': detalhes,
            'ganhador': nome_ganhador,
            'cartela_id': cartela_id,
            'layout': {'superior': lista_sup, 'central': lista_cen, 'inferior': lista_inf},
            'bolas': list(bolas_set)
        })

    except Exception as e:
        print(f"❌ Erro Fatal Validação: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status_code': 'ERROR', 'msg': str(e)}), 500



# --- ROTA: ATUALIZAR LINHAS RESTANTES (RESOLVE O PROBLEMA DE LINHA REPETIDA) ---
@app.route('/api/admin/atualizar_linhas_restantes', methods=['POST'])
def atualizar_linhas():
    # Esta função verifica os ganhadores da rodada e remove as linhas ganhas da lista de busca
    try:
        premio_doc = db.buscando.find_one({})
        premio_nome = premio_doc.get('buscando_o_premio', '')
        
        if 'LINHA' not in premio_nome:
            return jsonify({'status': 'Ignored'})

        # Busca todas as linhas já registradas
        ganhadores_linha = list(db.ganhadores.find({'premio': {'$regex': 'LINHA'}}))
        
        linhas_ganhas_tags = set()
        for g in ganhadores_linha:
            # Ex: 'LINHA (SUP)' -> 'SUP'
            tag = g.get('linha_ganha_tag')
            if tag: linhas_ganhas_tags.add(tag.upper())
            
        # Linhas iniciais
        lista_busca = ['SUP', 'CEN', 'INF']
        
        # --- CORREÇÃO: VERIFICA QUANTAS LINHAS ESTÃO EM JOGO ---
        tabela_premios = db.premio.find_one({}) or {}
        qtde_linhas_jogo = int(tabela_premios.get('qtde_linha', 1))

        nova_lista = []

        # Se o jogo é de 1 linha e já saiu alguma, limpa tudo.
        if qtde_linhas_jogo == 1 and len(linhas_ganhas_tags) > 0:
             nova_lista = []
        else:
             # Se for 2 ou 3 linhas, remove apenas as que saíram
             nova_lista = [l for l in lista_busca if l not in linhas_ganhas_tags]
        # -------------------------------------------------------
        
        novo_texto = ",".join(nova_lista)
        db.buscando.update_one({}, {'$set': {'buscando_a_linha': novo_texto}})
        db.buscando_mesa.update_one({}, {'$set': {'buscando_a_linha': novo_texto}})
        
        return jsonify({'status': 'Updated', 'restantes': novo_texto})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- ADICIONE ESTA NOVA ROTA PARA LIMPAR A TELA ---
@app.route('/api/admin/limpar_conferencia', methods=['POST'])
def admin_limpar_conferencia():
    if db is None: return jsonify({'error': 'DB Offline'}), 500
    
    try:
        # Pega o ID do evento atual para manter a consistência
        rodada_info = db.rodada.find_one({})
        id_evento = rodada_info.get('id_evento', 0) if rodada_info else 0
        
        db.confere.delete_many({})
        db.confere.insert_one({
            "rodada": int(id_evento),
            "cartao": 0,
            "numeros": "null",
            "ganhador": "null"
        })
        return jsonify({'status': 'Conferencia limpa'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- SUBSTITUA A FUNÇÃO admin_resetar POR ESTA VERSÃO CORRIGIDA ---
@app.route('/api/admin/resetar', methods=['POST'])
def admin_resetar():
    global db, timeStart # <--- IMPORTANTE: Chamar a global timeStart
    if db is None: return jsonify({'error': 'Sem conexão com DB'}), 500
    try:
        # --- 0. PREPARAÇÃO DE DADOS GERAIS ---
        rodada_info = db.rodada.find_one({}) or {}
        # Proteção contra ID Nulo
        raw_id = rodada_info.get('id_evento')
        id_evento = int(raw_id) if raw_id else 0
        # Dados das Bolas
        dados_bolas = db.bolas_mesa.find_one({}) or {}
        bolas_lista = dados_bolas.get('bolas_cantadas', [])
        total_bolas = len(bolas_lista)
        # Dados de Tempo
        now = datetime.now()
        data_hoje = now.strftime("%d/%m/%Y")
        hora_atual = now.strftime("%H:%M")
        # --- LÓGICA DA HORA INICIAL ---
        # Se timeStart foi gravado (jogo começou), usa ele. Senão, usa hora atual.
        if timeStart:
            hora_inicial = timeStart.strftime("%H:%M")
        else:
            hora_inicial = hora_atual 
        # ------------------------------
        # --- 1. PROCESSAMENTO DOS GANHADORES (Igual ao anterior) ---
        ganhadores_ativos = list(db.ganhadores.find({}))
        
        tabela_premios = db.premio.find_one({}) or {}

        lista_osganhadores = []      
        lista_resultados_ganhadores = [] 
        if ganhadores_ativos	:
            grupos_rateio = {}
            for g in ganhadores_ativos:
                raw_premio = g.get('premio', '').upper()
                
                # Agrupamento
                chave_base = raw_premio
                if 'LINHA' in raw_premio: chave_base = "LINHA"
                elif 'DUPLO' in raw_premio or 'SEGUNDO' in raw_premio: chave_base = "DUPLO BINGO"
                elif 'BINGO' in raw_premio: chave_base = "BINGO"
                elif 'QUADRA' in raw_premio: chave_base = "QUADRA"
                elif 'FALTA' in raw_premio: chave_base = "FALTA UM"
                elif 'ACUMULADO' in raw_premio: chave_base = "ACUMULADO" # Adicionado caso tenha
                
                if chave_base not in grupos_rateio: grupos_rateio[chave_base] = []
                grupos_rateio[chave_base].append(g)

            # Calcula Rateios usando a tabela de prêmios oficial
            for chave, lista_vencedores in grupos_rateio.items():
                qtde_ganhadores = len(lista_vencedores)
                
                # 1. Determina qual campo do banco pegar baseado na chave
                val_total_float = 0.0
                
                if chave == "QUADRA":
                    val_total_float = converter_decimal(tabela_premios.get('premio_quadra'))
                elif chave == "LINHA":
                    val_total_float = converter_decimal(tabela_premios.get('premio_linha'))
                elif chave == "BINGO":
                    val_total_float = converter_decimal(tabela_premios.get('premio_bingo'))
                elif chave == "DUPLO BINGO":
                    val_total_float = converter_decimal(tabela_premios.get('premio_duplo_bingo'))
                elif chave == "FALTA UM":
                    val_total_float = converter_decimal(tabela_premios.get('premio_falta_Um'))
                elif chave == "ACUMULADO":
                    val_total_float = converter_decimal(tabela_premios.get('premio_acumulado'))
                
                # Fallback: Se não achou na tabela, tenta pegar do registro do ganhador (último recurso)
                if val_total_float == 0.0 and len(lista_vencedores) > 0:
                     val_str_temp = lista_vencedores[0].get('valor_total_premio', '0')
                     val_total_float = parse_brl(val_str_temp)

                # 2. Faz a divisão matemática
                val_rateio_float = val_total_float / qtde_ganhadores if qtde_ganhadores > 0 else 0
                
                # 3. Formata para String (R$)
                str_total = f"R$ {format_brl(val_total_float)}"
                str_rateio = f"R$ {format_brl(val_rateio_float)}"

                db.ganhadores.update_many(
                    {'_id': {'$in': [w['_id'] for w in lista_vencedores]}},
                    {'$set': {
                        'valor_total_premio': str_total,
                        'valor_rateio': str_rateio
                    }}
                )
                
                for w in lista_vencedores:
                    nome_final_premio = w.get('premio', chave)
                    
                    # Formata nome da linha
                    if 'LINHA' in chave:
                        if '(SUP)' in nome_final_premio.upper(): nome_final_premio = "LINHA SUPERIOR"
                        elif '(CEN)' in nome_final_premio.upper(): nome_final_premio = "LINHA CENTRAL"
                        elif '(INF)' in nome_final_premio.upper(): nome_final_premio = "LINHA INFERIOR"
                        else: nome_final_premio = "LINHA"

                    obj_ganhador = {
                        "premio": nome_final_premio,
                        "valor_total_premio": str_total, # Agora vem da tabela premio
                        "cartela": str(w.get('cartela', '0')),
                        "nome": str(w.get('nome', '---')),
                        "valor_rateio": str_rateio       # Calculado agora
                    }
                    
                    item_local = obj_ganhador.copy()
                    item_local['rodada'] = id_evento
                    lista_osganhadores.append(item_local)
                    lista_resultados_ganhadores.append(obj_ganhador)
        # --- 2. GRAVAÇÃO LOCAL 'osganhadores' ---
        db.osganhadores.delete_many({})
        if lista_osganhadores:
            db.osganhadores.insert_many(lista_osganhadores)
            print(f"✅ 'osganhadores' atualizada: {len(lista_osganhadores)} registros.")
        # --- 3. GRAVAÇÃO REMOTA 'resultados' (COM CONDIÇÃO) ---
        # Só grava se tiver bolas sorteadas E tiver ganhadores na lista
        if total_bolas > 0 and len(lista_resultados_ganhadores) > 0:
            try:
                sales_db = get_sales_db_connection()
                if sales_db is not None:
                    doc_resultado = {
                        "id_evento": id_evento,
                        "data_evento": data_hoje,
                        "hora_inicial": hora_inicial, # Usa a hora capturada no sortear
                        "hora_final": hora_atual,
                        "total_de_bolas": total_bolas,
                        "bolas_sorteadas": str(bolas_lista), 
                        "ganhadores": lista_resultados_ganhadores
                    }
                    sales_db.resultados.insert_one(doc_resultado)
                    print(f"✅ Histórico salvo no Sales DB (Hora Início: {hora_inicial}).")
                else:
                    print("⚠️ Conexão Sales DB retornou None.")
            except Exception as e_sales:
                print(f"⚠️ Erro não-fatal ao salvar Sales DB: {e_sales}")
        else:
            print(f"ℹ️ Histórico NÃO salvo (Bolas: {total_bolas}, Ganhadores: {len(lista_resultados_ganhadores)}).")
        # --- 4. LIMPEZA (RESET) ---
        timeStart = None # <--- RESETA A HORA INICIAL PARA O PRÓXIMO JOGO
        
        db.bolas.update_one({}, {'$set': {'bolas_cantadas': [], 'proxima_bola': "--", 'ultimas_bolas': []}}, upsert=True)
        db.bolas_mesa.update_one({}, {'$set': {'bolas_cantadas': [], 'proxima_bola': "--", 'ultimas_bolas': []}}, upsert=True)
        db.ganhadores.delete_many({})
        db.melhores.delete_many({})
        db.confere.delete_many({})
        db.confere.insert_one({
            "rodada": int(id_evento),
            "cartao": 0,
            "numeros": "null",
            "ganhador": "null"
        })
        db.rodada.update_one({}, {'$set': {'estado': 'intervalo', 'ordem': 0}}, upsert=True)
        return jsonify({'status': 'Reset concluído com sucesso'})
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

#
# --- ROTA DE DETALHES (COM SINCRONIZAÇÃO AUTOMÁTICA DE CARTELAS) ---
@app.route('/api/admin/detalhes_evento', methods=['GET'])
def get_event_details():
    id_evt = request.args.get('id_evento')
    if not id_evt: return jsonify({'error': 'ID necessário'}), 400

    sales_db = get_sales_db_connection()
    if sales_db is None: return jsonify({'error': 'DB Vendas Offline'}), 500

    try:
        # Busca evento
        evento = None
        try: evento = sales_db.eventos.find_one({'id_evento': int(id_evt)})
        except: pass
        if not evento: evento = sales_db.eventos.find_one({'id_evento': str(id_evt)})
        
        if not evento: return jsonify({'error': 'Evento não encontrado'}), 404

        # === NOVO: SINCRONIZAÇÃO DA BASE DE CARTELAS ===
        # Pega os dados do evento para verificar o arquivo
        num_max_evento = evento.get('numero_maximo', 72000)
        tipo_cartela_evento = evento.get('tipo_de_cartela', 15)
        
        # Chama a função de verificação (em Thread para não travar a resposta da API se o arquivo for grande)
        # Se preferir que o usuário espere o carregamento para garantir, remova o Threading.
        # Recomendo deixar SEM thread aqui para garantir que ao carregar a tela, a base já esteja certa.
        verificar_e_sincronizar_cartelas(num_max_evento, tipo_cartela_evento)
        # ===============================================

        col_vendas_name = f"vendas{id_evt}"
        qtde_vendida = 0
        ultimo_cartao = 0
        soma_vendas_reais = 0
        vendas_detalhadas = [] 

        # 1. Tenta buscar estatísticas se a coleção existir
        if col_vendas_name in sales_db.list_collection_names():
            col_vendas = sales_db[col_vendas_name]
            
            # Agregação para totais
            pipeline = [
                {
                    '$group': {
                        '_id': None,
                        'total_qtd': { '$sum': { '$add': [{ '$subtract': ['$numero_final', '$numero_inicial'] }, 1] } },
                        'max_cartao': { '$max': '$numero_final' },
                        'soma_valor': { '$sum': '$valor_total' }
                    }
                }
            ]
            resultado = list(col_vendas.aggregate(pipeline))
            if resultado:
                qtde_vendida = resultado[0].get('total_qtd', 0)
                ultimo_cartao = resultado[0].get('max_cartao', 0)
                soma_vendas_reais = resultado[0].get('soma_valor', 0)

        # TRAVA DE SEGURANÇA
        if qtde_vendida == 0:
            print(f"⛔ Evento {id_evt} bloqueado: 0 vendas.")
            return jsonify({
                'error': 'EVENTO VAZIO: Nenhuma cartela vendida encontrada para este evento. O sorteio não pode ser iniciado.'
            }), 400

        # 2. Busca detalhes das vendas
        if col_vendas_name in sales_db.list_collection_names():
            col_vendas = sales_db[col_vendas_name]
            cursor_detalhes = col_vendas.find({}, {
                'numero_inicial': 1, 'numero_final': 1, 
                'numero_inicial2': 1, 'numero_final2': 1,
                'id_cliente': 1, 'nome_cliente': 1, 'telefone_cliente': 1,
                'id_colaborador': 1
            })
            
            for v in cursor_detalhes:
                qtd = (v.get('numero_final', 0) - v.get('numero_inicial', 0)) + 1
                if v.get('numero_inicial2'):
                     qtd += (v.get('numero_final2', 0) - v.get('numero_inicial2', 0)) + 1

                vendas_detalhadas.append({
                    'inicio': v.get('numero_inicial'),
                    'fim': v.get('numero_final'),
                    'inicio2': v.get('numero_inicial2'),
                    'fim2': v.get('numero_final2'),
                    'qtd': qtd,
                    'id_cliente': v.get('id_cliente'),
                    'nome': v.get('nome_cliente'),
                    'tel': v.get('telefone_cliente'),
                    'colab': v.get('id_colaborador')
                })

        # Monta Resposta Frontend
        response_data = {
            'descricao': evento.get('descricao'),
            'data_evento': evento.get('data_evento'),
            'hora_evento': evento.get('hora_evento'),
            'unidade_venda': evento.get('unidade_de_venda'),
            'valor_venda': converter_decimal(evento.get('valor_de_venda')),
            'tipo_cartela': evento.get('tipo_de_cartela'),
            'numero_inicial': evento.get('numero_inicial', 0),
            'qtde_vendida': qtde_vendida,
            'ultimo_cartao': ultimo_cartao,
            'total_vendas_reais': converter_decimal(soma_vendas_reais),
            'vendas_detalhadas': vendas_detalhadas,
            'premios': {
                'quadra': converter_decimal(evento.get('premio_quadra')),
                'linha': converter_decimal(evento.get('premio_linha')),
                'qtde_linhas': evento.get('quantidade_de_linhas', 0),
                'falta_um': converter_decimal(evento.get('premio_faltaum')),
                'bingo': converter_decimal(evento.get('premio_bingo')),
                'segundo_bingo': converter_decimal(evento.get('premio_segundobingo')),
                'acumulado': converter_decimal(evento.get('premio_acumulado')),
                'bola_tope': evento.get('bola_tope_acumulado', 0),
                'total': converter_decimal(evento.get('premio_total'))
            }
        }
        
        # Atualiza Banco Principal
        if db is not None:
             db.parametros.update_one({}, {'$set': {
                'nome_sala': response_data['descricao'],
                # Nota: 'tipo_sorteio' já foi atualizado pela função de sincronização se necessário,
                # mas não faz mal garantir aqui ou deixar a função cuidar disso.
                # A função verificar_e_sincronizar_cartelas cuida do 'arquivo_de_cartela' e 'tipo_sorteio'
            }}, upsert=True)
             
             db.rodada.update_one({}, {'$set': {'id_evento': id_evt}}, upsert=True)
             
             db.premio.delete_many({})
             
             serie_max = evento.get('numero_maximo', 72000) 
             
             db.premio.insert_one({
                 'premio_quadra': response_data['premios']['quadra'],
                 'premio_linha': response_data['premios']['linha'],
                 'qtde_linha': response_data['premios']['qtde_linhas'] or 1,
                 'premio_falta_Um': response_data['premios']['falta_um'],
                 'premio_bingo': response_data['premios']['bingo'],
                 'premio_duplo_bingo': response_data['premios']['segundo_bingo'],
                 'premio_acumulado': response_data['premios']['acumulado'],
                 'bola_tope_ac': response_data['premios']['bola_tope'],
                 'preco': response_data['valor_venda'],
                 'multiplo': response_data['unidade_venda'],
                 'rodada': id_evt,
                 'serie_em_jogo': serie_max,
                 'minimo_de_cartelas': 1,
                 'maximo_de_cartelas': 6000,
                 'inicial1': 1,
                 'final1': serie_max,
                 'total_cartelas_em_jogo': qtde_vendida
             })

             threading.Thread(target=carregar_cache_evento, args=(id_evt, sales_db)).start()

        return jsonify(response_data)

    except Exception as e:
        print(f"Erro Detalhes: {e}")
        return jsonify({'error': str(e)}), 500


# --- ROTA FALTANTE: BUSCAR CARTELAS POR FAIXA ---
@app.route('/api/cartelas', methods=['POST'])
def get_cartelas_game():
    # Pega a lista de faixas enviada pelo frontend
    # Ex: [{'inicial': 1, 'final': 100}, {'inicial': 500, 'final': 600}]
    ranges = request.json.get('ranges', [])
    
    if not ranges: 
        return jsonify([]), 400
    
    if is_local_mode:
        # Se estiver em modo local (sem banco), retorna vazio ou lógica de arquivo
        return jsonify([]) 
    else:
        if db is None: 
            return jsonify({'error': 'Sem conexão com DB'}), 500
            
        try:
            # Cria uma query do MongoDB usando o operador $or para buscar múltiplas faixas
            # Lê-se: "Busque onde (cartao >= inicial E cartao <= final) OU (próxima faixa...)"
            query = {'$or': [{'cartao': {'$gte': int(r['inicial']), '$lte': int(r['final'])}} for r in ranges]}
            
            # Busca as cartelas no banco principal (db.cartelas)
            # AVISO: Se for muita cartela, pode demorar. O ideal é o frontend pedir faixas razoáveis.
            cursor = db.cartelas.find(query)
            cartelas_encontradas = list(cursor)
            
            # Converte o ObjectId do Mongo para string para não dar erro no JSON
            for c in cartelas_encontradas:
                c['_id'] = str(c['_id'])
            
            return jsonify(cartelas_encontradas)
            
        except Exception as e:
            print(f"❌ Erro ao buscar cartelas: {e}")
            return jsonify({'error': str(e)}), 500



@app.route('/api/admin/preparar_evento', methods=['POST'])
def admin_preparar_evento():
    """
    Rota chamada ANTES de iniciar o timer.
    Objetivo: Identificar o tipo do evento e trocar a base de cartelas (JSON) imediatamente.
    """
    data = request.json or {}
    id_evt = data.get('id_evento')
    
    if not id_evt: return jsonify({'error': 'ID do evento necessário'}), 400

    print(f"🔄 Preparando ambiente para o Evento {id_evt}...")

    # 1. Conecta no Banco de Vendas para ler a configuração do evento
    sales_db = get_sales_db_connection()
    if sales_db is None: 
        return jsonify({'error': 'Sem conexão com DB Vendas'}), 500

    try:
        # Busca o evento (int ou str)
        evento = sales_db.eventos.find_one({'id_evento': int(id_evt)})
        if not evento: evento = sales_db.eventos.find_one({'id_evento': str(id_evt)})
        
        if not evento: 
            return jsonify({'error': 'Evento não encontrado'}), 404

        # 2. Extrai as configurações de cartela
        # Padrão: 72000 cartelas e Tipo 15 (Bingo 90) se não estiver definido
        num_max = evento.get('numero_maximo', 72000)
        tipo_cartela = evento.get('tipo_de_cartela', 15)
        
        print(f"📂 Evento pede: Arquivo {num_max} | Tipo {tipo_cartela}")

        # 3. Executa a Troca de Arquivo (Sincronização)
        # Chamamos a função que já existe no seu código, mas de forma síncrona (sem Thread)
        # para garantir que o frontend espere terminar.
        verificar_e_sincronizar_cartelas(num_max, tipo_cartela)
        
        # 4. Já atualiza os parâmetros globais para os terminais detectarem a mudança
        if db is not None:
             db.parametros.update_one({}, {'$set': {
                'tipo_sorteio': int(tipo_cartela),
                'arquivo_de_cartela': int(num_max),
                # Atualiza também o nome da sala se possível, para já mudar no header do cliente
                'nome_sala': evento.get('descricao', 'Sorteio')
            }}, upsert=True)

        return jsonify({'status': 'ok', 'msg': 'Base de cartelas sincronizada com sucesso.'})

    except Exception as e:
        print(f"❌ Erro ao preparar evento: {e}")
        return jsonify({'error': str(e)}), 500


# --- MAIN ---
def main():
    connect_main_db()
    
    t = threading.Thread(target=watch_collections, daemon=True)
    t.start()
    
    print(f"🚀 Servidor Single-Tenant rodando na porta {port}")
    server = WSGIServer(('0.0.0.0', port), websocket_app, handler_class=WebSocketHandler)
    try: server.serve_forever()
    except KeyboardInterrupt: pass

if __name__ == '__main__':
    main()