#mongodb+srv://rivaldosp_db_user:TecBin24@vendas.ifpeimn.mongodb.net/?appName=vendas

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import json
import threading
import time
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.server_api import ServerApi
try:
    import certifi  # For trusted CA bundle (fixes SSL on macOS/Windows)
    _TLS_CA_FILE = certifi.where()
except Exception:
    certifi = None
    _TLS_CA_FILE = None
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
from geventwebsocket.exceptions import WebSocketError
import signal
import sys


# Versão da aplicação
VERSION = "1.2.61" # Incrementado

# --- VARIÁVEIS PARA MODO HÍBRIDO ---
# O caminho para a pasta "json" é fixo e externo ao executável
# Allow overriding LOCAL_PATH via env; default keeps Windows dev path
LOCAL_PATH = os.environ.get("LOCAL_PATH", "c:/chefemesa/json")
is_local_mode = os.path.exists(LOCAL_PATH)
# Prefer env vars in production; fall back to current defaults
MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://rivaldosp:TecBin24@tecbinon.3zsz7md.mongodb.net/")
DB_NAME = os.environ.get("DB_NAME", "dados_do_sorteio")
MELHORES_COLLECTION = "melhores"

# Configurações do servidor
app = Flask(__name__)
CORS(app)
# Bind to platform-provided PORT when available (e.g., DigitalOcean/Heroku)
port = int(os.environ.get('PORT') or os.environ.get('sPORT', 3001))

db = None

# --- CACHE CONEXÃO VENDAS ---
sales_client = None
current_sales_uri = None
SALES_DB_NAME = "bingo_vendas_db" # Nome padrão do banco de vendas (ou pegue da URI)


# Evitar recarregar cartelas continuamente
UltAlt_Cartelas = ""
melhores_data = []
cartelas_data = {}  # <-- AQUI: Inicialize a variável
try:
    if is_local_mode: 
       if os.path.exists(os.path.join(LOCAL_PATH, 'cartelas.json')):
           UltAlt_Cartelas = os.path.getmtime(os.path.join(LOCAL_PATH, 'cartelas.json'))
           with open(os.path.join(LOCAL_PATH, 'cartelas.json'), 'r', encoding='utf-8') as f:
               cartelas_data = json.load(f)
           print("Cartelas carregadas com sucesso no início do sistema.")
       else:
           print("Aviso: Arquivo 'cartelas.json' não encontrado na inicialização.")
    else:
           print("Aviso: Buscando arquivo no Servidor.")
 
except Exception as e:
    print(f"Erro ao carregar 'cartelas.json' na inicialização: {e}")

clients = set()
local_data = {}
mongo_data = {}
intervalo_busca_local = 0.4 # segundos
stop_flag = threading.Event()


# Função para converter strings numéricas em inteiros
def parse_numeric_fields(data):
    if not data:
        return {}
    numeric_fields = [
        'inicial1', 'final1', 'inicial2','final2','inicial3','final3','inicial4','final4',
        'série_em_jogo', 'minimo_de_cartelas', 'máximo_de_cartelas',
        'total_cartelas_em_jogo', 'preco', 'multiplo', 'premio_quadra',
        'premio_linha', 'premio_bingo', 'valor', 'cartao', 'rodada', 'ordem',
        'numero_da_bola', 'tipo_entrada_de_cartelas',
    ]
    parsed_data = {}
    for key, value in data.items():
        if key in numeric_fields and isinstance(value, str) and value.isdigit():
            parsed_data[key] = int(value)
        else:
            parsed_data[key] = value
    return parsed_data

# NOVO: Função para buscar os dados da tabela 'parametros'
def get_parametros_data(db):
    # Modo Local
    if is_local_mode:
        local_file_path = os.path.join(LOCAL_PATH, 'parametros.json')
        if os.path.exists(local_file_path):
            try:
                with open(local_file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list) and data:
                        return data[0]
                    elif isinstance(data, dict):
                         return data
                    return {}
            except Exception as e:
                print(f"ERRO ao ler parametros.json: {e}")
                return {}
        else:
            return {}
            
    # Modo MongoDB (se 'is_local_mode' for False)
    else: 
        try:
            # Tenta buscar o documento
            parametros_doc = db['parametros'].find_one()
            
            if parametros_doc:
                # Debug: Mostra no terminal que achou (ajuda a confirmar a conexão)
                # print(f"[DEBUG] Parâmetros carregados do Mongo: Sala {parametros_doc.get('nome_sala')}")
                
                # Remove o _id para não quebrar o JSON
                parametros_doc.pop('_id', None)
                
                # Verifica se a URL de vendas existe
                if 'url_mongo_vendas' not in parametros_doc:
                    print("[AVISO] Campo 'url_mongo_vendas' NÃO encontrado na tabela parametros.")
                
                return parametros_doc
            
            print("[AVISO] Tabela 'parametros' está vazia no MongoDB.")
            return {}
            
        except Exception as e:
            print(f"ERRO CRÍTICO ao buscar parâmetros no MongoDB: {e}")
            return {}


