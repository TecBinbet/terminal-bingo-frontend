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
VERSION = "1.2.60"

# --- VARIÁVEIS PARA MODO HÍBRIDO ---
# O caminho para a pasta "json" é fixo e externo ao executável
# Allow overriding LOCAL_PATH via env; default keeps Windows dev path
LOCAL_PATH = os.environ.get("LOCAL_PATH", "c:/chefemesa/json")
is_local_mode = os.path.exists(LOCAL_PATH)
# Prefer env vars in production; fall back to current defaults
MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://rivaldosp:TecBin24@tecbinon.3zsz7md.mongodb.net/")
DB_NAME = os.environ.get("DB_NAME", "dados_do_sorteio")

# Configurações do servidor
app = Flask(__name__)
CORS(app)
# Bind to platform-provided PORT when available (e.g., DigitalOcean/Heroku)
port = int(os.environ.get('PORT') or os.environ.get('sPORT', 3001))

db = None

# Evitar recarregar cartelas continuamente
UltAlt_Cartelas = ""
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
        'total_cartelas_em_jogo', 'preco_da_serie', 'premio_quadra',
        'premio_linha', 'premio_bingo', 'valor', 'cartao', 'rodada', 'ordem',
        'numero_da_bola'
    ]
    parsed_data = {}
    for key, value in data.items():
        if key in numeric_fields and isinstance(value, str) and value.isdigit():
            parsed_data[key] = int(value)
        else:
            parsed_data[key] = value
    return parsed_data

# NOVO: Função para buscar os dados da tabela 'parametros' (ou arquivo local)
def get_parametros_data(db):
    if is_local_mode:
        local_file_path = os.path.join(LOCAL_PATH, 'parametros.json')
        
        if os.path.exists(local_file_path):
            try:
                with open(local_file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                    # CORREÇÃO CRÍTICA: Extrai o primeiro item da lista se for uma lista
                    if isinstance(data, list) and data:
                        # Retorna o dicionário com os parâmetros (ex: {"nome_sala": "..."})
                        return data[0] 
                    elif isinstance(data, dict):
                         # Retorna o dicionário puro, se o usuário mudar o formato do arquivo
                         return data
                    else:
                        print(f"AVISO: 'parametros.json' tem formato JSON interno inválido (não é lista nem dicionário).")
                        return {}

            except json.JSONDecodeError as e:
                print(f"ERRO FATAL: Sintaxe JSON inválida em 'parametros.json'. Detalhes: {e}")
                return {}
            except Exception as e:
                print(f"ERRO: Falha geral na leitura de 'parametros.json': {e}")
                return {}
        else:
            print(f"AVISO: Arquivo 'parametros.json' não encontrado em {local_file_path}")
            return {}
            
    # Modo MongoDB (se 'is_local_mode' for False)
    else: 
        # ... (Sua lógica de busca no MongoDB)
        try:
            parametros_doc = db['parametros'].find_one()
            if parametros_doc:
                parametros_doc.pop('_id', None)
                return parametros_doc
            return {}
        except Exception as e:
            print(f"Erro ao buscar parâmetros no MongoDB: {e}")
            return {}

# --- LÊ DADOS DOS ARQUIVOS JSON LOCAIS ---
def fetch_data_from_local_files():
    global UltAlt_Cartelas, cartelas_data

    try:
        with open(os.path.join(LOCAL_PATH, 'bolas.json'), 'r', encoding='utf-8') as f:
            bolas_data = json.load(f)
        
        with open(os.path.join(LOCAL_PATH, 'buscando.json'), 'r', encoding='utf-8') as f:
            buscando_data = json.load(f)
        
        with open(os.path.join(LOCAL_PATH, 'premio.json'), 'r', encoding='utf-8') as f:
            premio_raw_data = json.load(f)
        
        with open(os.path.join(LOCAL_PATH, 'rodada.json'), 'r', encoding='utf-8') as f:
            rodada_data = json.load(f)
        
        with open(os.path.join(LOCAL_PATH, 'confere.json'), 'r', encoding='utf-8') as f:
            confere_data = json.load(f)

        with open(os.path.join(LOCAL_PATH, 'parametros.json'), 'r', encoding='utf-8') as f:
            parametros_data_raw = json.load(f) # Lê o arquivo

        with open(os.path.join(LOCAL_PATH, 'promocional.json'), 'r', encoding='utf-8') as f:
            promocional_data = json.load(f)
        
        # Verifica se o arquivo cartelas.json foi alterado e o carrega se necessário
        current_cartelas_mtime = os.path.getmtime(os.path.join(LOCAL_PATH, 'cartelas.json'))
        if UltAlt_Cartelas != current_cartelas_mtime:
            UltAlt_Cartelas = current_cartelas_mtime
            with open(os.path.join(LOCAL_PATH, 'cartelas.json'), 'r', encoding='utf-8') as f:
                cartelas_data = json.load(f)

        premio_data = []
        premio_info = {}
        tope_data = []
        card_ranges = []
        parametros = parametros_data_raw[0] if isinstance(parametros_data_raw, list) and parametros_data_raw else {}

        if premio_raw_data:
            premio_doc = premio_raw_data[0]
            premio_info = premio_doc

            if premio_doc.get('inicial1') is not None and premio_doc.get('final1') is not None:
                card_ranges.append({'inicial': premio_doc['inicial1'], 'final': premio_doc['final1']})
            if premio_doc.get('inicial2') is not None and premio_doc.get('final2') is not None:
                card_ranges.append({'inicial': premio_doc['inicial2'], 'final': premio_doc['final2']})
            if premio_doc.get('inicial3') is not None and premio_doc.get('final3') is not None:
                card_ranges.append({'inicial': premio_doc['inicial3'], 'final': premio_doc['final3']})
            if premio_doc.get('inicial4') is not None and premio_doc.get('final4') is not None:
                card_ranges.append({'inicial': premio_doc['inicial4'], 'final': premio_doc['final4']})

            if isinstance(premio_doc.get('bola_tope_sb'), (int, float)) or isinstance(premio_doc.get('bola_tope_ac'), (int, float)):
                tope_data.append({
                    'bola_tope_sb': premio_doc.get('bola_tope_sb'),
                    'bola_tope_ac': premio_doc.get('bola_tope_ac')
                })

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
        
        max_card_number = max(c.get('cartao', 0) for c in cartelas_data) if cartelas_data else 0

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
            'parametrosInfo': parametros # usa o dicionário real
        }

    except Exception as e:
        print(f"Erro ao ler dados dos arquivos locais: {e}")
        return {
            'bolasData': [],
            'buscandoData': [],
            'premioData': [],
            'premioInfo': {},
            'rodadaData': [],
            'confereData': [],
            'maxCardNumber': 0,
            'topeData': [],
            'cardRanges': [],
            'promocionalData': [],
            'parametrosInfo': {}
        }

