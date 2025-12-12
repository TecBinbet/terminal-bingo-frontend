#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import json
import traceback
import threading
import time
from bson.decimal128 import Decimal128
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
from geventwebsocket.exceptions import WebSocketError
import sys

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


# Tenta importar certifi para evitar erros de SSL
try:
    import certifi
    _TLS_CA_FILE = certifi.where()
except Exception:
    _TLS_CA_FILE = None

VERSION = "2.1.0-SingleTenant"

# --- CONFIGURAÇÕES DE AMBIENTE ---
# No DigitalOcean/Heroku, essas variáveis virão das "Environment Variables" do painel.
# No seu PC, ele usa os valores padrão (segundo argumento do get).

MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://rivaldosp:TecBin24@tecbinon.3zsz7md.mongodb.net/")
DB_NAME = os.environ.get("DB_NAME", "dados_do_sorteio")

LOCAL_PATH = os.environ.get("LOCAL_PATH", "c:/chefemesa/json")
#is_local_mode = os.path.exists(LOCAL_PATH)
is_local_mode = False  # <--- FORÇA O MODO ONLINE (COM BANCO DE DADOS)

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

# --- CACHE EM MEMÓRIA (VELOCIDADE MÁXIMA) ---
CACHE_JOGO = {
    'ativo': False,
    'cartelas': [] # Lista de objetos: {'id': 100, 'nome': 'José', 'layout': {sup: set, cen: set...}}
}

def carregar_cache_evento(id_evento, sales_db):
    """
    Carrega TODAS as cartelas vendidas e seus layouts para a Memória RAM do Servidor.
    Executado apenas UMA VEZ ao selecionar o evento.
    """
    global CACHE_JOGO, db
    print(f"🚀 Iniciando carregamento em memória do Evento {id_evento}...")
    
    # Reseta estado inicial
    CACHE_JOGO['ativo'] = False
    CACHE_JOGO['cartelas'] = []

    try:
        # 1. Busca Vendas
        nome_col = f"vendas{id_evento}"
        if nome_col not in sales_db.list_collection_names():
             print(f"⚠️ Coleção '{nome_col}' não existe no banco de vendas.")
             # Mesmo sem coleção, marcamos como ativo (vazio) para não travar o ranking
             CACHE_JOGO['ativo'] = True
             db.melhores.delete_many({}) # Limpa ranking antigo
             return

        col_vendas = sales_db[nome_col]
        
        # Projeção otimizada
        cursor_vendas = col_vendas.find({}, {
            'numero_inicial':1, 'numero_final':1, 
            'numero_inicial2':1, 'numero_final2':1, 
            'nome_cliente':1
        })

        mapa_vendas = {} # cartela_id -> nome
        
        for v in cursor_vendas:
            nome = v.get('nome_cliente', '---')
            # Faixa 1
            if v.get('numero_inicial') is not None and v.get('numero_final') is not None:
                for c in range(v['numero_inicial'], v['numero_final'] + 1):
                    mapa_vendas[c] = nome
            # Faixa 2
            if v.get('numero_inicial2') is not None and v.get('numero_final2') is not None:
                for c in range(v['numero_inicial2'], v['numero_final2'] + 1):
                    mapa_vendas[c] = nome
        
        count_vendas = len(mapa_vendas)
        print(f"📋 Vendas encontradas no banco: {count_vendas} cartelas.")

        if count_vendas == 0:
            print("⚠️ Evento sem cartelas vendidas (ou erro de leitura).")
            CACHE_JOGO['ativo'] = True # <--- CORREÇÃO: Marca como ativo mesmo vazio
            db.melhores.delete_many({})
            return

        # 2. Busca Layouts no Banco Principal
        ids = list(mapa_vendas.keys())
        cursor_cartelas = db.cartelas.find({'cartao': {'$in': ids}})

        lista_cache = []

        for doc in cursor_cartelas:
            c_id = doc.get('cartao')
            
            def to_set(val):
                if isinstance(val, str) and val:
                    return set(map(int, val.replace(' ', '').split(',')))
                if isinstance(val, list): return set(val)
                return set()

            sup = to_set(doc.get('superior'))
            cen = to_set(doc.get('central'))
            inf = to_set(doc.get('inferior'))
            
            lista_cache.append({
                'id': c_id,
                'nome': mapa_vendas.get(c_id, '---'),
                'layout': {
                    'sup': sup,
                    'cen': cen,
                    'inf': inf,
                    'geral': sup | cen | inf 
                }
            })

        CACHE_JOGO['cartelas'] = lista_cache
        CACHE_JOGO['ativo'] = True
        print(f"✅ CACHE CARREGADO: {len(lista_cache)} cartelas na memória.")
        
        # Força cálculo inicial
        #print("🔄 Executando cálculo inicial do Ranking...")
        recalcular_ranking_top10()

    except Exception as e:
        print(f"❌ Erro ao carregar cache: {e}")
        import traceback
        traceback.print_exc()
        CACHE_JOGO['ativo'] = False # Só marca false se der erro grave de código