# --- LÊ DADOS DO MONGODB (VERSÃO ATUALIZADA COM TIPO_ENTRADA) ---
def fetch_data_from_collections():
    global db
    if db is None:
        print("Erro: A conexão com o banco de dados não foi estabelecida.")
        return {'error': 'Conexão com o banco de dados não estabelecida.'}

    try:            
        # Buscas padrão nas coleções
        bolas_data = list(db.bolas.find({}))
        buscando_data = list(db.buscando.find({}))
        premio_raw_data = list(db.premio.find({}))
        rodada_data = list(db.rodada.find({}))
        confere_data = list(db.confere.find({}))
        parametros_data = list(db.parametros.find({}))
        
        # Busca o maior número de cartela (para validação de input)
        max_card_result = list(db.cartelas.find({}, {'cartao': 1, '_id': 0}).sort('cartao', -1).limit(1))
        
        # --- BUSCA E PROCESSA GANHADORES ---
        ganhadores_raw = list(db.ganhadores.find({}))
        
        ganhadores_dict = {}
        for g in ganhadores_raw:
            tipo_premio = g.get('premio', 'N/A')
            valor_total_premio = g.get('valor_total_premio', 'R$ 0,00')
            
            chave = f"{tipo_premio}|{valor_total_premio}"
            
            if chave not in ganhadores_dict:
                ganhadores_dict[chave] = {
                    "premio": tipo_premio,
                    "valor": valor_total_premio,
                    "ganhadores": []
                }
            
            ganhadores_dict[chave]["ganhadores"].append({
                "cartela": g.get('cartela'),
                "nome": g.get('nome'),
                "valor_rateio": g.get('valor_rateio')
            })
        
        ganhadores_data_processed = list(ganhadores_dict.values())
        # -----------------------------------

        # Busca Melhores (Top cartelas)
        melhores_collection = db.get_collection(MELHORES_COLLECTION)
        melhores_cursor = melhores_collection.find({}, {'_id': 0}).sort('id_posicao', 1).limit(25)
        melhores_data_raw = [doc for doc in melhores_cursor]

        # CONVERTE ObjectId para string (Evita erro de JSON serializable)
        for doc in bolas_data: doc['_id'] = str(doc['_id'])
        for doc in buscando_data: doc['_id'] = str(doc['_id'])
        for doc in premio_raw_data: doc['_id'] = str(doc['_id'])
        for doc in rodada_data: doc['_id'] = str(doc['_id'])
        for doc in confere_data: doc['_id'] = str(doc['_id'])
        for doc in parametros_data: doc['_id'] = str(doc['_id'])
        
        # Processa Parametros e adiciona default para tipo_entrada
        parametros_doc = parametros_data[0] if parametros_data else {}
        if 'tipo_entrada_de_cartelas' not in parametros_doc:
             parametros_doc['tipo_entrada_de_cartelas'] = 1

        # Processa dados dos Melhores para formato do frontend
        melhores_data_processed = []
        if melhores_data_raw:
            for doc in melhores_data_raw:
                numeros_faltantes_str = ', '.join(map(str, doc.get('numeros', [])))
                melhores_data_processed.append({
                    'cartela': doc.get('cartela', 0),
                    'posicao': doc.get('posicao', 'N/A'),
                    'nome': doc.get('nome', 'Anônimo'),
                    'premio': doc.get('premio', 'N/A'),
                    'numeros_faltantes': numeros_faltantes_str
                })

        # Processamento de Prêmios em Jogo (Ranges, Topes, etc)
        premio_data = []
        premio_info = {}
        tope_data = []
        card_ranges = []
        
        promocional_collection = db.get_collection('promocional')
        promocional_cursor = promocional_collection.find({}, {'_id': 0}).limit(1) 
        promocional_data = [doc for doc in promocional_cursor]

        if premio_raw_data:
            premio_doc = premio_raw_data[0]
            premio_info = premio_doc
            
            # Ranges de Cartelas
            if premio_doc.get('inicial1') is not None and premio_doc.get('final1') is not None:
                card_ranges.append({'inicial': premio_doc['inicial1'], 'final': premio_doc['final1']})
            if premio_doc.get('inicial2') is not None and premio_doc.get('final2') is not None:
                card_ranges.append({'inicial': premio_doc['inicial2'], 'final': premio_doc['final2']})
            if premio_doc.get('inicial3') is not None and premio_doc.get('final3') is not None:
                card_ranges.append({'inicial': premio_doc['inicial3'], 'final': premio_doc['final3']})
            if premio_doc.get('inicial4') is not None and premio_doc.get('final4') is not None:
                card_ranges.append({'inicial': premio_doc['inicial4'], 'final': premio_doc['final4']})

            # Tope
            if isinstance(premio_doc.get('bola_tope_sb'), (int, float)) or isinstance(premio_doc.get('bola_tope_ac'), (int, float)):
                tope_data.append({
                    'bola_tope_sb': premio_doc.get('bola_tope_sb'),
                    'bola_tope_ac': premio_doc.get('bola_tope_ac')
                })

            # Lista de Prêmios
            if isinstance(premio_doc.get('premio_linha'), (int, float)):
                tipo_premio_linha = 'LINHA'
                if premio_doc.get('qtde_linha', 1) > 1:
                    tipo_premio_linha = f"{premio_doc['qtde_linha']} LINHAS"
                premio_data.append({'tipo_premio': tipo_premio_linha, 'valor': f"R$ {premio_doc['premio_linha']:.2f}".replace('.', ',')})

            if isinstance(premio_doc.get('premio_bingo'), (int, float)):
                premio_data.append({'tipo_premio': 'BINGO', 'valor': f"R$ {premio_doc['premio_bingo']:.2f}".replace('.', ',')})
            if isinstance(premio_doc.get('premio_quadra'), (int, float)):
                premio_data.append({'tipo_premio': 'QUADRA', 'valor': f"R$ {premio_doc['premio_quadra']:.2f}".replace('.', ',')})
            if isinstance(premio_doc.get('premio_falta_Um'), (int, float)):
                premio_data.append({'tipo_premio': 'FALTA 1', 'valor': f"R$ {premio_doc['premio_falta_Um']:.2f}".replace('.', ',')})
            if isinstance(premio_doc.get('premio_duplo_bingo'), (int, float)):
                premio_data.append({'tipo_premio': 'DUPLO BINGO', 'valor': f"R$ {premio_doc['premio_duplo_bingo']:.2f}".replace('.', ',')})
            if isinstance(premio_doc.get('premio_triplo_bingo'), (int, float)):
                premio_data.append({'tipo_premio': 'TRIPLO BINGO', 'valor': f"R$ {premio_doc['premio_triplo_bingo']:.2f}".replace('.', ',')})
            if isinstance(premio_doc.get('premio_super_bingo'), (int, float)):
                premio_data.append({'tipo_premio': 'SUPER BINGO', 'valor': f"R$ {premio_doc['premio_super_bingo']:.2f}".replace('.', ',')})
            if isinstance(premio_doc.get('premio_acumulado'), (int, float)):
                premio_data.append({'tipo_premio': 'ACUMULADO', 'valor': f"R$ {premio_doc['premio_acumulado']:.2f}".replace('.', ',')})

        max_card_number = max_card_result[0]['cartao'] if max_card_result else 0

        # --- RETORNO FINAL ---
        return {
            'bolasData': bolas_data,
            'buscandoData': buscando_data,
            'premioData': premio_data,
            'premioInfo': premio_info,
            'rodadaData': rodada_data,
            'confereData': confere_data,
            'maxCardNumber': max_card_number,
            'topeData': tope_data,
            'cardRanges': card_ranges,
            'promocionalData': promocional_data,
            'parametrosInfo': parametros_doc,
            'melhoresData': melhores_data_processed,
            'ganhadoresData': ganhadores_data_processed  # Dados processados e agrupados
        }

    except Exception as e:
        print(f"Erro ao buscar dados do MongoDB: {e}")
        return {'error': 'Erro ao buscar dados do MongoDB.'}