# --- LÊ DADOS DO MONGODB ---
def fetch_data_from_collections():
    global db
    if db is None:
        print("Erro: A conexão com o banco de dados não foi estabelecida.") # Verifique a indentação
        return {'error': 'Conexão com o banco de dados não estabelecida.'} # Verifique a indentação

    try:            
        bolas_data = list(db.bolas.find({}))
        buscando_data = list(db.buscando.find({}))
        premio_raw_data = list(db.premio.find({}))
        rodada_data = list(db.rodada.find({}))
        confere_data = list(db.confere.find({}))
        parametros_data = list(db.parametros.find({}))
        max_card_result = list(db.cartelas.find({}, {'cartao': 1, '_id': 0}).sort('cartao', -1).limit(1))

        # CONVERTE ObjectId para string para evitar erro 500
        for doc in bolas_data:
            doc['_id'] = str(doc['_id'])
        for doc in buscando_data:
            doc['_id'] = str(doc['_id'])
        for doc in premio_raw_data:
            doc['_id'] = str(doc['_id'])
        for doc in rodada_data:
            doc['_id'] = str(doc['_id'])
        for doc in confere_data:
            doc['_id'] = str(doc['_id'])
        for doc in parametros_data:
            doc['_id'] = str(doc['_id'])

        premio_data = []
        premio_info = {}
        tope_data = []
        card_ranges = []
        parametros_data = parametros_data[0] if parametros_data else {}
        
        promocional_collection = db.get_collection('promocional')
        # Limita a busca a 1 documento, assume que o texto promo está em um único documento
        promocional_cursor = promocional_collection.find({}, {'_id': 0}).limit(1) 
        promocional_data = [doc for doc in promocional_cursor]

        if premio_raw_data:
            premio_doc = premio_raw_data[0]
            premio_info = premio_doc
            if premio_doc.get('inicial1') is not None and premio_doc.get('final1') is not None:
                card_ranges.append({'inicial': premio_doc['inicial1'], 'final': premio_doc['final1']})
            if premio_doc.get('inicial2') is not None and premio_doc.get('final2') is not None:
                card_ranges.append({'inicial': premio_doc['inicial2'], 'final': premio_doc['final2']})
            if premio_doc.get('inicial3') is not None and premio_doc.get('final3') is not None:
                card_ranges.append({'inicial': premio_doc['inicial3'], 'final': premio_doc['final3']})
            if premio_doc.get('inicial4') is not None and premio_doc.get('final4') is not None:
                card_ranges.append({'inicial': premio_doc['inicial4'], 'final': premio_doc['final4']})

            if isinstance(premio_doc.get('bola_tope_sb'), (int, float)) or isinstance(premio_doc.get('bola_tope_ac'), (int, float)):
                tope_data.append({
                    'bola_tope_sb': premio_doc.get('bola_tope_sb'),
                    'bola_tope_ac': premio_doc.get('bola_tope_ac')
                })

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
            'parametrosInfo': parametros_data    
        }

    except Exception as e:
        print(f"Erro ao buscar dados do MongoDB: {e}")
        return {'error': 'Erro ao buscar dados do MongoDB.'}


# --- GRAVA DADOS EM ARQUIVOS LOCAIS OU NO MONGODB ---
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
