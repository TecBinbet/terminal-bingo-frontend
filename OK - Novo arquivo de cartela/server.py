import os
import json
import threading
import time
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
from geventwebsocket.exceptions import WebSocketError
import signal
import sys


# Versão da aplicação
VERSION = "1.0.60"

# --- VARIÁVEIS PARA MODO HÍBRIDO ---
# O caminho para a pasta "json" é fixo e externo ao executável
LOCAL_PATH = "c:/chefemesa/json"
is_local_mode = os.path.exists(LOCAL_PATH)
MONGO_URI = "mongodb+srv://rivaldosp:TecBin24@tecbinon.3zsz7md.mongodb.net/"
DB_NAME = "dados_do_sorteio"

# Configurações do servidor
app = Flask(__name__)
CORS(app)
port = os.environ.get('sPORT', 3001)

last_sent_data = None
file_cache = {}

db = None
clients = set()
local_data = {}
intervalo_busca_local = 0.4 # segundos
stop_flag = threading.Event()

# Função para converter strings numéricas em inteiros
def parse_numeric_fields(data):
    if not data:
        return {}
    numeric_fields = [
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

# --- LÊ DADOS DOS ARQUIVOS JSON LOCAIS ---
# NOVO CÓDIGO PARA server.py
# Substitua sua função atual por esta abaixo
def fetch_data_from_local_files():
    global local_data, file_cache
    print(f"LOG: Iniciando busca otimizada de dados locais.")
    new_data = {}
    files_to_check = ['bolas.json', 'buscando.json', 'cartelas.json', 'confere.json', 'premio.json', 'rodada.json']
    
    try:
        for filename in files_to_check:
            filepath = os.path.join(LOCAL_PATH, filename)
            
            if not os.path.exists(filepath):
                print(f"ERRO: Arquivo {filepath} não encontrado.")
                file_cache = {}
                return {}
            
            last_mod_time = os.path.getmtime(filepath)
            
            if filename in file_cache and file_cache[filename]['mod_time'] == last_mod_time:
                print(f"LOG: Usando versão em cache de {filename}.")
                new_data[filename.replace('.json', '')] = file_cache[filename]['data']
            else:
                print(f"LOG: Arquivo {filename} foi modificado. Lendo novo conteúdo.")
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                file_cache[filename] = {'data': data, 'mod_time': last_mod_time}
                new_data[filename.replace('.json', '')] = data

        final_data = {
            'bolas_cantadas': new_data.get('bolas', [{}])[0].get('bolas_cantadas', []),
            'ultimo_round': new_data.get('bolas', [{}])[0].get('rodada'),
            'premio_buscado': new_data.get('buscando', [{}])[0].get('buscando_o_premio', '').strip().upper(),
            'linhas_ativas': new_data.get('buscando', [{}])[0].get('buscando_a_linha', '').strip().upper(),
            'cartelas': new_data.get('cartelas', []),
        }
        
        print("LOG: Dados finais montados e prontos para envio.")
        return final_data

    except Exception as e:
        print(f"ERRO: Falha ao ler arquivos JSON: {e}")
        return {}

# --- LÊ DADOS DO MONGODB ---
def fetch_data_from_collections():
    try:
        global db
        if db is None:
            return {
                'bolasData': [],
                'buscandoData': [],
                'premioData': [],
                'premioInfo': {},
                'rodadaData': [],
                'confereData': [],
                'maxCardNumber': 0,
                'topeData': []
            }
            
        bolas_data = list(db.bolas.find({}))
        buscando_data = list(db.buscando.find({}))
        premio_raw_data = list(db.premio.find({}))
        rodada_data = list(db.rodada.find({}))
        confere_data = list(db.confere.find({}))
        max_card_result = list(db.cartelas.find({}, {'cartao': 1, '_id': 0}).sort('cartao', -1).limit(1))

        premio_data = []
        premio_info = {}
        tope_data = []

        if premio_raw_data:
            premio_doc = premio_raw_data[0]
            premio_info = premio_doc

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
            'topeData': tope_data
        }

    except Exception as e:
        print(f"Erro ao buscar dados das coleções: {e}")
        return {
            'bolasData': [],
            'buscandoData': [],
            'premioData': [],
            'premioInfo': {},
            'rodadaData': [],
            'confereData': [],
            'maxCardNumber': 0,
            'topeData': []
        }

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
def watch_collections():
    global local_data, last_sent_data
    try:
        while not stop_flag.is_set():
            if is_local_mode:
                new_data = fetch_data_from_local_files()
            else:
                new_data = fetch_data_from_collections()
                
            new_data_str = json.dumps(new_data, sort_keys=True, default=str)
            
            if last_sent_data != new_data_str:
                print("LOG: Dados atualizados detectados. Enviando para os clientes.")
                message = json.dumps({'type': 'UPDATE', **new_data}, default=str)
                for client in list(clients):
                    try:
                        client.send(message)
                    except WebSocketError:
                        clients.discard(client)
                
                last_sent_data = new_data_str
                local_data = new_data
            
            time.sleep(intervalo_busca_local)
            
    except Exception as e:
        print(f"ERRO: Erro na thread de monitoramento: {e}")


# Monitora as alterações e transmite atualizações
def watch_collections():
    if is_local_mode:
        global local_data
        while not stop_flag.is_set():
            new_data = fetch_data_from_local_files()
            if json.dumps(new_data) != json.dumps(local_data):
                local_data = new_data
                hora_formatada = datetime.now().strftime("%H:%M:%S")
                print(f"Atualização detectada em arquivos locais... ({hora_formatada})")
                
            time.sleep(intervalo_busca_local)
    else:
        pass

# Rotas da API e WebSocket
@app.route('/')
def health_check():
    status = 'healthy'
    database = 'local_files' if is_local_mode else ('connected' if db else 'disconnected')
    return jsonify({
        'status': status,
        'version': VERSION,
        'database': database
    })

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
            return jsonify(cartelas)
    except Exception as e:
        return jsonify({'error': "Erro ao buscar cartelas no banco de dados."}), 500

@app.route('/api/add-default-prizes', methods=['GET', 'POST'])
def add_default_prizes():
    default_busca = {'buscando_o_premio': 'BINGO', 'qtde_linha': None, 'buscando_a_linha': None}
    default_premio_info = {
        'premio_quadra': 50,
        'premio_linha': 100,
        'premio_bingo': 500,
        'premio_falta_Um': 200,
        'premio_duplo_bingo': 0,
        'premio_triplo_bingo': 0,
        'premio_super_bingo': 0,
        'premio_acumulado': 0,
        'bola_tope_sb': 0,
        'bola_tope_ac': 0,
        'minimo_de_cartelas': 0,
        'maximo_de_cartelas': 99999
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
    else:
        # Standard HTTP requests
        return app(environ, start_response)

# Inicialização
def main():
    global db
    if not is_local_mode:
        try:
            client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
            db = client.get_database(DB_NAME)
        except Exception as e:
            return
            
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