# --- LÊ DADOS DOS ARQUIVOS JSON LOCAIS (VERSÃO ATUALIZADA COM TIPO_ENTRADA) ---
def fetch_data_from_local_files():
    global UltAlt_Cartelas, cartelas_data

    try:
        
        # Carregamento Básico
        with open(os.path.join(LOCAL_PATH, 'bolas.json'), 'r', encoding='utf-8') as f: bolas_data = json.load(f)
        with open(os.path.join(LOCAL_PATH, 'buscando.json'), 'r', encoding='utf-8') as f: buscando_data = json.load(f)
        with open(os.path.join(LOCAL_PATH, 'premio.json'), 'r', encoding='utf-8') as f: premio_raw_data = json.load(f)
        with open(os.path.join(LOCAL_PATH, 'rodada.json'), 'r', encoding='utf-8') as f: rodada_data = json.load(f)
        with open(os.path.join(LOCAL_PATH, 'confere.json'), 'r', encoding='utf-8') as f: confere_data = json.load(f)
        with open(os.path.join(LOCAL_PATH, 'parametros.json'), 'r', encoding='utf-8') as f: parametros_data_raw = json.load(f)
        with open(os.path.join(LOCAL_PATH, 'promocional.json'), 'r', encoding='utf-8') as f: promocional_data = json.load(f)

        ganhadores_raw = []
        g_path = os.path.join(LOCAL_PATH, 'ganhadores.json')
        if os.path.exists(g_path):
            with open(g_path, 'r', encoding='utf-8') as f:
                ganhadores_raw = json.load(f)

        # Processamento Ganhadores
        ganhadores_dict = {}
        for g in ganhadores_raw:
            tipo_premio = g.get('premio', 'N/A')
            valor_total_premio = g.get('valor_total_premio', 'R$ 0,00')
            chave = f"{tipo_premio}|{valor_total_premio}"
            
            if chave not in ganhadores_dict:
                ganhadores_dict[chave] = {
                    "premio": tipo_premio,
                    "valor": valor_total_premio,
                    "ganhadores": []
                }
            
            ganhadores_dict[chave]["ganhadores"].append({
                "cartela": g.get('cartela'),
                "nome": g.get('nome'),
                "valor_rateio": g.get('valor_rateio')
            })
        
        ganhadores_data_processed = list(ganhadores_dict.values())
 
        # --- MELHORES ---
        melhores_data_raw = []
        try:
            with open(os.path.join(LOCAL_PATH, 'melhores.json'), 'r', encoding='utf-8') as f:
                melhores_data_raw = json.load(f)
        except: pass

        # Verifica cartelas.json (Cache)
        current_cartelas_mtime = os.path.getmtime(os.path.join(LOCAL_PATH, 'cartelas.json'))
        if UltAlt_Cartelas != current_cartelas_mtime:
            UltAlt_Cartelas = current_cartelas_mtime
            with open(os.path.join(LOCAL_PATH, 'cartelas.json'), 'r', encoding='utf-8') as f:
                cartelas_data = json.load(f)

        # Processar dados de Melhores
        melhores_data_processed = []
        if melhores_data_raw:
            for doc in melhores_data_raw:
                numeros_faltantes_str = ', '.join(map(str, doc.get('numeros', [])))
                melhores_data_processed.append({
                    'cartela': doc.get('cartela', 0),
                    'posicao': doc.get('posicao', 'N/A'),
                    'nome': doc.get('nome', 'Anônimo'),
                    'premio': doc.get('premio', 'N/A'),
                    'numeros_faltantes': numeros_faltantes_str 
                })

        # Processamento de Prêmios (simplificado para o exemplo, mantenha sua lógica de ranges)
        premio_data = []
        premio_info = {}
        tope_data = []
        card_ranges = []
        
        # Garante que parametros é um dict e tem o tipo_entrada
        parametros = parametros_data_raw[0] if isinstance(parametros_data_raw, list) and parametros_data_raw else {}
        if 'tipo_entrada_de_cartelas' not in parametros:
             parametros['tipo_entrada_de_cartelas'] = 1

        if premio_raw_data:
            premio_doc = premio_raw_data[0]
            premio_info = premio_doc
            
            # Ranges
            if premio_doc.get('inicial1') is not None: card_ranges.append({'inicial': premio_doc['inicial1'], 'final': premio_doc['final1']})
            if premio_doc.get('inicial2') is not None: card_ranges.append({'inicial': premio_doc['inicial2'], 'final': premio_doc['final2']})
            if premio_doc.get('inicial3') is not None: card_ranges.append({'inicial': premio_doc['inicial3'], 'final': premio_doc['final3']})
            if premio_doc.get('inicial4') is not None: card_ranges.append({'inicial': premio_doc['inicial4'], 'final': premio_doc['final4']})

            # Tope
            if isinstance(premio_doc.get('bola_tope_sb'), (int, float)):
                tope_data.append({'bola_tope_sb': premio_doc.get('bola_tope_sb'), 'bola_tope_ac': premio_doc.get('bola_tope_ac')})

            # Lista Prêmios
            if isinstance(premio_doc.get('premio_quadra'), (int, float)):
                premio_data.append({'tipo_premio': 'QUADRA', 'valor': f"R$ {premio_doc['premio_quadra']:.2f}"})
            if isinstance(premio_doc.get('premio_linha'), (int, float)):
                premio_data.append({'tipo_premio': 'LINHA', 'valor': f"R$ {premio_doc['premio_linha']:.2f}"})
            if isinstance(premio_doc.get('premio_falta_um'), (int, float)):
                premio_data.append({'tipo_premio': 'FALTA 1', 'valor': f"R$ {premio_doc['premio_falta_um']:.2f}"})
            if isinstance(premio_doc.get('premio_bingo'), (int, float)):
                premio_data.append({'tipo_premio': 'BINGO', 'valor': f"R$ {premio_doc['premio_bingo']:.2f}"})
            if isinstance(premio_doc.get('premio_duplo_bingo'), (int, float)):
                premio_data.append({'tipo_premio': 'DUPLO BINGO', 'valor': f"R$ {premio_doc['premio_duplo_bingo']:.2f}"})
            if isinstance(premio_doc.get('premio_super_bingo'), (int, float)):
                premio_data.append({'tipo_premio': 'SUPER BINGO', 'valor': f"R$ {premio_doc['premio_super_bingo']:.2f}"})
            if isinstance(premio_doc.get('premio_acumulado'), (int, float)):
                premio_data.append({'tipo_premio': 'ACUMULADO', 'valor': f"R$ {premio_doc['premio_acumulado']:.2f}"})

        max_card_number = max(c.get('cartao', 0) for c in cartelas_data) if cartelas_data else 0
        # Retorno
        return {
            'bolasData': bolas_data,
            'buscandoData': buscando_data,
            'premioData': premio_data,
            'premioInfo': premio_info,
            'rodadaData': rodada_data,
            'ganhadoresData': ganhadores_data_processed,  # <--- IMPORTANTE
            'confereData': confere_data,
            'maxCardNumber': max_card_number,
            'topeData': tope_data,
            'cardRanges': card_ranges,
            'promocionalData': promocional_data,
            'parametrosInfo': parametros,
            'melhoresData': melhores_data_processed
        }

    except Exception as e:
        print(f"❌ ERRO no fetch_local: {e}")
        import traceback
        traceback.print_exc()
        return {
            'bolasData': [], 'buscandoData': [], 'premioData': [], 'premioInfo': {},
            'rodadaData': [], 'confereData': [], 'maxCardNumber': 0, 'topeData': [],
            'cardRanges': [], 'promocionalData': [], 'parametrosInfo': {}, 
            'melhoresData': [], 'ganhadoresData': []
        }