# --- CONEXÃO BANCO PRINCIPAL ---
def connect_main_db():
    global db
    if not is_local_mode:
        try:
            print(f"🔌 Conectando ao MongoDB Principal...")
            mongo_kwargs = { 'server_api': ServerApi('1') }
            if _TLS_CA_FILE: mongo_kwargs['tlsCAFile'] = _TLS_CA_FILE
            
            client = MongoClient(MONGO_URI, **mongo_kwargs)
            db = client.get_database(DB_NAME)
            client.admin.command('ping') 
            print("✅ Sucesso: Conectado ao MongoDB Principal!")
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

# aqui
def fetch_data_from_mongodb():
    global db
    if db is None: return {}
    try:
        # Helper para converter ObjectId
        def clean(cursor):
            l = list(cursor)
            for i in l: i['_id'] = str(i['_id'])
            return l

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
        if 'tipo_entrada_de_cartelas' not in param_doc: param_doc['tipo_entrada_de_cartelas'] = 1

        return {
            'bolasData': bolas, 'buscandoData': buscando, 'premioData': premio_data,
            'premioInfo': premio_info, 'rodadaData': rodada, 'confereData': confere,
            'topeData': tope_data, 'cardRanges': card_ranges, 'promocionalData': [],
            'parametrosInfo': param_doc, 'melhoresData': melhores, 
            
            # ENVIA AS DUAS LISTAS
            'ganhadoresData': lista_terminal, 
            'ganhadoresLive': lista_live       
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


def recalcular_ranking_top10():
    """
    Versão Inteligente: 
    1. Ignora linhas (Sup/Cen/Inf) que JÁ foram ganhas na rodada.
    2. Se todas as linhas saírem, mostra distância para Bingo.
    3. Mantém formatação de string e correção da Quadra.
    """
    global db, CACHE_JOGO
    
    # print("🔄 [RANKING] Iniciando cálculo...")

    if not CACHE_JOGO['ativo']: return
    if not CACHE_JOGO['cartelas']:
        db.melhores.delete_many({})
        return

    try:
        dados_bolas = db.bolas.find_one({}) or {}
        bolas_cantadas = set(dados_bolas.get('bolas_cantadas', []))
        
        dados_premio = db.buscando.find_one({}) or {}
        premio_buscado = dados_premio.get('buscando_o_premio', 'BINGO').upper()
        linhas_config = dados_premio.get('buscando_a_linha', '') 

        busca_quadra   = 'QUADRA' in premio_buscado
        busca_linha    = 'LINHA' in premio_buscado
        busca_falta_um = 'FALTA' in premio_buscado
        busca_duplo    = 'DUPLO' in premio_buscado or 'SEGUNDO' in premio_buscado
        
        # --- NOVO: IDENTIFICA LINHAS JÁ GANHAS ---
        linhas_ja_ganhas = set()
        if busca_linha:
            # Busca ganhadores desta rodada que ganharam LINHA
            rodada_atual = db.rodada.find_one({})
            id_rodada = rodada_atual.get('id_evento') if rodada_atual else 0
            
            # ATENÇÃO: É importante que o 'admin_validar_cartela' esteja salvando 'linha_ganha_tag'
            # Se não tiver ID de rodada na tabela ganhadores, assume todos (cuidado se não limpar tabela)
            ganhadores_linha = db.ganhadores.find({'premio': {'$regex': 'LINHA'}})
            
            for g in ganhadores_linha:
                tag = g.get('linha_ganha_tag') # Esperado: 'Sup', 'Cen', 'Inf'
                if tag: linhas_ja_ganhas.add(tag)
        # -----------------------------------------

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


# --- SUBSTITUA A ROTA proximos_eventos POR ESTA (COM MAIS LOGS) ---
@app.route('/api/proximos_eventos', methods=['GET'])
def proximos_eventos():
    print("🔍 Recebida requisição para /api/proximos_eventos")
    
    try:
        sales_db = get_sales_db_connection()
        if sales_db is None: 
            return jsonify({'error': 'Configuração do DB de Vendas não encontrada'}), 500
        
        if 'eventos' not in sales_db.list_collection_names():
            return jsonify([]), 200

        lista = []
        cursor = sales_db.eventos.find({}).sort('data_hora_evento', 1)
        
        for evt in cursor:
            try:
                # APLICA A CONVERSÃO AQUI
                valor_safe = converter_decimal(evt.get('valor_de_venda'))
                
                lista.append({
                    'id_evento': str(evt.get('id_evento')),
                    'descricao': evt.get('descricao', 'Sem Descrição'),
                    'status': evt.get('status', 'paralizado'),
                    'data': evt.get('data_evento'),
                    'hora': evt.get('hora_evento'),
                    'valor_cartela': valor_safe, # <--- Valor limpo
                    'premios_desc': [],
                    'unidade_venda': evt.get('unidade_de_venda', 1)
                })
            except Exception as e_inner:
                print(f"⚠️ Erro ao processar evento: {e_inner}")
                continue

        return jsonify(lista)

    except Exception as e:
        print(f"❌ ERRO 500 EM PROXIMOS EVENTOS: {e}")
        return jsonify({'error': str(e)}), 500



# Rota Consultar Cartelas
@app.route('/api/consultar_cartelas_evento')
def api_consultar_cartelas():
    id_evt = request.args.get('id_evento')
    id_cli = request.args.get('id_cliente')
    if not id_evt or not id_cli: return jsonify({'error': 'Faltam parâmetros'}), 400
    
    s_db = get_sales_db_connection()
    if not s_db: return jsonify({'error': 'DB Vendas Offline'}), 500
    
    col = f"vendas{id_evt}"
    cartelas = []
    if col in s_db.list_collection_names():
        cursor = s_db[col].find({'id_cliente': int(id_cli)})
        for v in cursor:
            if v.get('numero_inicial') and v.get('numero_final'):
                cartelas.extend(range(v['numero_inicial'], v['numero_final']+1))
            if v.get('numero_inicial2') and v.get('numero_final2'):
                cartelas.extend(range(v['numero_inicial2'], v['numero_final2']+1))
                
    return jsonify({'id_evento': id_evt, 'cartelas': cartelas, 'quantidade': len(cartelas)})
    
@app.route('/api/cartelas', methods=['POST'])
def get_cartelas_game():
    ranges = request.json.get('ranges', [])
    if not ranges: return jsonify([]), 400
    
    if is_local_mode:
        # Lógica local simplificada
        all_cards = fetch_data_from_local_files().get('cartelasData', []) # Teria que carregar cartelas.json
        # (Implementar leitura de cartelas.json aqui se necessário para local)
        return jsonify([]) 
    else:
        if db is None: return jsonify([]), 500
        query = {'$or': [{'cartao': {'$gte': r['inicial'], '$lte': r['final']}} for r in ranges]}
        c = list(db.cartelas.find(query))
        for i in c: i['_id'] = str(i['_id'])
        return jsonify(c)

# --- WEBSOCKET ---
def websocket_app(environ, start_response):
    if 'wsgi.websocket' in environ:
        ws = environ['wsgi.websocket']
        clients.add(ws)
        try:
            # Envia estado inicial
            data = fetch_data()
            ws.send(json.dumps({'type': 'UPDATE', **data}, default=str))
            while not ws.closed:
                ws.receive()
        except: pass
        finally: clients.discard(ws)
        return []
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
        t_sorteio = int(data.get('tipo_sorteio', 15))
        update_fields['tipo_sorteio'] = t_sorteio
    except (ValueError, TypeError):
        update_fields['tipo_sorteio'] = 15

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

    if update_fields:
        try:
            # Atualiza no Banco (Coleção parametros)
            db.parametros.update_one({}, {'$set': update_fields}, upsert=True)
            return jsonify({'status': 'Configurações salvas', 'campos': update_fields})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Nenhum dado válido enviado'}), 400


# Endpoint para Sortear Bola
@app.route('/api/admin/sortear', methods=['POST'])
def admin_sortear():
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
        
        db.bolas.update_one({}, {
            '$set': {
                'bolas_cantadas': bolas_cantadas,
                'proxima_bola': nova_bola,
                'ordem' : len(bolas_cantadas),
                'ultimas_bolas': bolas_cantadas[-3:]
            }
        }, upsert=True)
        
        threading.Thread(target=recalcular_ranking_top10).start()

        return jsonify({'bola': nova_bola, 'total_sorteadas': len(bolas_cantadas)})
        
    except Exception as e:
        print(f"Erro ao sortear: {e}")
        return jsonify({'error': str(e)}), 500


# --- ROTA ATUALIZADA: MUDAR PRÊMIO (INICIALIZA LINHAS) ---
@app.route('/api/admin/definir_premio', methods=['POST'])
def admin_definir_premio():
    data = request.json
    nome_premio = data.get('premio')
    if not nome_premio: return jsonify({'error': 'Nome necessário'}), 400
    
    try:
        # 1. Inicializa o dicionário
        update_data = {} 

        # Define o prêmio base
        update_data['buscando_o_premio'] = nome_premio

        # 2. Busca configurações de linhas na tabela 'premio'
        # Isso é necessário para saber se é um jogo de 3 linhas
        tabela_premios = db.premio.find_one({}) or {}
        qtde = tabela_premios.get('qtde_linha', 1) 
        
        # --- CORREÇÃO: GRAVA A QUANTIDADE DE LINHAS NA TABELA 'BUSCANDO' ---
        update_data['qtde_linha'] = qtde 
        # -------------------------------------------------------------------

        # Lógica de Linhas
        if 'LINHA' in nome_premio:
            if qtde == 3:
                # Se for 3 linhas, ativa a busca por todas e define nome visual
                update_data['buscando_tal_premio'] = "3 LINHAS" 
                update_data['buscando_a_linha'] = "Sup,Cen,Inf" 
            else:
                # Se for 1 linha
                update_data['buscando_tal_premio'] = nome_premio 
                update_data['buscando_a_linha'] = "" 
        else:
            # Outros prêmios (Bingo, Quadra, etc)
            update_data['buscando_tal_premio'] = nome_premio
            update_data['buscando_a_linha'] = ""

        # Atualiza o banco
        db.buscando.update_one({}, {'$set': update_data}, upsert=True)

        threading.Thread(target=recalcular_ranking_top10).start()

        return jsonify({'status': 'OK', 'dados_gravados': update_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- FUNÇÃO CORRIGIDA E BLINDADA: VALIDAR CARTELA ---
@app.route('/api/admin/validar_cartela', methods=['POST'])
def admin_validar_cartela():
    if db is None: return jsonify({'status_code': 'ERROR', 'msg': 'Sem conexão DB'})
    
    data = request.json or {}
    raw_cartela = data.get('cartela')
    
    try: cartela_id = int(raw_cartela)
    except: return jsonify({'status_code': 'ERROR', 'msg': 'Número de cartela inválido'})
    
    try:
        # 1. IDENTIFICA O EVENTO ATIVO
        rodada_info = db.rodada.find_one({})
        id_evento_ativo = rodada_info.get('id_evento') if rodada_info else 0
        
        if not id_evento_ativo:
             return jsonify({'status_code': 'ERROR', 'msg': 'Nenhum evento ativo no momento.'})

        # 2. VERIFICA SE A CARTELA FOI VENDIDA NESTE EVENTO (CRÍTICO)
        sales_db = get_sales_db_connection()
        col_vendas_name = f"vendas{id_evento_ativo}"
        
        venda_encontrada = None
        nome_ganhador = "Desconhecido"

        if sales_db is not None and col_vendas_name in sales_db.list_collection_names():
             # Busca se o ID está dentro de algum intervalo de venda (Range 1 ou Range 2)
             venda_encontrada = sales_db[col_vendas_name].find_one({
                '$or': [
                    { 'numero_inicial': {'$lte': cartela_id}, 'numero_final': {'$gte': cartela_id} },
                    { 'numero_inicial2': {'$lte': cartela_id}, 'numero_final2': {'$gte': cartela_id} }
                ]
             })
        
        # --- AQUI ESTÁ A CORREÇÃO PRINCIPAL ---
        if not venda_encontrada:
            return jsonify({
                'status_code': 'NOT_SOLD', 
                'msg': f'⛔ Cartela {cartela_id} NÃO VENDIDA neste evento!',
                'layout': None # Não retorna layout para não confundir
            })
        # --------------------------------------

        nome_ganhador = venda_encontrada.get('nome_cliente', 'Cliente Balcão')

        # 3. BUSCA LAYOUT DA CARTELA (Se passou pela venda, busca o desenho)
        cartela_doc = db.cartelas.find_one({'cartao': cartela_id})
        if not cartela_doc: 
            return jsonify({'status_code': 'MISSING_MATRIX', 'msg': 'Erro: Layout da cartela não cadastrado.'})

        def parse(val):
            if isinstance(val, list): return set(val)
            if isinstance(val, str): return set(map(int, val.replace(' ','').split(',')))
            return set()

        sup_set = parse(cartela_doc.get('superior'))
        cen_set = parse(cartela_doc.get('central'))
        inf_set = parse(cartela_doc.get('inferior'))
        todos_set = sup_set | cen_set | inf_set

        # 4. PREPARA FORMATAÇÃO VISUAL
        dados_bolas = db.bolas.find_one({})
        bolas_lista = dados_bolas.get('bolas_cantadas', []) if dados_bolas else []
        bolas_set = set(bolas_lista)
        ultima_bola = bolas_lista[-1] if bolas_lista else -1
        
        lista_sup = sorted(list(sup_set))
        lista_cen = sorted(list(cen_set))
        lista_inf = sorted(list(inf_set))

        # Monta string visual para o telão
        numeros_visual_ordem = lista_sup + lista_cen + lista_inf
        str_numeros_formatada = ""
        for i, num in enumerate(numeros_visual_ordem):
            num_str = f"{num:02d}"
            separador = " " 
            if i > 0:
                if num == ultima_bola: separador = "*" 
                elif num in bolas_set: separador = "+"
                str_numeros_formatada += separador
            str_numeros_formatada += num_str
        
        # 5. ATUALIZA TABELA CONFERE (Para aparecer na TV)
        db.confere.delete_many({})
        db.confere.insert_one({
            "rodada": int(id_evento_ativo),
            "cartao": cartela_id,
            "numeros": str_numeros_formatada,
            "ganhador": nome_ganhador,
            "status": "conferindo"
        })
        
        # 6. VALIDAÇÃO DO PRÊMIO
        premio_doc = db.buscando.find_one({})
        premio_nome = premio_doc.get('buscando_o_premio', '').replace(" ", "").upper()
        linhas_faltantes = premio_doc.get('buscando_a_linha', '').upper()

        bateu = False
        detalhes = ""
        linha_ganha = "" 

        # Regra Duplo Bingo
        if 'DUPLOBINGO' in premio_nome or 'SEGUNDO BINGO' in premio_nome:
            ja_ganhou_bingo = db.ganhadores.find_one({'cartela': cartela_id, 'premio': 'BINGO'})
            if ja_ganhou_bingo:
                return jsonify({
                    'status_code': 'LOSS', 
                    'msg': f'❌ Cartela {cartela_id} já fez o 1º Bingo (Não vale p/ Duplo).', 
                    'layout': {'superior': lista_sup, 'central': lista_cen, 'inferior': lista_inf}, 
                    'bolas': list(bolas_set)
                })

        if 'BINGO' in premio_nome or 'ACUMULADO' in premio_nome or 'DUPLOBINGO' in premio_nome:
            faltam = todos_set - bolas_set
            bateu = (len(faltam) == 0)
            detalhes = "BINGO!" if bateu else f"Faltam: {len(faltam)}"
            
        elif 'LINHA' in premio_nome:
            check_sup = len(sup_set - bolas_set) == 0
            check_cen = len(cen_set - bolas_set) == 0
            check_inf = len(inf_set - bolas_set) == 0
            
            if check_sup and ('SUP' in linhas_faltantes or not linhas_faltantes):
                bateu = True; detalhes = "Linha SUPERIOR!"; linha_ganha = "Sup"
            elif check_cen and ('CEN' in linhas_faltantes or not linhas_faltantes):
                bateu = True; detalhes = "Linha CENTRAL!"; linha_ganha = "Cen"
            elif check_inf and ('INF' in linhas_faltantes or not linhas_faltantes):
                bateu = True; detalhes = "Linha INFERIOR!"; linha_ganha = "Inf"
            else:
                bateu = False
                detalhes = "Linha incompleta ou já batida."

        elif 'QUADRA' in premio_nome:
            s, c, i = len(sup_set & bolas_set), len(cen_set & bolas_set), len(inf_set & bolas_set)
            if s>=4 or c>=4 or i>=4: bateu=True; detalhes="QUADRA!"
            else: bateu=False; detalhes="Sem quadra."
            
        elif 'FALTA' in premio_nome:
             faltam = todos_set - bolas_set
             bateu = (len(faltam) == 1)
             detalhes = "Falta 1!" if bateu else f"Faltam {len(faltam)}."
             
        else:
             bateu = True; detalhes = "Validação Visual."

        status_code = 'WIN' if bateu else 'LOSS'

        # 7. REGISTRO AUTOMÁTICO SE FOR VENCEDOR (Pré-registro)
        if bateu:
            # (Código de cálculo monetário mantido igual...)
            valor_monetario = "R$ --"
            try:
                tabela_premios = db.premio.find_one({}) or {}
                campo_valor = ''
                if 'QUADRA' in premio_nome: campo_valor = 'premio_quadra'
                elif 'LINHA' in premio_nome: campo_valor = 'premio_linha'
                elif 'BINGO' in premio_nome: campo_valor = 'premio_bingo'
                elif 'DUPLO' in premio_nome: campo_valor = 'premio_duplo_bingo'
                elif 'ACUMULADO' in premio_nome: campo_valor = 'premio_acumulado'
                elif 'FALTA' in premio_nome: campo_valor = 'premio_falta_Um'
                
                if campo_valor:
                    def cvt(v): 
                        if hasattr(v, 'to_decimal'): return float(v.to_decimal())
                        return float(v) if v else 0.0
                    raw_val = cvt(tabela_premios.get(campo_valor))
                    valor_monetario = f"R$ {raw_val:,.2f}".replace('.', ',')
            except: pass

            premio_registro = f"{premio_nome} ({linha_ganha})" if linha_ganha else premio_nome

            # Verifica duplicidade para não gravar 2x o mesmo prêmio pra mesma cartela
            duplicado = db.ganhadores.find_one({'cartela': cartela_id, 'premio': premio_registro})
            if not duplicado:
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
            'layout': {
                'superior': lista_sup,
                'central': lista_cen,
                'inferior': lista_inf
            },
            'bolas': list(bolas_set)
        })

    except Exception as e:
        print(f"Erro Validação: {e}")
        return jsonify({'status_code': 'ERROR', 'msg': str(e)}), 500


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


# --- SUBSTITUA A FUNÇÃO 
@app.route('/api/admin/resetar', methods=['POST'])
def admin_resetar():
    if db is None: return jsonify({'error': 'Sem conexão com DB'}), 500
    try:
        # --- 0. PREPARAÇÃO DE DADOS GERAIS ---
        rodada_info = db.rodada.find_one({}) or {}
        
        # Proteção contra ID Nulo: (Pega valor ou 0)
        raw_id = rodada_info.get('id_evento')
        id_evento = int(raw_id) if raw_id else 0
        
        # Dados das Bolas
        dados_bolas = db.bolas.find_one({}) or {}
        bolas_lista = dados_bolas.get('bolas_cantadas', [])
        total_bolas = len(bolas_lista)
        
        # Dados de Tempo
        now = datetime.now()
        data_hoje = now.strftime("%d/%m/%Y")
        hora_atual = now.strftime("%H:%M")
        
        # Fallback para hora inicial
        hora_inicial = hora_atual 

        # --- 1. PROCESSAMENTO DOS GANHADORES ---
        ganhadores_ativos = list(db.ganhadores.find({}))
        
        lista_osganhadores = []      
        lista_resultados_ganhadores = [] 
        
        if ganhadores_ativos:
            grupos_rateio = {}
            for g in ganhadores_ativos:
                raw_premio = g.get('premio', '').upper()
                chave_base = raw_premio
                
                # Agrupamento Inteligente
                if 'LINHA' in raw_premio: chave_base = "LINHA"
                elif 'DUPLO' in raw_premio or 'SEGUNDO' in raw_premio: chave_base = "DUPLO BINGO"
                elif 'BINGO' in raw_premio: chave_base = "BINGO"
                elif 'QUADRA' in raw_premio: chave_base = "QUADRA"
                elif 'FALTA' in raw_premio: chave_base = "FALTA UM"
                
                if chave_base not in grupos_rateio: grupos_rateio[chave_base] = []
                grupos_rateio[chave_base].append(g)

            # Calcula Rateios
            for chave, lista_vencedores in grupos_rateio.items():
                qtde_ganhadores = len(lista_vencedores)
                
                # Proteção ao pegar valor
                val_total_str = "0"
                if len(lista_vencedores) > 0:
                     val_total_str = lista_vencedores[0].get('valor_total_premio', '0')
                
                val_total_float = parse_brl(val_total_str)
                val_rateio_float = val_total_float / qtde_ganhadores if qtde_ganhadores > 0 else 0
                
                str_total = format_brl(val_total_float)
                str_rateio = format_brl(val_rateio_float)
                
                for w in lista_vencedores:
                    obj_ganhador = {
                        "premio": chave,
                        "valor_total_premio": str_total,
                        "cartela": str(w.get('cartela', '0')),
                        "nome": str(w.get('nome', '---')),
                        "valor_rateio": str_rateio
                    }
                    
                    # 1.1 Tabela Local (com rodada)
                    item_local = obj_ganhador.copy()
                    item_local['rodada'] = id_evento
                    lista_osganhadores.append(item_local)
                    
                    # 1.2 Tabela Remota (sem rodada duplicada)
                    lista_resultados_ganhadores.append(obj_ganhador)

        # --- 2. GRAVAÇÃO LOCAL 'osganhadores' ---
        db.osganhadores.delete_many({})
        if lista_osganhadores:
            db.osganhadores.insert_many(lista_osganhadores)

        # --- 3. GRAVAÇÃO REMOTA 'resultados' ---
        try:
            sales_db = get_sales_db_connection()
            
            # --- CORREÇÃO AQUI ---
            if sales_db is not None:  # <--- MUDOU DE "if sales_db:" PARA "if sales_db is not None:"
                doc_resultado = {
                    "id_evento": id_evento,
                    "data_evento": data_hoje,
                    "hora_inicial": hora_inicial,
                    "hora_final": hora_atual,
                    "total_de_bolas": total_bolas,
                    "bolas_sorteadas": str(bolas_lista), 
                    "ganhadores": lista_resultados_ganhadores
                }
                sales_db.resultados.insert_one(doc_resultado)
                print(f"✅ Histórico salvo no Sales DB.")
            else:
                print("⚠️ Conexão Sales DB retornou None.")
                
        except Exception as e_sales:
            print(f"⚠️ Erro não-fatal ao salvar Sales DB: {e_sales}")
        # --- 4. LIMPEZA (RESET) ---
        db.bolas.update_one({}, {'$set': {'bolas_cantadas': [], 'proxima_bola': "--", 'ultimas_bolas': []}}, upsert=True)
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
        # ISSO VAI MOSTRAR O ERRO REAL NO TERMINAL
        traceback.print_exc() 
        return jsonify({'error': str(e)}), 500


# --- ROTA PARA REMOVER LINHA GANHA (CHAMADA AO FECHAR CONFERÊNCIA) ---
@app.route('/api/admin/atualizar_linhas_restantes', methods=['POST'])
def atualizar_linhas():
    # Esta função verifica os ganhadores da rodada e remove as linhas ganhas da lista de busca
    try:
        rodada_info = db.rodada.find_one({})
        id_evento = rodada_info.get('id_evento')
        
        # Pega configuração atual
        premio_doc = db.buscando.find_one({})
        premio_nome = premio_doc.get('buscando_o_premio', '')
        linhas_atuais = premio_doc.get('buscando_a_linha', '')
        
        if 'LINHA' not in premio_nome or not linhas_atuais:
            return jsonify({'status': 'Ignored'})

        # Busca ganhadores recentes de LINHA
        ganhadores = list(db.ganhadores.find({'premio': {'$regex': 'LINHA'}}))
        
        linhas_ganhas = set()
        for g in ganhadores:
            tag = g.get('linha_ganha_tag')
            if tag: linhas_ganhas.add(tag.upper())
            
        # Filtra o que sobrou
        lista_busca = linhas_atuais.upper().split(',')
        nova_lista = [l for l in lista_busca if l not in linhas_ganhas]
        
        novo_texto = ",".join(nova_lista)
        
        db.buscando.update_one({}, {'$set': {'buscando_a_linha': novo_texto}})
        
        return jsonify({'status': 'Updated', 'restantes': novo_texto})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- ROTA DE DETALHES COM CAMPOS EXTRAS ADICIONADOS E TRAVA DE SEGURANÇA ---
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

        # === NOVA TRAVA DE SEGURANÇA (POSICIONADA CORRETAMENTE) ===
        # Verifica se não há vendas (seja porque a tabela não existe ou porque o total é 0)
        if qtde_vendida == 0:
            print(f"⛔ Evento {id_evt} bloqueado: 0 vendas.")
            return jsonify({
                'error': 'EVENTO VAZIO: Nenhuma cartela vendida encontrada para este evento. O sorteio não pode ser iniciado.'
            }), 400
        # ==========================================================

        # 2. Se passou pela trava, busca os detalhes das vendas
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
                'tipo_sorteio': response_data['tipo_cartela']
            }}, upsert=True)
             db.rodada.update_one({}, {'$set': {'id_evento': id_evt}}, upsert=True)
             
             # --- INSERÇÃO COM NOVOS CAMPOS ---
             db.premio.delete_many({})
             
             # Pega o numero maximo do evento (serie) ou usa padrão se não tiver
             serie_max = evento.get('numero_maximo', 72000) 
             
             db.premio.insert_one({
                 'premio_quadra': response_data['premios']['quadra'],
                 'premio_linha': response_data['premios']['linha'],
                 'qtde_linha': response_data['premios']['qtde_linhas'],
                 'premio_falta_Um': response_data['premios']['falta_um'],
                 'premio_bingo': response_data['premios']['bingo'],
                 'premio_duplo_bingo': response_data['premios']['segundo_bingo'],
                 'premio_acumulado': response_data['premios']['acumulado'],
                 'bola_tope_ac': response_data['premios']['bola_tope'],
                 'preco': response_data['valor_venda'],
                 'multiplo': response_data['unidade_venda'],
                 'rodada': id_evt,
                 
                 # === NOVOS CAMPOS SOLICITADOS ===
                 'serie_em_jogo': serie_max,          # Carregado do evento
                 'minimo_de_cartelas': 1,             # Fixo
                 'maximo_de_cartelas': 6000,          # Fixo
                 'inicial1': 1,                       # Fixo
                 'final1': serie_max,                 # Igual serie
                 'total_cartelas_em_jogo': qtde_vendida # Soma das vendidas
             })

             threading.Thread(target=carregar_cache_evento, args=(id_evt, sales_db)).start()

        return jsonify(response_data)

    except Exception as e:
        print(f"Erro Detalhes: {e}")
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