def update_prizes_func(busca, premio_info):
    if is_local_mode:
        with open(os.path.join(LOCAL_PATH, 'buscando.json'), 'w', encoding='utf-8') as f:
            json.dump([busca], f, indent=2, ensure_ascii=False)
        with open(os.path.join(LOCAL_PATH, 'premio.json'), 'w', encoding='utf-8') as f:
            json.dump([premio_info], f, indent=2, ensure_ascii=False)
    else:
        db.buscando.delete_many({})
        if busca:
            db.buscando.insert_one(busca)
        db.premio.delete_many({})
        if premio_info:
            db.premio.insert_one(premio_info)

# Função para transmitir dados a todos os clientes WebSocket
def broadcast(data):
    message = json.dumps({
        'type': 'UPDATE',
        **data
    }, default=str)
    for client in clients:
        try:
            client.send(message)
        except WebSocketError:
            clients.discard(client)

# Monitora as alterações e transmite atualizações
mongo_data = {}

def watch_collections():
    global local_data, mongo_data
    first_run = True
    
    if is_local_mode:
        while not stop_flag.is_set():
            
            new_data = fetch_data_from_local_files()

            main_data_changed = json.dumps(new_data) != json.dumps(local_data)
            
            if main_data_changed or first_run:
                if main_data_changed:
                    local_data = new_data
                
                payload_para_broadcast = local_data.copy()
                
                hora_formatada = datetime.now().strftime("%H:%M:%S")
                print(f"Atualização detectada em arquivos locais... ({hora_formatada})")

                broadcast( payload_para_broadcast)
                first_run = False

            time.sleep(intervalo_busca_local)
            
    else:
        # Modo de produção: Monitora o MongoDB
        while not stop_flag.is_set():
            # 2. REMOVE: parametros_data = get_parametros_data(db)
            try:
                # new_data AGORA CONTÉM OS PARÂMETROS E OS DADOS PRINCIPAIS
                new_data = fetch_data_from_collections()
                
                # 3. main_data_changed AGORA CHECA TUDO (Dados + Parâmetros)
                main_data_changed = json.dumps(new_data) != json.dumps(mongo_data)
                # 4. REMOVE: parameters_changed
                
                if main_data_changed or first_run:
                    
                    if main_data_changed:
                        mongo_data = new_data
                    
                    # 5. REMOVE: Lógica de 'if parameters_changed' e a atualização de 'last_sent_parametros_data'
                        
                    # O payload_para_broadcast JÁ ESTÁ COMPLETO
                    payload_para_broadcast = mongo_data.copy()
                    # 6. REMOVE: O bloco 'if parametros_data:' e a adição de "parametrosData"
                        
                    hora_formatada = datetime.now().strftime("%H:%M:%S")
                    print(f"Atualização detectada no MongoDB... ({hora_formatada})")
                    broadcast( payload_para_broadcast)
                    first_run = False
                        
            except Exception as e:
                print(f"Erro ao monitorar o MongoDB: {e}")
                
            time.sleep(1)

# Rotas da API e WebSocket
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route('/')
def serve_index():
    return send_from_directory(BASE_DIR, 'index.html')

# Static assets (scripts, css, images, audio)
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(BASE_DIR, path)

@app.route('/api/initial-data')
def initial_data():
    try:
        data = fetch_data_from_local_files() if is_local_mode else fetch_data_from_collections()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': "Erro interno do servidor"}), 500

@app.route('/api/version')
def get_version():
    return jsonify({'version': VERSION})

# BUSCA MELHORES
@app.route('/api/melhores', methods=['GET'])
def get_melhores():
    # Esta rota usará as funções de fetch existentes, que agora incluem 'melhoresData'
    try:
        data = fetch_data_from_local_files() if is_local_mode else fetch_data_from_collections()
        # Retorna apenas a chave 'melhoresData'
        return jsonify(data.get('melhoresData', []))
    except Exception as e:
        print(f"Erro ao buscar dados de melhores (API): {e}")
        return jsonify([]), 500

@app.route('/health')
def health_check():
    status = 'healthy'
    database = 'local_files' if is_local_mode else ('connected' if db is not None else 'disconnected')
    return jsonify({'status': status, 'version': VERSION, 'database': database})

@app.route('/api/cartelas', methods=['POST'])
def get_cartelas():
    ranges = request.json.get('ranges', [])
    if not ranges:
        return jsonify({'error': "Ranges de cartelas inválidos."}), 400

    try:
        if is_local_mode:
            with open(os.path.join(LOCAL_PATH, 'cartelas.json'), 'r', encoding='utf-8') as f:
                cartelas_data = json.load(f)
            cartelas = [c for c in cartelas_data if any(r['inicial'] <= c['cartao'] <= r['final'] for r in ranges)]
            return jsonify(cartelas)
        else:
            query = {'$or': [{'cartao': {'$gte': r['inicial'], '$lte': r['final']}} for r in ranges]}
            cartelas = list(db.cartelas.find(query))
            # Converta ObjectId para string para evitar o erro 500
            for c in cartelas:
                c['_id'] = str(c['_id'])
            return jsonify(cartelas)
    except Exception as e:
        print(f"Erro ao buscar cartelas: {e}")
        return jsonify({'error': "Erro ao buscar cartelas no banco de dados."}), 500

@app.route('/api/add-default-prizes', methods=['GET', 'POST'])
def add_default_prizes():
    default_busca = {'buscando_o_premio': 'BINGO', 'qtde_linha': None, 'buscando_a_linha': None}
    default_premio_info = {
        'premio_quadra': 0,
        'premio_linha': 0,
        'premio_bingo': 0,
        'premio_falta_Um': 0,
        'premio_duplo_bingo': 0,
        'premio_triplo_bingo': 0,
        'premio_super_bingo': 0,
        'premio_acumulado': 0,
        'bola_tope_sb': 0,
        'bola_tope_ac': 0,
        'minimo_de_cartelas': 0,
        'maximo_de_cartelas': 12000
    }
    try:
        update_prizes_func(default_busca, default_premio_info)
        return jsonify({'message': 'Dados de prêmios padrão adicionados com sucesso!'})
    except Exception as e:
        return jsonify({'error': "Erro ao adicionar dados de prêmios padrão."}), 500

@app.route('/api/set-current-prize')
def set_current_prize():
    premio = request.args.get('premio')
    qtde_linha = request.args.get('qtdeLinha')
    linhas = request.args.get('linhas')

    if not premio:
        return jsonify({'error': "Parâmetro 'premio' é obrigatório."}), 400

    busca = {
        'buscando_o_premio': premio,
        'qtde_linha': int(qtde_linha) if qtde_linha else None,
        'buscando_a_linha': linhas
    }

    try:
        if is_local_mode:
            with open(os.path.join(LOCAL_PATH, 'buscando.json'), 'w', encoding='utf-8') as f:
                json.dump([busca], f, indent=2, ensure_ascii=False)
        else:
            db.buscando.delete_many({})
            db.buscando.insert_one(busca)
        return jsonify({'message': f"Prêmio em jogo atualizado para: {premio}"})
    except Exception as e:
        return jsonify({'error': "Erro ao atualizar o prêmio em jogo."}), 500

# consulta cartelas por evento
@app.route('/api/consultar_cartelas_evento')
def api_consultar_cartelas_evento():
    # 1. Valida parâmetros da URL
    try:
        id_evento = request.args.get('id_evento') # String (ex: "105")
        id_cliente_str = request.args.get('id_cliente')
        
        if not id_evento or not id_cliente_str:
             return jsonify({'error': 'Parâmetros faltando'}), 400
             
        id_cliente = int(id_cliente_str)
    except (TypeError, ValueError):
        return jsonify({'error': 'Parâmetros inválidos'}), 400

    # 2. Obtém a conexão com o banco de VENDAS
    sales_db_conn = get_sales_db_connection()
    if sales_db_conn is None:
        return jsonify({'error': 'DB Vendas Offline'}), 500

    # 3. Define o nome da coleção (Ajuste que você fez: SEM PONTO)
    nome_colecao = f"vendas{id_evento}" 
    
    # =====================================================================
    # >>> DEBUG: MOSTRAR O QUE EXISTE NO BANCO <<<
    # =====================================================================
    try:
        colecoes_existentes = sales_db_conn.list_collection_names()
        
        #print("\n=== 🕵️ DEBUG DO BANCO DE VENDAS ===")
        #print(f"Nome do Banco Conectado: '{sales_db_conn.name}'")
        #print(f"O sistema está procurando por: '{nome_colecao}'")
        #print(f"LISTA REAL DE COLEÇÕES NO BANCO:")
        #print(colecoes_existentes)
        #print("====================================\n")
        
        cartelas_formatadas = []

        # 4. Verifica se a coleção existe e busca
        if nome_colecao in colecoes_existentes:
            print(f"✅ SUCESSO: Coleção '{nome_colecao}' encontrada! Buscando cartelas...")
            
            vendas_cursor = sales_db_conn[nome_colecao].find(
                {'id_cliente': id_cliente},
                {'_id': 0, 'numero_inicial': 1, 'numero_final': 1, 'numero_inicial2': 1, 'numero_final2': 1}
            )
            
            # 5. Processa os intervalos
            count = 0
            for venda in vendas_cursor:
                # Intervalo 1
                if venda.get('numero_inicial') is not None and venda.get('numero_final') is not None:
                    for num in range(venda['numero_inicial'], venda['numero_final'] + 1):
                        cartelas_formatadas.append(num)
                        count += 1
                
                # Intervalo 2 (se houver)
                if venda.get('numero_inicial2') and venda.get('numero_final2') and venda.get('numero_inicial2') > 0:
                    for num in range(venda['numero_inicial2'], venda['numero_final2'] + 1):
                        cartelas_formatadas.append(num)
                        count += 1
            
            print(f"Total de cartelas encontradas para o cliente {id_cliente}: {count}")

        else:
            print(f"❌ AVISO: A coleção '{nome_colecao}' NÃO existe na lista acima.")

        return jsonify({
            'id_evento': id_evento,
            'id_cliente': id_cliente,
            'quantidade': len(cartelas_formatadas),
            'cartelas': cartelas_formatadas
        })

    except Exception as e:
        print(f"Erro ao buscar cartelas na coleção de vendas: {e}")
        return jsonify({'error': str(e)}), 500


# Defs
def websocket_app(environ, start_response):
    if 'wsgi.websocket' in environ:
        ws = environ['wsgi.websocket']
        clients.add(ws)
        current_payload = local_data.copy()
        current_payload["parametrosData"] = get_parametros_data(db) # Lê os parâmetros novamente
        try:
            initial_data = fetch_data_from_local_files() if is_local_mode else fetch_data_from_collections()
            ws.send(json.dumps({'type': 'UPDATE', **initial_data}, default=str))
            # Keep the WebSocket connection open
            while not ws.closed:
                try:
                    ws.receive()
                except WebSocketError:
                    break
        finally:
            clients.discard(ws)
        return []  # ADICIONE ESTA LINHA PARA RETORNAR UM OBJETO ITERÁVEL
    else:
        # Standard HTTP requests
        return app(environ, start_response)

#Conexão Vendas
def get_sales_db_connection():
    global sales_client, current_sales_uri, db
    
    param_doc = None

    # 1. Lógica Híbrida: Define de onde ler os parâmetros
    if is_local_mode:
        # --- MODO LOCAL: Lê do arquivo JSON ---
        try:
            path_params = os.path.join(LOCAL_PATH, 'parametros.json')
            if os.path.exists(path_params):
                with open(path_params, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # O arquivo costuma ser uma lista [{...}], pegamos o primeiro item
                    if isinstance(data, list) and len(data) > 0:
                        param_doc = data[0]
                    elif isinstance(data, dict):
                        param_doc = data
            else:
                print(f"ERRO: Arquivo 'parametros.json' não encontrado em {LOCAL_PATH}")
                return None
        except Exception as e:
            print(f"ERRO ao ler parametros.json local: {e}")
            return None
            
    else:
        # --- MODO NUVEM: Lê do MongoDB Principal ---
        if db is None: 
            print("ERRO FATAL: DB Principal desconectado em modo nuvem.")
            return None
        try:
            param_doc = db.parametros.find_one({})
        except Exception as e:
            print(f"ERRO de leitura no DB Principal: {e}")
            return None

    # ==============================================================================
    # >>>>>>>>>> LOGS DE DEBUG (ADICIONE ISTO AQUI) <<<<<<<<<<  aquix
    # ==============================================================================
    print("\n--- DEBUG PARAMETROS ---")
    print(f"Modo Local Ativo? {is_local_mode}")
    if param_doc:
        # Remove dados sensíveis ou grandes se necessário, mas queremos ver as chaves
        print(f"Chaves encontradas: {list(param_doc.keys())}")
        url_vendas = param_doc.get('url_mongo_vendas', 'NÃO ENCONTRADA')
        print(f"Valor de 'url_mongo_vendas': {url_vendas}")
    else:
        print("param_doc está VAZIO ou NULO.")
    print("------------------------\n")
    # ==============================================================================

    # 2. Validação dos Dados Encontrados
    if not param_doc:
        print("ERRO: Documento de parâmetros vazio ou não encontrado.")
        return None

    if 'url_mongo_vendas' not in param_doc:
        print("ERRO: O campo 'url_mongo_vendas' NÃO EXISTE no parametros.json (ou no Mongo).")
        return None
        
    new_uri = param_doc['url_mongo_vendas']
    
    # 3. Gerencia a Conexão com o Banco de Vendas
    try:
        if sales_client is None or new_uri != current_sales_uri:
            if sales_client:
                sales_client.close()
            
            print(f"Conectando ao Banco de Vendas (Origem: {'Local' if is_local_mode else 'Mongo'})...")
            
            mongo_kwargs = { 'server_api': ServerApi('1') }
            if _TLS_CA_FILE: mongo_kwargs['tlsCAFile'] = _TLS_CA_FILE
                
            sales_client = MongoClient(new_uri, **mongo_kwargs)
            current_sales_uri = new_uri
            sales_client.admin.command('ping')
            print("Sucesso: Conectado ao Banco de Vendas!")

        try:
            return sales_client.get_default_database()
        except:
            return sales_client[SALES_DB_NAME]

    except Exception as e:
        print(f"Erro crítico ao conectar no banco de vendas: {e}")
        return None

# -------------------------------------------------------------------------
# ROTA: PRÓXIMOS EVENTOS (CORREÇÃO DECIMAL)
# -------------------------------------------------------------------------
@app.route('/api/proximos_eventos', methods=['GET'])
def proximos_eventos():
    try:
        sales_db = get_sales_db_connection()
        if sales_db is None: 
            return jsonify({'error': 'DB Vendas Offline'}), 500

        if 'eventos' not in sales_db.list_collection_names():
             return jsonify([]), 200

        eventos_cursor = sales_db['eventos'].find({}).sort('data_hora_evento', 1)
        lista_eventos = []

        # --- FUNÇÃO DE CONVERSÃO CORRIGIDA ---
        def safe_float_inner(val):
            if val is None: return 0.0
            try:
                # 1. Tenta converter direto (Pega int, float e Decimal nativo)
                return float(val)
            except (ValueError, TypeError):
                # 2. Se falhar, converte para texto, troca vírgula e tenta de novo
                try:
                    val_str = str(val)
                    val_str = val_str.replace(',', '.')
                    return float(val_str)
                except:
                    # 3. Último recurso: Se for objeto Decimal128 específico do Mongo
                    try:
                        return float(val.to_decimal())
                    except:
                        return 0.0
        # -------------------------------------

        for evento in eventos_cursor:
            try:
                def get_val(key):
                    return safe_float_inner(evento.get(key))

                def fmt_moeda(val):
                    return f"{val:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')

                premios = []
                
                v_quadra = get_val('premio_quadra')
                if v_quadra > 0: premios.append(f"Quadra: R$ {fmt_moeda(v_quadra)}")

                v_linha = get_val('premio_linha')
                try:
                    qtde = int(evento.get('quantidade_de_linhas', 1))
                except: qtde = 1
                lbl_linha = "Linha" if qtde == 1 else f"{qtde} Linhas"
                
                if v_linha > 0: premios.append(f"{lbl_linha}: R$ {fmt_moeda(v_linha)}")

                v_faltaum = get_val('premio_faltaum')
                if v_faltaum > 0: premios.append(f"Falta Um: R$ {fmt_moeda(v_faltaum)}")

                v_bingo = get_val('premio_bingo')
                if v_bingo > 0: premios.append(f"Bingo: R$ {fmt_moeda(v_bingo)}")

                v_segundobingo = get_val('premio_segundobingo')
                if v_segundobingo > 0: premios.append(f"2Bingo: R$ {fmt_moeda(v_segundobingo)}")

                data_iso = None
                raw_date = evento.get('data_hora_evento')
                if raw_date:
                    if isinstance(raw_date, datetime):
                        data_iso = raw_date.isoformat()
                    else:
                        data_iso = str(raw_date)

                lista_eventos.append({
                    'id_evento': str(evento.get('id_evento')),
                    'descricao': evento.get('descricao', 'Sem Descrição'),
                    'status': evento.get('status', 'paralizado'),
                    'data': evento.get('data_evento', 'N/A'),
                    'hora': evento.get('hora_evento', 'N/A'),
                    'data_iso': data_iso,
                    'valor_cartela': get_val('valor_de_venda'),
                    'premios_desc': premios,
                    'unidade_venda': evento.get('unidade_de_venda', 1)
                })
            except:
                continue 

        return jsonify(lista_eventos)

    except Exception as e:
        print(f"Erro em proximos_eventos: {e}")
        return jsonify({'error': 'Erro interno ao processar eventos'}), 500



# Inicialização
def main():
    global db
    if not is_local_mode:
        try:
            mongo_kwargs = { 'server_api': ServerApi('1') }
            # Use certifi CA bundle when available to avoid SSL CERTIFICATE_VERIFY_FAILED on Atlas
            if _TLS_CA_FILE:
                mongo_kwargs['tlsCAFile'] = _TLS_CA_FILE
            else:
                print("Aviso: pacote 'certifi' não encontrado. Se ocorrer erro SSL, instale com 'pip install certifi'.")
            client = MongoClient(MONGO_URI, **mongo_kwargs)
            db = client.get_database(DB_NAME)
            client.admin.command('ping') 
            print("Conexão com MongoDB bem-sucedida!")
        except Exception as e:
            print(f"Erro fatal ao conectar ao MongoDB: {e}")
            # Em caso de erro, o programa deve sair.
            sys.exit(1)
            
    # Iniciar a monitoração em uma thread daemon
    watch_thread = threading.Thread(target=watch_collections, daemon=True)
    watch_thread.start()
    
    # Iniciar o servidor com Gevent para lidar com HTTP e WebSocket na mesma porta
    http_server = WSGIServer(('0.0.0.0', port), websocket_app, handler_class=WebSocketHandler)

    print(f"Servidor rodando na porta {port}")
    print("Pressione CTRL+C para sair.")
    
    try:
        http_server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()