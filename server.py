#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from gevent import monkey

#monkey.patch_all(dns=False) # <--- O "dns=False" é vital no Windows
monkey.patch_all() # docker

import gevent
from gevent import pool

import mercadopago
import uuid
import os

mp_sdk = None
# Busca o token de forma segura no arquivo .env
MERCADO_PAGO_ACCESS_TOKEN = os.getenv("MERCADO_PAGO_ACCESS_TOKEN")

# Trava de segurança: avisa no terminal se você esquecer de colocar a chave no .env
if not MERCADO_PAGO_ACCESS_TOKEN:
    print("⚠️ AVISO CRÍTICO: MERCADO_PAGO_ACCESS_TOKEN não encontrado no arquivo .env! Os pagamentos PIX não vão funcionar.")
else:
    mp_sdk = mercadopago.SDK(MERCADO_PAGO_ACCESS_TOKEN)

import json
import traceback
import threading
import time
import requests
import math

import bcrypt # Necessário para validar a senha
from flask import Flask, jsonify, request, send_from_directory, session, redirect, url_for, render_template, flash

from better_profanity import profanity
import re
from bson.decimal128 import Decimal128
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from flask_cors import CORS, cross_origin
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
from geventwebsocket.exceptions import WebSocketError
import sys
sys.stdout.reconfigure(line_buffering=True)
from pymongo import ReturnDocument # Certifique-se de importar isso no topo do arquivo
from decimal import Decimal
MODO_TREINAMENTO_ATIVO = False

# ==============================================================================
# 🛠️ CONFIGURAÇÃO INICIAL DA SALA (PRIORIDADE: ARGUMENTO > ENV > PADRÃO)
# ==============================================================================

# 1. Define o padrão base: Tenta pegar do Ambiente (Docker), se não tiver, usa "001"
# Isso garante compatibilidade com o deploy atual
#PARAM_ID_SALA = os.environ.get("IDSALA", "001")

# ==============================================================================
# 🛠️ CONFIGURAÇÃO LIMPA DA SALA (ARGUMENTO > ENV > PADRÃO)
# ==============================================================================
PARAM_ID_SALA = "001" # Padrãozão

# 1. Tenta pegar do argumento do Python (O jeito novo que você gostou)
if len(sys.argv) > 1:
    arg_sala = sys.argv[1]
    if arg_sala.isdigit():
        PARAM_ID_SALA = str(arg_sala).zfill(3)
        print(f"👉 [BOOT] Sala definida via ARGUMENTO: {PARAM_ID_SALA}")

# 2. Se não veio argumento, tenta variável de ambiente (Docker)
elif os.environ.get("IDSALA"):
    PARAM_ID_SALA = str(os.environ.get("IDSALA")).zfill(3)
    print(f"👉 [BOOT] Sala definida via DOCKER ENV: {PARAM_ID_SALA}")

print(f"✅ [SISTEMA] Rodando servidor para SALA ID: {PARAM_ID_SALA}")

print("==================================================")

app = Flask(__name__, static_folder='.')


# --- FIM DO BLOCO DE CORREÇÃO ---

@app.route('/img/<path:filename>')
def serve_img(filename):
    # O parametro 'img' é o nome da PASTA física no seu computador
    return send_from_directory('img', filename)

app.secret_key ='chave_super_secreta_do_bingo_2026' # Configure uma chave forte

# --- CONFIGURAÇÃO DE SESSÃO PARA IP LOCAL/MOBILE ---
app.config['SESSION_COOKIE_SECURE'] = False      # Permite cookie sem HTTPS (importante para IP local)
app.config['SESSION_COOKIE_HTTPONLY'] = True     # Segurança contra JS malicioso
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'    # Permite envio do cookie na navegação normal
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7) # Mantém logado por 7 dias

# --- NO TOPO DO SERVER.PY (Logo após os imports) ---

# 1. Lista Global para guardar as TVs conectadas
clientes_conectados = []


def carregar_configuracao_treinamento():
    global MODO_TREINAMENTO_ATIVO
    try:
        # Tenta ler do banco de Vendas apenas no BOOT do servidor
        from database import get_sales_db_connection # Garante que a função de conexão exista
        s_db = get_sales_db_connection()
        if s_db:
            conf = s_db.parametros.find_one({}, {"em_treinamento": 1})
            if conf:
                MODO_TREINAMENTO_ATIVO = bool(conf.get("em_treinamento", False))
                print(f"⚙️ [BOOT] Modo Treinamento inicial: {MODO_TREINAMENTO_ATIVO}")
    except Exception as e:
        print(f"⚠️ Erro no boot de treinamento: {e}")


# --- FUNÇÃO DE ENVIO ---xx
def broadcast_para_clientes(data):
    global clients
    
    # LOG DECISIVO: Queremos ver esse número!
    print(f"📢 [BROADCAST] Tentando enviar para {len(clients)} clientes conectados.")

    if not clients:
        return

    msg = json.dumps({'type': 'UPDATE', **data}, default=str)

    for client in list(clients):
        try:
            client.send(msg)
        except:
            clients.discard(client)


# --- WATCHER ---
def watch_collections():
    global local_data, mongo_data, MODO_TREINAMENTO_ATIVO
    print("👀 Watcher iniciado (Monitorando Sorteio e Ambiente)...")
    last_data_json = ""
    
    while True:
        try:
            current_data = fetch_data() # Esta função já busca a tabela 'parametros'
            if not current_data: 
                gevent.sleep(1)
                continue

            # --- SINCRONIA AUTOMÁTICA DE AMBIENTE ---
            # Buscamos o campo 'modo_treinamento' que você vai criar na tabela parametros (Sorteio)
            params_jogo = current_data.get('parametrosInfo', {})
            if 'modo_treinamento' in params_jogo:
                novo_status = bool(params_jogo['modo_treinamento'])
                if MODO_TREINAMENTO_ATIVO != novo_status:
                    MODO_TREINAMENTO_ATIVO = novo_status        
            current_data['parametrosInfo']['em_treinamento'] = MODO_TREINAMENTO_ATIVO

            current_json = json.dumps(current_data, default=str)
            
            if current_json != last_data_json:
                last_data_json = current_json
                
                # Injeta a global atualizada para que o front-end receba o Badge correto
                current_data['parametrosInfo']['em_treinamento'] = MODO_TREINAMENTO_ATIVO
                
                if is_local_mode: local_data = current_data
                else: mongo_data = current_data
                
                print(f"🔔 Dados mudaram! Chamando broadcast...")
                broadcast_para_clientes(current_data)
                
        except Exception as e:
            print(f"❌ Erro no Watcher: {e}")
            
        gevent.sleep(1)


def broadcast(data):
    msg = json.dumps({'type': 'UPDATE', **data}, default=str)
    # Copia o set para evitar erro de mudança de tamanho durante iteração
    for client in list(clients):
        try:
            client.send(msg)
        except:
            clients.discard(client)



def atualizar_status_treinamento():
    global MODO_TREINAMENTO_ATIVO
    try:
        s_db = get_sales_db_connection()
        if s_db:
            params = s_db.parametros.find_one({}, {'em_treinamento': 1})
            MODO_TREINAMENTO_ATIVO = params.get('em_treinamento', False) if params else False
            print(f"⚙️ [CONFIG] Modo Treinamento definido como: {MODO_TREINAMENTO_ATIVO}")
    except Exception as e:
        print(f"⚠️ Erro ao carregar status de treinamento: {e}")
        MODO_TREINAMENTO_ATIVO = Fals


def hora_brasil():
# 1. Pega a hora exata no fuso de SP
    agora_sp = datetime.now(ZoneInfo('America/Sao_Paulo'))
    
    # 2. Remove a 'etiqueta' de fuso horário (.replace(tzinfo=None))
    # Assim o banco salva exatamente o que vê, sem tentar converter.
    return agora_sp.replace(tzinfo=None)


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

# --- CONFIGURAÇÃO DE ROTEAMENTO DE SALAS --- AQUI

# ==============================================================================
# 🆕 ADIÇÃO MULTI-SALAS (INÍCIO)
# ==============================================================================

# Lê o ID da Sala que vem do Docker-Compose (Ex: 001, 002 ou 003)
#PARAM_ID_SALA = os.environ.get("IDSALA", "001")
print(f"🚀 INICIANDO SERVIDOR PARA SALA: {PARAM_ID_SALA}")

# URLs de Consulta para descobrir o banco de cada sala
URI_CONSULTA_SALAS = "mongodb+srv://tecbin_db_vendas:TecBin24@cluster0.blwq4du.mongodb.net/?appName=Cluster0"
# URL de Fallback (Caso a sala não seja achada, cai na sala 001)
URI_FALLBACK_PADRAO = "mongodb+srv://tecbin_db_vendas:TecBin24@cluster0.blwq4du.mongodb.net/?appName=Cluster0"

def buscar_uri_da_sala(id_sala_alvo):
    """Descobre qual banco de dados usar baseado no ID da sala."""

    if id_sala_alvo:
        id_sala_alvo = str(id_sala_alvo).zfill(3)

    if not id_sala_alvo or id_sala_alvo == "001":
        return URI_FALLBACK_PADRAO

    print(f"🔍 [ROTEAMENTO] Buscando configuração para Sala ID: {id_sala_alvo}...")
    uri_final = URI_FALLBACK_PADRAO
    client_consulta = None
    try:
        # Tenta conectar no banco mestre para ler a tabela 'salas'
        # Importante: removemos o certifi aqui se der erro de SSL, mas geralmente ok manter
        client_consulta = MongoClient(URI_CONSULTA_SALAS)
        db_controle = client_consulta.get_database("db_master_controle")
        
        # Procura a sala pelo ID
        sala_doc = db_controle.salas.find_one({'id_sala': id_sala_alvo})
        if sala_doc and 'url_mongo_sorteio' in sala_doc:
            novo_link = sala_doc['url_mongo_sorteio']
            if novo_link and len(novo_link) > 10:
                uri_final = novo_link
                print(f"✅ [ROTEAMENTO] Sala {id_sala_alvo} encontrada no banco!")
            else:
                print(f"⚠️ [ROTEAMENTO] Sala {id_sala_alvo} achada, mas sem URL válida. Usando padrão.")
        else:
             print(f"⚠️ [ROTEAMENTO] Sala {id_sala_alvo} não cadastrada no banco mestre.")
             
    except Exception as e:
        print(f"❌ [ROTEAMENTO] Erro ao buscar sala: {e}")
    finally:
        if client_consulta: client_consulta.close()
        
    return uri_final

# ==============================================================================
# 🆕 ADIÇÃO MULTI-SALAS (FIM)
# ==============================================================================


# --- DEFINE A URI REAL DO SISTEMA ---
MONGO_URI = buscar_uri_da_sala(PARAM_ID_SALA)

# O nome do banco principal (pode vir do ambiente ou fixo)
DB_NAME = os.environ.get("DB_NAME", "dados_do_sorteio")

LOCAL_PATH = os.environ.get("LOCAL_PATH", "c:/chefemesa/json")
is_local_mode = False

#app = Flask(__name__)
CORS(app, supports_credentials=True)
port = int(os.environ.get('PORT') or os.environ.get('sPORT', 3001))

# --- VARIÁVEIS GLOBAIS ---
nome_da_Sala = "PRINCIPAL"
db = None
client = None
sales_client = None  # Cache para conexão de vendas
current_sales_uri = None

estado_jogo = {
    "bola_atual": "--",
    "ultimas_bolas": [],
    "status": "aguardando"
}

#clients = set() # WebSocket clients
if 'clients' not in globals():
    clients = set()

comandos_pendentes = {}

CUPOM_FILE = "cupom_atual.json"

receberemos_pix = False;

local_data = {}
mongo_data = {}
stop_flag = threading.Event()
timeStart = None
CACHE_MAX_BOLAS = 90
_CONFIG_ATUAL = None
valorPremioQuadra = 0


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
        traceback.print_exc()
        CACHE_JOGO['ativo'] = False


def connect_main_db__():
    """Conecta no banco do JOGO (dados_do_sorteio) usando URI_SORTEIO_FINAL"""
    global client, db
    try:
        print(f"🔌 [GAME DB] Conectando...")
        
        # Conecta usando a URL específica de sorteio
        client = MongoClient(URI_SORTEIO_FINAL, server_api=ServerApi('1'))
        
        # FORÇA O USO DO BANCO 'dados_do_sorteio'
        # Independente do que está escrito na URL, pegamos esse banco.
        db = client.get_database("dados_do_sorteio")

        # Teste de vida
        client.admin.command('ping') 
        print(f"✅ [GAME DB] Conectado com sucesso em: {db.name}")
        
    except Exception as e:
        print(f"❌ [GAME DB] Erro fatal: {e}")
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
        def clean(cursor):
            l = list(cursor)
            for i in l: i['_id'] = str(i['_id'])
            return l

        # 1. Buscas no Banco
        bolas = clean(db.bolas.find({}))
        rodada = clean(db.rodada.find({}))
        buscando = clean(db.buscando.find({}))
        bolas_mesa = clean(db.bolas_mesa.find({}))
        premios_raw = clean(db.premio.find({}))
        buscando_mesa = clean(db.buscando_mesa.find({}))
        confere = clean(db.confere.find({}))
        avisos = clean(db.avisos.find({}))
        melhores = list(db['melhores'].find({}, {'_id':0}).sort('id_posicao', 1).limit(25))
        
        # 2. Parâmetros
        lista_parametros = clean(db.parametros.find({}))
      
        # Dicionário padrão caso o banco esteja vazio
        default_params = { 
            "texto_sorteio": "SISTEMA ONLINE", 
            "id_sala": PARAM_ID_SALA,
            "nome_sala": "BINGO TESTE",
            "tipo_sorteio": 25,
            "tempo_ganhador": 20
        }
 
        param_doc = lista_parametros[0] if lista_parametros else default_params
 
        param_doc["em_treinamento"] = MODO_TREINAMENTO_ATIVO

        # 3. TRATAMENTO DOS GANHADORES (Agrupamento Restaurado)
        ganhadores_terminal_raw = list(db.osganhadores.find({}))        
        ganhadores_terminal_dict = {}
        
        for g in ganhadores_terminal_raw:
            # Converte ID para string para evitar erro de JSON
            g['_id'] = str(g['_id'])
            
            k = f"{g.get('premio')}|{g.get('valor_total_premio')}"
            if k not in ganhadores_terminal_dict:
                ganhadores_terminal_dict[k] = {
                    "premio": g.get('premio'), 
                    "valor_total_premio": g.get('valor_total_premio'), 
                    "ganhadores": [] 
                }
            ganhadores_terminal_dict[k]["ganhadores"].append({
                "cartela": g.get('cartela'), 
                "nome": g.get('nome'), 
                "valor_rateio": g.get('valor_rateio')
            })
        
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

        try:
            premio_data, tope_data, card_ranges, premio_info = process_prizes(premios_raw)
        except Exception as e:
            print(f"⚠️ Erro ao processar prêmios: {e}")
            premio_data, tope_data, card_ranges, premio_info = [], [], [], {}


        # 4. RETORNO FINAL (Com nomes de variáveis corrigidos)
        return {
            'type': 'UPDATE', 
            'bolasData': bolas,
            'rodadaData': rodada,
            'buscandoData': buscando,
            'bolasMesaData': bolas_mesa,
            'buscandoMesaData': buscando_mesa,
            'confereData': confere,
            'parametrosInfo': param_doc,
            'melhoresData': melhores,
            'ganhadoresData': lista_terminal,  # <--- Corrigido (JS usa este)
            'ganhadoresLive': lista_live,             # <--- Adicionado para não dar erro
            'avisosData': avisos,
            'premioData': premio_data, 
            'topeData': tope_data,
            'cardRanges': card_ranges,
            'premioInfo': premio_info
        }

    except Exception as e:
        print(f"❌ ERRO FATAL NO FETCH: {e}")
        traceback.print_exc() # Mostra o erro exato no console do Docker
        return {}


# ==============================================================================
# 🎫 MOTOR DE SEQUÊNCIA DE BILHETES (ATÓMICO E UNIFICADO)
# ==============================================================================
def get_next_bilhete_sequence(db, id_evento, increment_field, qtd, limite_maximo):
    """
    Incrementa o campo de sequência (inicial_proxima_venda) por `qtd`
    e aplica um rollover se atingir `limite_maximo`.
    Usa Aggregation Pipeline dentro do Update para garantir 100% de atomicidade.
    """
    VALOR_INICIAL_PADRAO = 1 
    now_utc = hora_brasil()
    data_hora_formatada = now_utc.strftime("%d-%m/%Y %H:%M:%S")

    # Pipeline que o Mongo processa internamente de uma só vez.
    # Faz a matemática "Se (Atual + Qtd) >= Maximo, subtrai Maximo. Senão, soma Qtd."
    update_pipeline = [
        {
            '$set': {
                increment_field: {
                    '$cond': {
                        'if': { 
                            '$gte': [ 
                                { '$add': [f"${increment_field}", qtd] }, 
                                limite_maximo 
                            ] 
                        },
                        'then': { 
                            '$subtract': [ 
                                { '$add': [f"${increment_field}", qtd] }, 
                                limite_maximo 
                            ] 
                        },
                        'else': { 
                            '$add': [f"${increment_field}", qtd] 
                        }
                    }
                },
                "data_hora": data_hora_formatada
            }
        }
    ]
    
    try:
        query = {'id_evento': id_evento}
        
        # ALERTA: Aqui estávamos a tentar 'adivinhar' a tabela antes. 
        # Agora forçamos o uso da tabela oficial: 'controle_venda'
        update_result = db.controle_venda.find_one_and_update(
            query,
            update_pipeline, 
            return_document=ReturnDocument.BEFORE, # Retorna o número ANTES da soma (é o que vamos usar para a cartela 1 da venda)
            upsert=True,
            projection={increment_field: 1} 
        )

        if update_result and increment_field in update_result:
            return update_result[increment_field] 
        else:
            if update_result is None:
                return VALOR_INICIAL_PADRAO
            return None 
            
    except Exception as e:
        print(f"❌ [ERRO CRÍTICO] Falha ao obter sequência atómica para Evento {id_evento}: {e}")
        # Auto-cura básica: Se a pipeline falhar (ex: campo não é numérico), tentamos forçar o reset.
        try:
            print(f"🔧 Tentando consertar o campo '{increment_field}' para 1...")
            db.controle_venda.update_one({'id_evento': id_evento}, {'$set': {increment_field: 1}})
            return 1
        except Exception as e2:
            print(f"☠️ [FALHA FATAL] Impossível consertar banco: {e2}")
            return None


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
        traceback.print_exc()


def recalcular_ranking_top10_75():    # xyx
    """
    Calcula ranking para BINGO 75 (Lógica Rígida de Fluxo).
    """
    global db, CACHE_JOGO, valorPremioQuadra
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
  
        if valorPremioQuadra == 0: 
            ganhou_cantos = True

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
        #print(f"novo_nome_premio                                              > {novo_nome_premio}")
        #print(f"dados_premio.get('buscando_o_premio')          > {dados_premio.get('buscando_o_premio')}")

        if novo_nome_premio != dados_premio.get('buscando_o_premio'):
             db.buscando.update_one({}, {'$set': {'buscando_o_premio': novo_nome_premio}}, upsert=True)
             db.buscando_mesa.update_one({}, {'$set': {'buscando_o_premio': novo_nome_premio}}, upsert=True)
             print(f"Nome Premio                                       > {novo_nome_premio}")
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
        traceback.print_exc()

# --- FUNÇÃO AUXILIAR PARA ACHAR O PRÓXIMO EVENTO (CORRIGIDA) ---
def buscar_proximo_evento_automatico(id_evento_atual):
    """
    Busca o próximo evento (ativo ou paralizado) baseado na data/hora
    após o evento atual.
    """
    sales_db = get_sales_db_connection()
    
    # CORREÇÃO AQUI: Em vez de "if not sales_db:", usamos "is None"
    if sales_db is None: 
        return None
    
    try:
        # 1. Pega data/hora do evento atual para referência
        evento_atual = None
        if id_evento_atual:
            evento_atual = sales_db.eventos.find_one({
                'id_evento': {'$in': [id_evento_atual, str(id_evento_atual), int(id_evento_atual)]}
            })
        
        # Filtro base: Eventos ATIVOS ou PARALIZADOS
        filtro = {'status': {'$in': ['ativo', 'paralizado', 'ATIVO', 'PARALIZADO']}}
        
        # Busca todos ordenados por data e hora
        todos_eventos = list(sales_db.eventos.find(filtro).sort([('data_evento', 1), ('hora_evento', 1)]))
        
        if not todos_eventos: return None

        # Se não temos evento atual, retorna o primeiro da fila
        if not evento_atual:
            return todos_eventos[0]

        # Procura o índice do atual e pega o próximo
        id_atual_str = str(evento_atual.get('id_evento'))
        
        for i, evt in enumerate(todos_eventos):
            if str(evt.get('id_evento')) == id_atual_str:
                # Achamos o atual! O próximo é i + 1
                if i + 1 < len(todos_eventos):
                    print(f"⏭️ Próximo evento encontrado: ID {todos_eventos[i+1].get('id_evento')}")
                    return todos_eventos[i+1]
                else:
                    print("ℹ️ O evento atual é o último da fila.")
                    return None
        
        # Se o evento atual não estava na lista (ex: já foi finalizado), retorna o primeiro da fila
        print("ℹ️ Evento atual não está na fila (talvez já finalizado). Retornando o 1º disponível.")
        return todos_eventos[0]

    except Exception as e:
        print(f"Erro ao buscar próximo evento: {e}")
        return None


# --- FUNÇÃO AUXILIAR PARA ACHAR O PRÓXIMO EVENTO (CORRIGIDA)  ---
def buscar_proximo_evento_automatico(id_evento_atual):
    """
    Busca o próximo evento (ativo ou paralizado) baseado na data/hora
    após o evento atual.
    """
    sales_db = get_sales_db_connection()
    
    # CORREÇÃO CRÍTICA AQUI: 
    # O PyMongo proíbe usar "if not sales_db". Tem que ser "is None".
    if sales_db is None: 
        return None
    
    try:
        # 1. Pega data/hora do evento atual para referência
        evento_atual = None
        if id_evento_atual:
            evento_atual = sales_db.eventos.find_one({
                'id_evento': {'$in': [id_evento_atual, str(id_evento_atual), int(id_evento_atual)]}
            })
        
        # Filtro base: Eventos ATIVOS ou PARALIZADOS
        filtro = {'status': {'$in': ['ativo', 'paralizado', 'ATIVO', 'PARALIZADO']}}
        
        # Busca todos ordenados por data e hora
        todos_eventos = list(sales_db.eventos.find(filtro).sort([('data_evento', 1), ('hora_evento', 1)]))
        
        if not todos_eventos: return None

        # Se não temos evento atual, retorna o primeiro da fila
        if not evento_atual:
            return todos_eventos[0]

        # Procura o índice do atual e pega o próximo
        id_atual_str = str(evento_atual.get('id_evento'))
        
        for i, evt in enumerate(todos_eventos):
            if str(evt.get('id_evento')) == id_atual_str:
                # Achamos o atual! O próximo é i + 1
                if i + 1 < len(todos_eventos):
                    print(f"⏭️ Próximo evento encontrado: ID {todos_eventos[i+1].get('id_evento')}")
                    return todos_eventos[i+1]
                else:
                    print("ℹ️ O evento atual é o último da fila.")
                    return None
        
        # Se o evento atual não estava na lista (ex: já foi finalizado), retorna o primeiro da fila
        print("ℹ️ Evento atual não está na fila (talvez já finalizado). Retornando o 1º disponível.")
        return todos_eventos[0]

    except Exception as e:
        print(f"Erro ao buscar próximo evento: {e}")
        return None


def verificar_e_sincronizar_cartelas(evento_num_max, evento_tipo_cartela):
    """
    Verifica se a tabela 'cartelas' está sincronizada com o evento.
    Se não, carrega o arquivo JSON correspondente e atualiza.
    """
    if db is None: return

    try:
        # 1. Busca parâmetros atuais
        param = db.parametros.find_one({}) 
        
        if not param:
            print("⚠️ Sincronização abortada: Não foi possível ler 'parametros'.")
            return
        
        # Pega os valores atuais do banco (convertendo para int para comparação segura)
        atual_arquivo = int(param.get('arquivo_de_cartela', 0))
        atual_tipo = int(param.get('tipo_sorteio', 0))
        
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
        traceback.print_exc()


# =========================================================
# HELPER: SERIALIZADOR SEGURO (Evita Crash no JSON)
# =========================================================
def safe_serializer(obj):
    """Converte tipos complexos do Mongo/Python para string segura."""
    try:
        if isinstance(obj, (datetime,  timedelta)):
            return obj.isoformat()
        if isinstance(obj, (Decimal, Decimal128)):
            return str(obj)
        if hasattr(obj, '__str__'): # ObjectId e outros
            return str(obj)
        return str(obj) # Fallback final
    except:
        return ""

# Gravar tabela auditoria cliente
def gerar_snapshot_vendas(id_evt, sales_db):
    col_vendas_name = f"vendas{id_evt}"
    col_snapshot_name = f"snapshot_vendas_{id_evt}"
    
    # 1. Busca todas as vendas da rodada
    vendas_cursor = sales_db[col_vendas_name].find({}, {
        'numero_inicial': 1, 
        'numero_final': 1, 
        'nome_cliente': 1,
        'numero_inicial2': 1,
        'numero_final2': 1
    })

    lista_snapshot = []
    
    for v in vendas_cursor:
        # Primeiro Período
        lista_snapshot.append({
            'i': v.get('numero_inicial'),
            'f': v.get('numero_final'),
            'n': v.get('nome_cliente', 'Anônimo')[:15] # Nick curto
        })
        
        # Segundo Período (se existir)
        if v.get('numero_inicial2') and v.get('numero_inicial2') > 0:
            lista_snapshot.append({
                'i': v.get('numero_inicial2'),
                'f': v.get('numero_final2'),
                'n': v.get('nome_cliente', 'Anônimo')[:15]
            })

    # 2. Salva na coleção de snapshot (limpando antes se já existir)
    sales_db[col_snapshot_name].drop()
    if lista_snapshot:
        sales_db[col_snapshot_name].insert_many(lista_snapshot)
        # Opcional: Criar índice para busca rápida por número inicial
        sales_db[col_snapshot_name].create_index([("i", 1)])
        
    print(f"✅ Snapshot gerado para Evento {id_evt}: {len(lista_snapshot)} registros.")


###### Inicio das Rotas
# --- ROTAS HTTP ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Lista de clientes conectados (Se já não tiver definida lá em cima)
connected_clients = set()

# =========================================================
# 1. ROTA DO SITE (Apenas carrega o HTML)
# =========================================================
@app.route('/')
def serve_index():
    # Não mistura mais socket aqui. Apenas entrega o site.
    return send_from_directory('.', 'index.html')


# ==============================================================================
# 🔌 ROTA DO WEBSOCKET (VERSÃO ESTÁVEL PARA PYTHON 3.12+)
# ==============================================================================
@app.route('/stream')
def api_stream():
    ws = request.environ.get('wsgi.websocket')
    if not ws: return "Erro: Utilize um cliente WebSocket", 400

    id_sala = request.args.get('idsala', PARAM_ID_SALA)
    
    # 1. Registra Cliente
    global clients
    clients.add(ws)
    print(f"👉 [SOCKET] Cliente conectado na Sala {id_sala}. Total online: {len(clients)}")

    try:
        # Loop Infinito (Sem Timeout que derruba a conexão)
        while not ws.closed:
            # receive() bloqueia até chegar algo ou cair a conexão
            # Isso é seguro pois estamos usando um Pool de Processos no main()
            msg = ws.receive() 
            
            if msg:
                try:
                    data = json.loads(msg)
                    acao = data.get('acao') or data.get('type')
                    
                    if acao == 'estado_inicial':
                         # Busca dados (mantendo sua lógica segura)
                         sales_db = get_sales_db_connection()
                         if db:
                             bolas_doc = db.bolas.find_one({'tipo': 'sorteio_atual'}) or {}
                             premio_doc = db.parametros.find_one({'chave': 'premio_atual'}) or {}
                             
                             ws.send(json.dumps({
                                 'tipo': 'ESTADO_INICIAL',
                                 'bolas': bolas_doc.get('bolas_cantadas', []),
                                 'premio': premio_doc.get('valor', ''),
                                 'sala': id_sala
                             }, default=str))
                             # print(f"✅ Estado inicial enviado.")
                    
                    elif acao == 'ping':
                        ws.send(json.dumps({'type': 'pong'}))

                except Exception as e:
                    print(f"⚠️ Erro ao processar mensagem: {e}")
            else:
                # Se msg for None, o cliente desconectou
                break
                
    except Exception as e:
        print(f"🔥 Erro Socket: {e}")
    finally:
        if ws in clients: clients.discard(ws)
        print(f"👋 Cliente saiu. Restam: {len(clients)}")
    
    return ""

# ==============================================================================
# 🔌 ROTA DO WEBSOCKET (AGORA ACEITA COM E SEM PREFIXO)
# ==============================================================================
@app.route('/stream_')          # <--- Pega quem chama direto (localhost:3001/stream)
def api_stream_():
    # --- DEBUG: PARA PROVAR QUE ENTROU NA FUNÇÃO ---
    print("👉 [DEBUG EXTREMO] Alguém bateu na porta /stream!") 
    
    ws = request.environ.get('wsgi.websocket')
    
    # Se não for WebSocket (ex: navegador acessando via http normal), ignora
    if not ws:
        print("❌ [DEBUG] Não é requisição WebSocket (provavelmente HTTP normal)")
        return "Erro: Utilize um cliente WebSocket", 400

    # 2. Registra o cliente
    global clients
    clients.add(ws)
    
    id_sala = request.args.get('idsala', PARAM_ID_SALA)
    print(f"👉 [SOCKET] Cliente entrou na Sala {id_sala}. Total online: {len(clients)}")

    try:
        while not ws.closed:
            # --- Leitura com Timeout (para não travar) ---
            try:
                with gevent.Timeout(0.5, False):
                    msg = ws.receive()
                    
                    if msg:
                        dados = json.loads(msg)
                        acao = dados.get('acao') or dados.get('type')
                        
                        # LOG DEBUG: O que o cliente pediu?
                        # print(f"📩 Pedido recebido: {acao}")

                        if acao == 'estado_inicial':
                            # --- AQUI É ONDE ESTAVA O PERIGO ---
                            try:
                                sales_db = get_sales_db_connection()
                                if sales_db:
                                    # Busca Bolas
                                    bolas_doc = sales_db.bolas.find_one({'tipo': 'sorteio_atual'})
                                    lista_bolas = bolas_doc.get('bolas', []) if bolas_doc else []
                                    
                                    # Busca Prêmio
                                    premio_doc = sales_db.parametros.find_one({'chave': 'premio_atual'})
                                    premio_atual = premio_doc.get('valor', '') if premio_doc else ''

                                    # Monta Resposta
                                    resposta = {
                                        'tipo': 'ESTADO_INICIAL',
                                        'bolas': lista_bolas,
                                        'premio': premio_atual,
                                        'sala': id_sala
                                    }
                                    
                                    # ENVIA COM PROTEÇÃO DE SERIALIZAÇÃO (default=str)
                                    # Isso evita erro se tiver ObjectId ou Datetime no meio
                                    ws.send(json.dumps(resposta, default=str))
                                    print(f"✅ [SOCKET] Estado inicial enviado para Sala {id_sala}")
                                else:
                                    print("❌ [SOCKET] Erro: Sem conexão com o Banco de Dados.")
                            
                            except Exception as e_banco:
                                print(f"🔥 [ERRO NO BANCO] Ao buscar estado inicial: {e_banco}")
                                traceback.print_exc() # MOSTRA ONDE O CÓDIGO QUEBROU

                        elif acao == 'ping':
                            ws.send(json.dumps({'type': 'pong'}))

            except Exception:
                pass # Timeout normal de leitura, segue o jogo

            # --- Mantém vivo e evita 100% CPU ---
            gevent.sleep(0.5)

    except Exception as e_fatal:
        print(f"☠️ [FATAL] O WebSocket morreu: {e_fatal}")
        traceback.print_exc()
        
    finally:
        if ws in clients:
            clients.discard(ws)
        print(f"👋 [SOCKET] Cliente saiu. Restam: {len(clients)}")

    return ""


@app.route('/<path:path>')
def serve_static(path): return send_from_directory(BASE_DIR, path)


@app.route('/api/initial-data')
def initial_data():
#    return jsonify(fetch_data())
    dados = fetch_data()
    # Se der erro (None), tenta pegar da memória global (cache) em vez de mandar vazio
    if not dados:
        if is_local_mode: dados = local_data
        else: dados = mongo_data
    
    # Se ainda assim for vazio (início do sistema), manda {}
    return jsonify(dados if dados else {})


@app.route('/api/admin/reload_treino')
def reload_treino():
    carregar_configuracao_treinamento()
    return "Configuração Atualizada!"

# ==============================================================================
#  ROTA DE CONFIGURAÇÃO DE AMBIENTE
# ==============================================================================
@app.route('/api/config_ambiente')
def config_ambiente():
    return jsonify({
        "em_treinamento": MODO_TREINAMENTO_ATIVO,
        "versao": "1.0.4-stable"
    })

# ==============================================================================
#  ROTA DE AUDITORIA cliente
# ==============================================================================
@app.route('/api/public/lista_vendas', methods=['GET'])
def get_lista_vendas():
    id_evt = request.args.get('id_evento')
    sales_db = get_sales_db_connection()
    
    col_snapshot = f"snapshot_vendas_{id_evt}"
    
    # Busca o snapshot ordenado pelo número inicial
    vendas = list(sales_db[col_snapshot].find({}, {'_id': 0}).sort('i', 1))
    
    # Retorna o JSON ultra-compacto
    return jsonify(vendas)


# ==============================================================================
# 1. ROTA DE ENVIO (Painel Admin -> Servidor)
# ==============================================================================
# Atualize a sua rota de RECEBER COMANDO para atualizar também o estado do jogo
@app.route('/api/enviar_comando_serial', methods=['POST'])
def receber_do_painel():
    global comandos_pendentes, estado_jogo
    try:
        dados = request.get_json()
        codigo = dados.get('codigo')
        sala_id = dados.get('sala', 'padrao')

        if codigo:
            # 1. Guarda para o Agente Físico buscar
            comandos_pendentes[sala_id] = codigo
            
            # 2. Atualiza a memória da Tela/Admin
            estado_jogo["bola_atual"] = codigo
            # Adiciona ao histórico (mantém só as ultimas 5)
            estado_jogo["ultimas_bolas"].insert(0, codigo)
            estado_jogo["ultimas_bolas"] = estado_jogo["ultimas_bolas"][:5]
            
            print(f"✅ [JOGO] Bola {codigo} sorteada e atualizada no painel.")
            return jsonify({"status": "ok"}), 200
            
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

# ==============================================================================
# 2. ROTA DE BUSCA (Agente Local -> Servidor)
# ==============================================================================
@app.route('/api/buscar_comando', methods=['GET'])
def entregar_ao_agente():
    try:
        # O Agente pode dizer quem ele é na URL: /api/buscar_comando?sala=001
        # Se não disser, assume 'padrao'
        sala_id = request.args.get('sala', 'padrao')

        # Verifica se tem algo na gaveta dessa sala
        comando = comandos_pendentes.get(sala_id)

        if comando:
            # 1. Entrega a bola
            msg = comando
            
            # 2. LIMPA a gaveta imediatamente para a bola não girar 2 vezes
            comandos_pendentes[sala_id] = None 
            
            print(f"🚀 [ENTREGA] Comando '{msg}' enviado para o Agente ({sala_id})")
            return jsonify({"comando": msg})
        
        # Se a gaveta estiver vazia ou None
        return jsonify({"comando": None})

    except Exception as e:
        print(f"⚠️ Erro na entrega: {e}")
        return jsonify({"comando": None})


@app.route('/api/estado_atual', methods=['GET'])
def ler_estado_tela():
    return jsonify(estado_jogo)


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


# --- VARIÁVEIS GLOBAIS DE VENDAS ---
sales_client = None
current_sales_uri = None
# ==============================================================================
# 🆕 CONFIGURAÇÃO DE ROTEAMENTO (PADRÃO MASTER CONTROLE)
# ==============================================================================

# 1. ID DA SALA (Vem do Docker)
#PARAM_ID_SALA = os.environ.get("IDSALA", "001")
#print(f"🚀 INICIANDO BOOT PARA SALA: {PARAM_ID_SALA}")

# 2. ENDEREÇO DO MASTER CONTROLE (A Lista Telefônica)
URI_CONSULTA_SALAS = "mongodb+srv://tecbin_db_vendas:TecBin24@cluster0.blwq4du.mongodb.net/?appName=Cluster0"

# 3. VARIÁVEIS GLOBAIS DE CONEXÃO (Serão preenchidas pela função abaixo)
URI_SORTEIO_FINAL = None  # Vai conectar em: dados_do_sorteio
URI_VENDAS_FINAL = None   # Vai conectar em: bingo_vendas_db

def buscar_configuracao_master(id_sala_raw):
    global nome_da_Sala

    """
    Acessa db_master_controle -> salas.
    Retorna as DUAS urls separadas (Sorteio e Vendas).
    """
    # 1. Formata para String de 3 dígitos (ex: "1" vira "001")
    id_sala_fmt = str(id_sala_raw).zfill(3)
    
    print(f"🔍 [MASTER] Buscando configuração para ID: '{id_sala_fmt}'...")

    # Padrão de Fallback (Caso falhe o Master, usa um padrão de emergência)
    config = {
        'url_sorteio': "mongodb+srv://rivaldosp:TecBin24@tecbinon.3zsz7md.mongodb.net/?appName=TecBinOn",
        'url_vendas': "mongodb+srv://tecbin_db_vendas:TecBin24@cluster0.blwq4du.mongodb.net/?appName=Cluster0"
    }
    nome_da_Sala = "LOCUTOR"
    client_master = None
    try:
        client_master = MongoClient(URI_CONSULTA_SALAS)
        db_master = client_master.get_database("db_master_controle")
        
        # Busca exata pelo ID formatado
        sala_doc = db_master.salas.find_one({'id_sala': id_sala_fmt})
        
        if sala_doc:
            print(f"✅ [MASTER] Sala {id_sala_fmt} localizada!")
            
            # REGRA 1: url_mongo_sorteio -> dados_do_sorteio
            if 'url_mongo_sorteio' in sala_doc and len(sala_doc['url_mongo_sorteio']) > 10:
                config['url_sorteio'] = sala_doc['url_mongo_sorteio'] 
                print("   -> URL Sorteio: Definida pelo Master.")
            
            # REGRA 2: url_mongo -> bingo_vendas_db
            if 'url_mongo' in sala_doc and len(sala_doc['url_mongo']) > 10:
                config['url_vendas'] = sala_doc['url_mongo']
                print("   -> URL Vendas: Definida pelo Master.")

            if 'nome_sala' in sala_doc and len(sala_doc['nome_sala']) > 2:
                nome_da_Sala = sala_doc['nome_sala']
                print (f"[NOME SALA] :       {nome_da_Sala}")
        else:
            print(f"⚠️ [MASTER] Sala {id_sala_fmt} NÃO encontrada. Usando fallback.")


    except Exception as e:
        print(f"❌ [MASTER] Erro de conexão: {e}")
    finally:
        if client_master: client_master.close()
    
    return config

# --- EXECUTA A BUSCA AGORA (NO INÍCIO DO SCRIPT) ---
_configs = buscar_configuracao_master(PARAM_ID_SALA)
URI_SORTEIO_FINAL = _configs['url_sorteio']
URI_VENDAS_FINAL = _configs['url_vendas']

# Configurações do Ambiente
DB_NAME = os.environ.get("DB_NAME", "dados_do_sorteio") # Nome fixo do banco do jogo
port = int(os.environ.get('PORT', 3001))

# ==============================================================================
# FUNÇÕES DE CONEXÃO (REESCRITAS PARA USAR AS URLS DO MASTER)
# ==============================================================================

def connect_main_db():
    """Conecta no banco do JOGO (dados_do_sorteio) usando URI_SORTEIO_FINAL"""
    global client, db
    try:
        print(f"🔌 [GAME DB] Conectando...")
 
        # Conecta usando a URL específica de sorteio
        client = MongoClient(URI_SORTEIO_FINAL, server_api=ServerApi('1'))
       
        # FORÇA O USO DO BANCO 'dados_do_sorteio'
        # Independente do que está escrito na URL, pegamos esse banco.
        db = client.get_database("dados_do_sorteio")

        # Teste de vida
        client.admin.command('ping') 
        print(f"✅ [GAME DB] Conectado com sucesso em: {db.name}")
        
    except Exception as e:
        print(f"❌ [GAME DB] Erro fatal: {e}")
        sys.exit(1)

def get_sales_db_connection():
    """Conecta no banco de VENDAS (bingo_vendas_db) usando URI_VENDAS_FINAL"""
    global sales_client, current_sales_uri
    
    # Se já tem cliente conectado na URL certa, retorna o banco
    if sales_client and current_sales_uri == URI_VENDAS_FINAL:
        try:
            return sales_client.get_database("bingo_vendas_db")
        except: pass

    # Se não, conecta
    try:
        # print(f"🛒 [SALES DB] Conectando...")
        if sales_client: sales_client.close()
        
        sales_client = MongoClient(URI_VENDAS_FINAL, server_api=ServerApi('1'))
        current_sales_uri = URI_VENDAS_FINAL
        
        # FORÇA O USO DO BANCO 'bingo_vendas_db'
        db_vendas = sales_client.get_database("bingo_vendas_db")
        return db_vendas
        
    except Exception as e:
        print(f"❌ [SALES DB] Erro: {e}")
        return None

#================================================ AQUI
def get_sales_db_connection2():
    """
    Gerencia a conexão com o Banco de Vendas/Clientes.
    Lê a URL de 'parametros.json' (local) ou da coleção 'parametros' do MongoDB (nuvem).
    """
    global sales_client, current_sales_uri, db
    
    # Validação de Segurança: O banco principal (Sorteio) precisa estar conectado
    if 'db' not in globals() or db is None:
        print("⚠️ [VENDAS] Tentativa de conexão antes do Banco de Sorteio estar pronto.")
        return None

    # 1. Busca a URL de conexão (Cascata: Arquivo Local -> Banco Sorteio)
    new_uri = None
    
    # Tenta local primeiro (parametros.json)
    try:
        caminho_local = os.path.join(LOCAL_PATH, 'parametros.json')
        if os.path.exists(caminho_local):
            with open(caminho_local, 'r') as f:
                p = json.load(f)
                if p and len(p) > 0: 
                    new_uri = p[0].get('url_mongo_vendas')
    except Exception as e: 
        print(f"ℹ️ [VENDAS] Ignorando config local: {e}")

    # Se não achou local, busca no Banco de Sorteio (Tabela parametros)
    if not new_uri:
        try:
            # Busca o primeiro documento da coleção parametros
            param_doc = db.parametros.find_one({})
            if param_doc: 
                new_uri = param_doc.get('url_mongo_vendas')
        except Exception as e:
            print(f"❌ [VENDAS] Erro ao ler tabela 'parametros' no Mongo: {e}")

    # Validação Final da URL
    if not new_uri:
        print("❌ [VENDAS] ERRO CRÍTICO: 'url_mongo_vendas' não encontrada em lugar nenhum.")
        return None

    # 2. Lógica de Conexão e Reconexão
    try:
        # Se mudou a URI ou ainda não conectou
        if sales_client is None or new_uri != current_sales_uri:
            
            # Fecha conexão antiga se existir
            if sales_client: 
                print("🔄 [VENDAS] URL mudou. Fechando conexão antiga...")
                sales_client.close()
            
            print(f"🔌 [VENDAS] Iniciando conexão segura...")
            
            # --- O PULO DO GATO (CORREÇÃO SSL DOCKER) ---
            mongo_kwargs = {'server_api': ServerApi('1')}
            if _TLS_CA_FILE: 
                mongo_kwargs['tlsCAFile'] = _TLS_CA_FILE
            # --------------------------------------------
            
            sales_client = MongoClient(new_uri, **mongo_kwargs)
            current_sales_uri = new_uri
            
            # Teste de vida (Ping)
            sales_client.admin.command('ping')
            print("✅ [VENDAS] Conexão estabelecida com sucesso!")
            
        # 3. Retorna o Banco de Dados Específico
        try:
            # Tenta pegar o banco padrão definido na string de conexão
            return sales_client.get_default_database()
        except Exception as e_db:
            print(f"⚠️ [VENDAS] Link sem banco definido. Tentando auto-discovery... ({e_db})")
            
            # Tenta listar os bancos e pegar o primeiro que não seja de sistema
            try:
                bancos = sales_client.list_database_names()
                validos = [b for b in bancos if b not in ['admin', 'local', 'config']]
                if validos:
                    print(f"🔄 [VENDAS] Usando banco detectado: '{validos[0]}'")
                    return sales_client.get_database(validos[0])
            except:
                pass

            # Fallback final se tudo falhar
            NOME_MANUAL = "dados_do_sorteio" 
            print(f"⚠️ [VENDAS] Auto-discovery falhou. Forçando banco: '{NOME_MANUAL}'")
            return sales_client.get_database(NOME_MANUAL)

    except Exception as e:
        print(f"❌ [VENDAS] Erro fatal na conexão: {e}")
        return None


@app.route('/api/verificar_status_evento', methods=['GET'])
def verificar_status_evento():
    try:
        # 1. Pega e Valida o ID
        id_evento_str = request.args.get('id_evento')
        if not id_evento_str:
            return jsonify({'erro': 'ID não informado'}), 400

        id_evento = int(id_evento_str)

        # 2. Conecta no Banco (Usando sua função robusta)
        sales_db = get_sales_db_connection()
        
        if sales_db is None:
            print("❌ Erro: A função get_sales_db_connection falhou.")
            return jsonify({'erro': 'Falha na conexão com vendas'}), 500

        # 3. Busca o Evento
        # Tenta buscar pelo ID numérico
        #print(f"🔎 Buscando Evento {id_evento} no banco '{sales_db.name}'...")
        evento = sales_db.eventos.find_one({'id_evento': id_evento})

        if not evento:
            # Retornamos 200 (Sucesso de rede) mas com status 'erro' no JSON
            return jsonify({
                'status': 'nao_encontrado', 
                'msg': f'Evento {id_evento} nao existe no banco de vendas',
                'numeracao_atual_venda': 1 # Valor padrão de segurança
            }), 200

        controle = sales_db.controle_venda.find_one({'id_evento': id_evento})
        
        proximo_numero = controle.get('inicial_proxima_venda', 1) if controle else 1

        # 4. Retorna o Resultado
        if evento:
            print(f"✅ SUCESSO! Foto encontrada: {evento.get('imagem_premio')}")
            return jsonify({
                'id': str(id_evento),
                'status': evento.get('status', 'indefinido'),
                'numeracao_atual_venda': proximo_numero, # Adicionado para o modal
                'imagem_premio': evento.get('imagem_premio', ''),
                'premio_atual': evento.get('premio_atual', 'BINGO'),
                'descricao': evento.get('descricao', f'Evento {id_evento}'),
                'valor_de_venda': valor,
                'unidade_de_venda': unidade,
                'preco_cartela': valor
            })
        else:
            print(f"❌ Evento {id_evento} não encontrado em '{sales_db.name}'.")
            return jsonify({'status': 'nao_encontrado'}), 404

    except ValueError:
        return jsonify({'erro': 'ID deve ser número'}), 400
    except Exception as e:
        print(f"Erro no servidor: {e}")
        return jsonify({'status': 'erro'}), 500



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
        # ⚠️ RETIRAMOS O .limit(5) DAQUI para podermos varrer toda a agenda!
        cursor = sales_db.eventos.find({
            'status': {'$in': ['ativo', 'paralizado', 'ATIVO', 'PARALIZADO']}
        }).sort([('data_evento', 1), ('hora_evento', 1)])

        # --- FUNÇÕES AUXILIARES SEGURAS ---
        def to_float(val):
            if val is None: return 0.0
            try:
                return float(str(val))
            except:
                return 0.0

        def fmt_money(val_float):
            return f"R$ {val_float:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        # ----------------------------------
        
        for evt in cursor:
            try:

                valor_safe = converter_decimal(evt.get('valor_de_venda'))
                
                # CONSTRUÇÃO DA LISTA DE PRÊMIOS
                lista_premios_dinamica = []

                val = to_float(evt.get('premio_quadra'))
                if val > 0: lista_premios_dinamica.append(f"Quadra: {fmt_money(val)}")

                val = to_float(evt.get('premio_linha'))
                qtd_linhas = int(evt.get('quantidade_de_linhas', 1))
                if val > 0:
                    nome = "Linha" if qtd_linhas == 1 else f"{qtd_linhas} Linhas"
                    lista_premios_dinamica.append(f"{nome}: {fmt_money(val)}")

                val = to_float(evt.get('premio_segundobingo'))
                if val > 0: lista_premios_dinamica.append(f"2º Bingo: {fmt_money(val)}")
                
                val = to_float(evt.get('premio_bingo'))
                if val > 0: lista_premios_dinamica.append(f"Bingo: {fmt_money(val)}")

                val = to_float(evt.get('premio_faltaum'))
                if val > 0: lista_premios_dinamica.append(f"Falta 1: {fmt_money(val)}")

                lista.append({
                    'id_evento': str(evt.get('id_evento')),
                    'descricao': evt.get('descricao', 'Sem Descrição'),
                    'status': evt.get('status', 'ativo'),
                    'data': evt.get('data_evento'),
                    'hora': evt.get('hora_evento'),
                    'valor_cartela': valor_safe,
                    'unidade_venda': evt.get('unidade_de_venda', 1),
                    
                    # 👉 ADICIONADO: Mandamos o tipo_de_evento para o Front-End
                    'tipo_de_evento': str(evt.get('tipo_de_evento', '')).strip().lower(),
                    
                    'premios_desc': lista_premios_dinamica 
                })
            except Exception as e: 
                print(f"Erro ao processar evento na lista: {e}")
                continue

        # ==================================================================
        # 🌟 REGRA DE NEGÓCIO: DESTAQUE DO EVENTO ESPECIAL
        # ==================================================================
        indice_especial = -1    #
        
        # 1. Procura o primeiro evento Especial na fila completa
        for i, evento_dict in enumerate(lista):
            if evento_dict.get('tipo_de_evento') == 'especial':
                indice_especial = i
                break

        # 2. Se encontrou e ele está abaixo da posição 2, nós o movemos!
        if indice_especial > 2:
            evento_super = lista.pop(indice_especial)
            lista.insert(2, evento_super)

        # 3. Agora sim, cortamos a lista para exibir apenas os 5 no telemóvel!
        lista = lista[:8]
        # ==================================================================

        return jsonify(lista)

    except Exception as e:
        print(f"❌ Erro ao listar eventos: {e}")
        return jsonify({'error': str(e)}), 500


# --- ROTA ATUALIZADA: FECHAR VENDAS (CORREÇÃO DE FUSO E MEIA-NOITE) ---
def finalizar_evento_interno(id_evt):
    """
    Função central que finaliza as vendas de um evento.
    Pode ser chamada pelo botão do Admin ou pelo Robô automático.
    """
    sales_db = get_sales_db_connection()
    if sales_db is None: 
        return False, "Sem conexão com DB Vendas", 500

    try:
        # 1. Busca configuração de tempo (grace period)
        tempo_espera_seg = 120 # Padrão
        try:
            # Nota: Certifique-se de que a variável 'db' está acessível aqui
            param = db.parametros.find_one({})
            if param and 'aviso_fim_das_vendas' in param:
                tempo_espera_seg = int(param['aviso_fim_das_vendas'])
        except: pass

        # 2. Calcula Hora Final (Ajustado para Fuso Brasil -3h)
        agora_br = hora_brasil()
        hora_final_obj = agora_br + timedelta(seconds=tempo_espera_seg)
        hora_final_str = hora_final_obj.strftime("%H:%M:%S")

        # 3. Envia o Aviso para a tela (Para o Frontend iniciar o cronômetro)
        msg_aviso = "Atenção, em instantes o sorteio irá iniciar, Boa Sorte!"
        tempo_para_envio = str(tempo_espera_seg) 
        
        threading.Thread(target=enviar_aviso_sistema, args=("Vendas Encerradas", msg_aviso, tempo_para_envio)).start()

        param_config = db.parametros.find_one({}) or {}
        is_ativo_extra_global = param_config.get('buscar_sorte_extra', True)

        # 4. Atualiza status no banco de vendas
        filtro = {'id_evento': int(id_evt)}
        if not sales_db.eventos.find_one(filtro):
            filtro = {'id_evento': str(id_evt)}

        # Finalizar o evento
        result = sales_db.eventos.update_one(filtro, {'$set': {'status': 'finalizado'}})        
        
        if result.modified_count > 0:
            if is_ativo_extra_global: 
               atualizar_ponteiro_sorte_extra(int(id_evt))
            try:
                gerar_snapshot_vendas(id_evt, sales_db)
            except Exception as e_snap:
                print(f"⚠️ Erro ao gerar snapshot de auditoria: {e_snap}")

            print(f"🤖/👨‍💻 Evento {id_evt} FINALIZADO. Snapshot gerado. Vendas até aprox: {hora_final_str} (BRT)")
            return True, "Vendas encerradas, snapshot gerado e aviso enviado.", 200

    except Exception as e:
        print(f"Erro interno ao fechar vendas: {e}")
        return False, str(e), 500	



@app.route('/api/admin/fechar_vendas_evento', methods=['POST'])
def admin_fechar_vendas():
    data = request.json
    id_evt = data.get('id_evento')
    
    if not id_evt: 
        return jsonify({'error': 'ID do evento necessário'}), 400

    # 👉 CHAMA O NOSSO "MOTOR"
    sucesso, mensagem, codigo_http = finalizar_evento_interno(id_evt)

    if sucesso:
        return jsonify({'status': 'ok', 'msg': mensagem}), codigo_http
    elif codigo_http == 200: # É o caso do "Evento já finalizado"
        return jsonify({'status': 'warning', 'msg': mensagem}), 200
    else:
        return jsonify({'error': mensagem}), codigo_http0


@app.route('/api/admin/avisar_transicao_robo', methods=['POST'])
def rota_avisar_transicao_robo():
    try:
        data = request.json
        tempo_restante = data.get('tempo_restante', 0)
        
        if not tempo_restante:
            return jsonify({'error': 'Tempo não informado'}), 400

        # O título e a mensagem exata que você sugeriu!
        titulo = "Intervalo" # Use o título que o seu terminal de cliente já reconhece
        msg_aviso = "Intervalo restante para o início do próximo Sorteio"
        tempo_para_envio = str(tempo_restante) 
        
        # Dispara o aviso para todos os clientes via Thread (não trava o servidor)
        threading.Thread(
            target=enviar_aviso_sistema, 
            args=(titulo, msg_aviso, tempo_para_envio)
        ).start()

        return jsonify({'status': 'ok', 'msg': 'Clientes avisados!'})

    except Exception as e:
        print(f"Erro ao avisar transição: {e}")
        return jsonify({'error': str(e)}), 500


# Rota Consultar Cartelas e Cupons (Unificada e Blindada para Docker)
@app.route('/api/consultar_cartelas_evento')
def api_consultar_cartelas():
    try:
        # 1. PEGA PARÂMETROS E VALIDA CONEXÃO LOGO DE CARA
        id_evt = request.args.get('id_evento')
        id_cli = request.args.get('id_cliente')
        
        s_db = get_sales_db_connection()
        if s_db is None:
            return jsonify({'error': 'Falha na conexão com o Banco de Dados de Vendas'}), 500

        # 2. DEFINIÇÃO SEGURA DA VARIÁVEL (Evita Erro 500 por variável inexistente)
        id_cli_val = id_cli 

        # Se a URL não trouxe o ID, tentamos a sessão do Flask
        if not id_cli_val or id_cli_val in ['null', 'undefined', '']:
            id_cli_val = session.get('id_cliente')

        if not id_cli_val:
            return jsonify({'error': 'Cliente não identificado (ID ausente)'}), 401
        
        # 3. TRATAMENTO DE TIPAGEM HÍBRIDA (Importante para o Docker/Linux)
        try:
            # Tenta converter para inteiro caso o banco armazene como Number
            id_cli_val_processado = int(id_cli_val)
        except (ValueError, TypeError):
            # Se falhar (ID alfanumérico), mantém o valor original
            id_cli_val_processado = id_cli_val

        # Filtro que busca as duas possibilidades (Int e String) para evitar falhas de migração
        filtro_cliente = {
            '$or': [
                {'id_cliente': id_cli_val_processado}, 
                {'id_cliente': str(id_cli_val_processado)}
            ]
        }

        # --- 1. BUSCA BINGO NORMAL ---
        col_bingo = f"vendas{id_evt}"
        cartelas_bingo = []
        
        # Verificamos se a coleção existe para evitar erros de cursor no Docker
        if col_bingo in s_db.list_collection_names():
            cursor = s_db[col_bingo].find(filtro_cliente)
            for v in cursor:
                try:
                    n_ini = int(v.get('numero_inicial') or 0)
                    n_fim = int(v.get('numero_final') or 0)
                    if n_ini > 0: 
                        cartelas_bingo.extend(range(n_ini, n_fim + 1))
                    
                    n_ini2 = int(v.get('numero_inicial2') or 0)
                    n_fim2 = int(v.get('numero_final2') or 0)
                    if n_ini2 > 0: 
                        cartelas_bingo.extend(range(n_ini2, n_fim2 + 1))
                except Exception:
                    continue
        
        # --- 2. BUSCA SORTE EXTRA ---
        try:
            id_evt_limpo = int(id_evt) 
        except:
            id_evt_limpo = id_evt
            
        col_extra = f"vendas_sorte_extra{id_evt_limpo}"
        cupons_extra = []
        
        # No Sorte Extra, buscamos direto (o cursor vazio não quebra o Python se a col não existir)
        cursor_extra = s_db[col_extra].find(filtro_cliente)
        
        for v in cursor_extra:
            meus_jogos = v.get('cartelas', [])
            if isinstance(meus_jogos, list):
                cupons_extra.extend(meus_jogos)

        # 4. RETORNO DE SUCESSO
        return jsonify({
            'id_evento': id_evt, 
            'cartelas': cartelas_bingo,
            'quantidade': len(cartelas_bingo),
            'cupons_extra': cupons_extra, 
            'qtd_extra': len(cupons_extra),
            'status': 'success'
        }), 200

    except Exception as e:
        # Log detalhado no console do Docker para facilitar o seu debug
        print(f"❌ ERRO CRÍTICO NA API (Docker/Backend): {str(e)}")
        return jsonify({'error': f"Erro interno: {str(e)}"}), 500


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


# --- ROTA PARA LEITURA DAS CONFIGURAÇÕES GLOBAIS (ATUALIZADA) ---
@app.route('/api/admin/get_config', methods=['GET'])
def admin_get_config():
    try:
        # Busca o documento de parâmetros (presumindo que seja único)
        config = db.parametros.find_one({}, {'_id': 0})
        if config:
            return jsonify(config)
        return jsonify({'error': 'Configuração não encontrada'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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

    # 👉 NOVO: PLATAFORMA DE STREAMING
    if 'plataforma_streaming' in data:
        update_fields['plataforma_streaming'] = str(data['plataforma_streaming']).strip().lower()

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

    # 7. Controle da Sorte Extra (Boolean)
    if 'buscar_sorte_extra' in data:
        update_fields['buscar_sorte_extra'] = bool(data['buscar_sorte_extra'])

    # 8. Enviar Porta Serial (Boolean)
    if 'enviar_porta_serial' in data:
        update_fields['enviar_porta_serial'] = bool(data['enviar_porta_serial'])


    if update_fields:
        try:
            # Atualiza no Banco (Coleção parametros)
            db.parametros.update_one({}, {'$set': update_fields}, upsert=True)

            # ==================================================================
            # 🛡️ BLOCO DE SINCRONIZAÇÃO (Só roda se mexeu na chave ou se o DB existe)
            # ==================================================================
            
            # Só entra aqui se o usuário mandou alterar ESSE campo especificamente
            if 'buscar_sorte_extra' in update_fields:
                
                sales_db = get_sales_db_connection()
                
                if sales_db:
                    # Pega o valor booleano já tratado ali em cima
                    IsSorteExtra = update_fields['buscar_sorte_extra']
                    
                    if not IsSorteExtra:
                        # --- CENÁRIO: DESATIVAR ---
                        print("🔒 [CONFIG] Chave Geral OFF. Paralisando vendas Sorte Extra.")
                        sales_db.sorte_extra_config.update_one({}, {
                            '$set': {
                                'id_evento': "0",   # Quebra o vínculo
                                'status': 'inativo' # Marca inativo
                            }
                        })
                    
                    else:
                        # --- CENÁRIO: ATIVAR ---
                        print("🔓 [CONFIG] Chave Geral ON. Reativando Sorte Extra...")
                        
                        rodada_local = db.rodada.find_one({}) or {}
                        id_atual = int(rodada_local.get('id_evento', 0))
                        
                        # Verifica status do evento atual
                        evt_venda = sales_db.eventos.find_one({
                            'id_evento': {'$in': [id_atual, str(id_atual)]}
                        })
                        
                        status_atual = evt_venda.get('status', 'aberto') if evt_venda else 'aberto'
                        
                        if status_atual == 'finalizado':
                            print(f"👉 Evento {id_atual} já finalizado. Apontando para o PRÓXIMO...")
                            atualizar_ponteiro_sorte_extra(id_atual)
                        
                        else:
                            print(f"👉 Evento {id_atual} aberto. Reativando vendas para ELE MESMO.")            
                            sales_db.sorte_extra_config.update_one({}, {
                                '$set': {
                                    'id_evento': str(id_atual),
                                    'status': 'ativo'
                                }
                            })
                else:
                    print("⚠️ Aviso: Sales DB offline. Configuração salva localmente, mas não sincronizada.")

            return jsonify({'status': 'Configurações salvas', 'campos': update_fields})

        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Nenhum dado válido enviado'}), 400


@app.route('/api/admin/publicar_bola', methods=['POST'])
def publicar_bola():
    try:
        data = request.json
        bola = int(data.get('bola'))
        
        # 1. CAPTURA O TEMPO DO VÍDEO (Padrão é 0 se falhar ou vier vazio)
        tempo_video = data.get('tempo_video', 0) 
        
        # 2. Busca as bolas que JÁ estavam públicas antes
        dados_atuais = db.bolas.find_one({}) or {}
        lista_publica = dados_atuais.get('bolas_cantadas', [])
        
        # 3. Adiciona a nova bola na lista (se não for repetida)
        if bola not in lista_publica:
            lista_publica.append(bola)
        
        # 4. ATUALIZA o documento existente (Não cria um novo!)
        db.bolas.update_one({}, {
            '$set': {
                'bolas_cantadas': lista_publica,
                'proxima_bola': bola,
                'ordem': len(lista_publica),
                'ultimas_bolas': lista_publica[-3:], # Pega as últimas 3
                'timestamp': datetime.now()
            }
        }, upsert=True)
        
        # 5. Avisa as TVs / Telemóveis (AGORA COM O TEMPO DO VÍDEO!)
        print(f"📢 Enviando bola {bola} (Sync Video: {tempo_video}s) para as TVs")
        broadcast_para_clientes({
            'type': 'UPDATE',
            'ultimaBola': bola,
            'tempo_video': tempo_video, # <<< A MÁGICA AQUI!
            # Opcional: Mandar a lista toda garante que quem reconectar pegue tudo
            'bolasData': [{'bolas_cantadas': lista_publica, 'proxima_bola': bola}]
        })
        
        return jsonify({'status': 'ok'})

    except Exception as e:
        print(f"Erro publicar_bola: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/sortear_mesa', methods=['POST'])
def admin_sortear_mesa():
    global db, timeStart, CACHE_MAX_BOLAS
    if db is None: return jsonify({'error': 'Sem conexão com DB'}), 500
    
    try:
        data = request.json or {}
        print(f"\n📥 [API BOLA] Dados recebidos do painel: {data}")

        # 1. PEGAMOS A BOLA QUE O LOCUTOR ESCOLHEU
        nova_bola = data.get('bola') 
        id_evento = data.get('id_evento')

        # 🚀 FORÇA A CONVERSÃO E LOGA OS TIPOS DE DADOS
        if id_evento is not None:
            id_evento = int(id_evento)
            
        print(f"🔍 [API BOLA] Analisando: Bola={nova_bola} (Tipo: {type(nova_bola).__name__}) | Evento={id_evento} (Tipo: {type(id_evento).__name__})")

        if nova_bola is None:
            print("❌ [API BOLA] ERRO: O JSON não continha a chave 'bola'!")
            return jsonify({'error': 'Nenhuma bola enviada pelo Admin'}), 400

        # 2. BUSCAMOS A LISTA ATUAL DA TABELA OFICIAL (bolas)
        doc_oficial = db.bolas.find_one({}) or {}
        bolas_cantadas = doc_oficial.get('bolas_cantadas', [])        
        print(f"📋 [API BOLA] Tabela atual tem {len(bolas_cantadas)} bolas. Lista: {bolas_cantadas}")

        # 3. SEGURANÇA: Se a bola já estiver lá, não duplicamos
        if int(nova_bola) not in bolas_cantadas:
            bolas_cantadas.append(int(nova_bola))
            print(f"✅ [API BOLA] Bola {nova_bola} inédita. Adicionada com sucesso!")
        else:
            print(f"⚠️ [API BOLA] AVISO: A bola {nova_bola} já estava sorteada. Ignorando duplicata.")

        if len(bolas_cantadas) == 1:
            timeStart = datetime.now()

        # 4. ATUALIZAÇÃO SÍNCRONA
        update_data = {
            '$set': {
                'bolas_cantadas': bolas_cantadas,
                'proxima_bola': int(nova_bola),          
                'ordem': len(bolas_cantadas),
                'ultimas_bolas': bolas_cantadas[-3:],
                'id_evento': id_evento
            }
        }

        print(f"💾 [API BOLA] Atualizando as duas tabelas no MongoDB (bolas e bolas_mesa)...")

        # Como era no original: Atualiza o único registo existente nas tabelas
        #db.bolas.update_one({}, update_data, upsert=True)
        db.bolas_mesa.update_one({}, update_data, upsert=True)
        
        # 5. DISPARA O RANKING   # aqui demora
        print(f"⚙️ [API BOLA] Iniciando Thread para recalcular o Ranking nas cartelas...")
        threading.Thread(target=recalcular_ranking_principal).start()

        print(f"🚀 [API BOLA] Fluxo concluído! Retornando OK para o JavaScript.")
        return jsonify({'status': 'sincronizado', 'bola': nova_bola, 'total': len(bolas_cantadas)})
        
    except Exception as e:
        print(f"❌ [API BOLA] ERRO CRÍTICO NA SINCRONIZAÇÃO DA BOLA: {e}")
        traceback.print_exc() # Isso vai mostrar no terminal qual linha exata causou o erro!
        return jsonify({'error': str(e)}), 500


# Endpoint para Sortear Bola
@app.route('/api/admin/sortear', methods=['POST'])
def admin_sortear():
    global db, timeStart, CACHE_MAX_BOLAS
    if db is None: return jsonify({'error': 'Sem conexão com DB'}), 500
    
    try:
        # Pega dados enviados (se houver)
        data = request.json or {}
        bola_manual = data.get('bola_manual') # Pode ser None

        # 1. Busca bolas já sorteadas
        dados_bolas = db.bolas.find_one({})
        bolas_cantadas = dados_bolas.get('bolas_cantadas', []) if dados_bolas else []
        
        MAX_BOLAS = CACHE_MAX_BOLAS 

        # 2. Verifica fim de jogo
        if len(bolas_cantadas) >= MAX_BOLAS:
            return jsonify({'error': 'Todas as bolas já foram sorteadas'}), 400

        nova_bola = 0

        if bola_manual:
            # --- MODO MANUAL ---
            nova_bola = int(bola_manual)
            if nova_bola < 1 or nova_bola > MAX_BOLAS:
                return jsonify({'error': f'Bola deve ser entre 1 e {MAX_BOLAS}'}), 400
            if nova_bola in bolas_cantadas:
                return jsonify({'error': f'Bola {nova_bola} já foi sorteada!'}), 400
        else:
            # --- MODO AUTOMÁTICO (RANDOM) ---
            import random
            todas_bolas = list(range(1, MAX_BOLAS + 1))
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
                'proxima_bola': len(bolas_cantadas),  # nova_bola
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
        "status": "conferindo",
        "tipo_conferencia": "BINGO_NORMAL"
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
                'hora': hora_brasil().strftime("%H:%M:%S")
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
    try:
        data = request.json
        cartela_id_str = str(data.get('cartela'))
        try:
            cartela_id_int = int(cartela_id_str)
        except:
            return jsonify({'status_code': 'ERROR', 'msg': 'Cartela inválida', 'layout': {'lista': []}})
        
        # 1. IDENTIFICA O EVENTO ATIVO
        rodada_info = db.rodada.find_one({})
        id_evento_ativo = rodada_info.get('id_evento') if rodada_info else 0
        
        if not id_evento_ativo:
             return jsonify({'status_code': 'ERROR', 'msg': 'Nenhum evento ativo.', 'layout': {'lista': []}})

        # ==============================================================================
        # OTIMIZAÇÃO: BUSCA O NOME DIRETAMENTE DO CACHE DO JOGO (MELHORES/TOP 10)
        # ==============================================================================
        ganhador_nome = "Balcão / Anônimo"
        
        # A coleção 'melhores' já contém as cartelas em jogo com os nomes processados
        # Se a cartela está validando prêmio, ela certamente está nesta lista.
        cartela_em_jogo = db.melhores.find_one({
            "$or": [{"cartela": cartela_id_str}, {"cartela": cartela_id_int}]
        })

        if cartela_em_jogo:
            # Pega o nome que já foi processado pelo motor do jogo
            ganhador_nome = cartela_em_jogo.get('nome', 'Cliente Sem Nome')
            print(f"✅ [CACHE] Nome recuperado de 'melhores': {ganhador_nome}")
        else:
            # Se não está nos melhores, é muito estranho (pode ser cartela não vendida ou erro)
            # Mantemos como Anônimo ou podemos bloquear se preferir.
            print(f"⚠️ [CACHE] Cartela {cartela_id_str} não encontrada em 'melhores'. Usando Anônimo.")

        # ==============================================================================

        # 3. BUSCA LAYOUT (Para desenhar no Admin)
        cartela = db.cartelas.find_one({
            "$or": [{"cartao": cartela_id_str}, {"cartao": cartela_id_int}]
        })

        if not cartela:
            return jsonify({'status_code': 'NOT_FOUND', 'msg': 'Layout não encontrado', 'layout': { 'lista': [] }}), 404

        # 4. PREPARA DADOS
        dados_bolas = db.bolas_mesa.find_one({})
        bolas_lista = dados_bolas.get('bolas_cantadas', []) if dados_bolas else []
        
        premio_doc = db.buscando_mesa.find_one({})
        premio_nome = premio_doc.get('buscando_o_premio', 'BINGO').upper()
        
        # 5. EXECUTA VALIDAÇÃO E ENVIA PARA TV
        resultado = logica_validacao_bingo_75(
            cartela_id_str, 
            cartela, 
            bolas_lista, 
            premio_nome, 
            id_evento_ativo, 
            ganhador_nome
        )

        numeros_cartela = cartela.get('geral') or cartela.get('numeros') or cartela.get('lista_75') or []

        return jsonify({
            'status_code': resultado['status_code'],
            'msg': resultado['msg'],
            'cartela_id': cartela_id_str,
            'ganhador': ganhador_nome,
            'bolas': resultado['bolas'],
            'layout': { 'tipo': 75, 'lista': numeros_cartela }
        })

    except Exception as e:
        print(f"Erro validar 75: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/validar_cartela', methods=['POST'])
def admin_validar_cartela():
    global db
    print("📥 [VALIDAÇÃO 90] Recebendo requisição...") # Log para debug
    
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

        # ==============================================================================
        # 2. VERIFICA O NOME (OTIMIZADO VIA CACHE MELHORES)
        # Substitui a busca lenta no banco de vendas pela busca rápida no cache do jogo
        # ==============================================================================
        nome_ganhador = "Balcão / Anônimo"
        
        # Busca na coleção 'melhores'. Verifica int e str para garantir.
        cartela_cache = db.melhores.find_one({
            '$or': [
                {'cartela': cartela_id}, 
                {'cartela': str(cartela_id)}
            ]
        })
        
        if cartela_cache:
            nome_ganhador = cartela_cache.get('nome', 'Cliente Sem Nome')
        else:
            # Se não está em 'melhores', a cartela pode não ter sido carregada para o jogo.
            # Mantemos como Anônimo, mas logamos o aviso.
            print(f"⚠️ [VALIDAÇÃO 90] Cartela {cartela_id} não encontrada no cache 'melhores'.")
            
            # (Opcional) Se quiser bloquear cartelas que não estão no jogo, descomente:
            # return jsonify({'status_code': 'NOT_SOLD', 'msg': f'⛔ Cartela {cartela_id} fora de jogo!', 'layout': None})

        # ==============================================================================

        # 3. BUSCA O LAYOUT NO BANCO
        cartela_doc = db.cartelas.find_one({'cartao': cartela_id})
        if not cartela_doc: 
            return jsonify({'status_code': 'MISSING_MATRIX', 'msg': 'Layout não cadastrado.'})

        # --- DADOS GERAIS DO JOGO ---
        dados_bolas = db.bolas_mesa.find_one({})
        bolas_lista = dados_bolas.get('bolas_cantadas', []) if dados_bolas else []
        bolas_set = set(bolas_lista)
        
        premio_doc = db.buscando_mesa.find_one({})
        premio_nome = premio_doc.get('buscando_o_premio', '').replace(" ", "").upper()

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
            "numeros": str_numeros_formatada, "ganhador": nome_ganhador, "status": "conferindo","status": "conferindo","tipo_conferencia": "BINGO_NORMAL"
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
                raw_val = 0.0
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
                         valor_monetario_str = f"R$ {raw_val:,.2f}".replace('.', ',')
                except: pass

                db.ganhadores.insert_one({
                    'premio': premio_registro,
                    'valor_total_premio': valor_monetario_str,
                    'cartela': cartela_id,
                    'nome': nome_ganhador,
                    'valor_rateio': valor_monetario_str,
                    'linha_ganha_tag': linha_ganha,
                    'hora': hora_brasil().strftime("%H:%M:%S")
                }) # brasil

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


@app.route('/api/admin/atualizar_conferencia_extra', methods=['POST'])
def atualizar_conferencia_extra():
    global db
    if db is None: 
        return jsonify({'error': 'Sem conexão com DB'}), 500

    try:
        data = request.json or {}
        
        # 1. Limpamos a tabela para garantir que não haja lixo de conferências passadas
        db.confere.delete_many({})

        # 2. Preparamos o documento com os campos que o Terminal espera
        # Note que mantemos a estrutura que você já usa, mas com o novo "tipo_conferencia"
        doc_conferencia = {
            "rodada": data.get('rodada', 0),
            "cartao": data.get('cartao', 0),
            "numeros": data.get('numeros', "null"),     # Aqui vão as dezenas do cupom
            "ganhador": data.get('ganhador', "null"),   # Nome do cliente
            "mensagem": data.get('mensagem', "SORTE EXTRA!"),
            "status": "conferindo",
            "tipo_conferencia": "SORTE_EXTRA"           # Identificador para a TV mudar o layout
        }

        # 3. Inserimos o novo registro de conferência
        db.confere.insert_one(doc_conferencia)
        
        print(f"🍀 [CONFERÊNCIA] Cupom {doc_conferencia['cartao']} enviado para o Terminal.")
        
        return jsonify({"status": "success", "tipo": "SORTE_EXTRA"})

    except Exception as e:
        print(f"❌ Erro ao atualizar conferência extra: {e}")
        return jsonify({'error': str(e)}), 500


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


# --- FUNÇÃO RESETAR CORRIGIDA (COMPATÍVEL COM PYMONGO NOVO) ---
@app.route('/api/admin/resetar', methods=['POST'])
def admin_resetar():
    global db, timeStart
    print("\n🏁 [DEBUG] Iniciando rotina admin_resetar...")

    if db is None: 
        print("❌ [DEBUG] Erro: DB Principal é None")
        return jsonify({'error': 'Sem conexão com DB'}), 500
    
    data = request.json or {}
    finalizar_com_sucesso = data.get('finalizar_sucesso', False)
    ganhadores_extra = data.get('ganhadores_extra', []) 
    print(f"📦 [DEBUG] Payload recebido. Finalizar: {finalizar_com_sucesso}, Extras: {len(ganhadores_extra)}")

    try:
        # --- 0. PREPARAÇÃO ---
        rodada_info = db.rodada.find_one({}) or {}
        raw_id = rodada_info.get('id_evento')
        id_evento = int(raw_id) if raw_id else 0 
        print(f"🆔 [DEBUG] ID Evento identificado: {id_evento}")

        descricao = f"Evento {id_evento}"
        sales_db = None 

        try:
            print("🔌 [DEBUG] Tentando conectar ao Sales DB...")
            sales_db = get_sales_db_connection() 
            
            # CORREÇÃO 1: Uso de 'is not None'
            if sales_db is not None:
                print("✅ [DEBUG] Sales DB conectado com sucesso.")
                evt_original = sales_db.eventos.find_one({
                    'id_evento': {'$in': [id_evento, str(id_evento)]}
                })
                if evt_original:
                    descricao = evt_original.get('descricao', descricao)
                else:
                    p_local = db.parametros.find_one({}) or {}
                    descricao = p_local.get('nome_sala', descricao)
            else:
                print("⚠️ [DEBUG] ALERTA: Sales DB retornou None (Conexão falhou?)")
                p_local = db.parametros.find_one({}) or {}
                descricao = p_local.get('nome_sala', descricao)

        except Exception as e_desc:
            print(f"⚠️ [DEBUG] Erro ao buscar descrição: {e_desc}")
            p_local = db.parametros.find_one({}) or {}
            descricao = p_local.get('nome_sala', descricao)

        dados_bolas = db.bolas_mesa.find_one({}) or {}
        bolas_lista = dados_bolas.get('bolas_cantadas', [])
        total_bolas = len(bolas_lista)
        print(f"🎱 [DEBUG] Total de bolas cantadas: {total_bolas}")
        now = hora_brasil()
        data_hoje = now.strftime("%d/%m/%Y")
        hora_atual = now.strftime("%H:%M")
        hora_inicial = timeStart.strftime("%H:%M") if timeStart else hora_atual

        # --- 1. PROCESSAMENTO DOS GANHADORES (NORMAL - BINGO) ---
        ganhadores_ativos = list(db.ganhadores.find({}))
        print(f"🏆 [DEBUG] Ganhadores (Bingo Normal) no banco local: {len(ganhadores_ativos)}")
        
        tabela_premios = db.premio.find_one({}) or {}
        
        lista_osganhadores = []      
        lista_resultados_ganhadores = [] 

        if ganhadores_ativos:
            grupos_rateio = {}
            for g in ganhadores_ativos:
                raw_premio = g.get('premio', '').upper()
                
                # Agrupamento Inteligente
                if 'LINHA' in raw_premio:
                    if 'SUP' in raw_premio: chave_base = "LINHA SUPERIOR"
                    elif 'CEN' in raw_premio: chave_base = "LINHA CENTRAL"
                    elif 'INF' in raw_premio: chave_base = "LINHA INFERIOR"
                    else: chave_base = "LINHA"
                elif 'DUPLO' in raw_premio: chave_base = "DUPLO BINGO"
                elif 'BINGO' in raw_premio: chave_base = "BINGO"
                elif 'QUADRA' in raw_premio: chave_base = "QUADRA"
                elif 'FALTA' in raw_premio: chave_base = "FALTA UM"
                elif 'ACUMULADO' in raw_premio: chave_base = "ACUMULADO"
                else: chave_base = raw_premio

                if chave_base not in grupos_rateio: grupos_rateio[chave_base] = []
                grupos_rateio[chave_base].append(g)

            # Calcula Rateios Bingo Normal
            for chave, lista_vencedores in grupos_rateio.items():
                qtde_ganhadores = len(lista_vencedores)
                val_total_float = 0.0
                
                if "LINHA" in chave: val_total_float = converter_decimal(tabela_premios.get('premio_linha'))
                elif chave == "QUADRA": val_total_float = converter_decimal(tabela_premios.get('premio_quadra'))
                elif chave == "BINGO": val_total_float = converter_decimal(tabela_premios.get('premio_bingo'))
                elif chave == "DUPLO BINGO": val_total_float = converter_decimal(tabela_premios.get('premio_duplo_bingo'))
                elif chave == "FALTA UM": val_total_float = converter_decimal(tabela_premios.get('premio_falta_Um'))
                elif chave == "ACUMULADO": val_total_float = converter_decimal(tabela_premios.get('premio_acumulado'))
                
                if val_total_float == 0.0 and len(lista_vencedores) > 0:
                     val_str_temp = lista_vencedores[0].get('valor_total_premio', '0')
                     val_total_float = parse_brl(val_str_temp)

                if qtde_ganhadores > 0: 
                    divisao_bruta = val_total_float / qtde_ganhadores
                    # Arredonda para baixo  
                    #val_rateio_float = float(int(divisao_bruta))

                    # Arredonda para baixo
                    val_rateio_float = float(math.ceil(divisao_bruta))
                else:
                    val_rateio_float = 0.0

                str_total = f"R$ {format_brl(val_total_float)}"
                str_rateio = f"R$ {format_brl(val_rateio_float)}"

                # Atualiza no Banco local
                db.ganhadores.update_many(
                    {'_id': {'$in': [w['_id'] for w in lista_vencedores]}},
                    {'$set': {'valor_total_premio': str_total, 'valor_rateio': str_rateio}}
                )
                
                for w in lista_vencedores:
                    obj_ganhador = {
                        "premio": chave,
                        "valor_total_premio": str_total,
                        "cartela": str(w.get('cartela', '0')),
                        "nome": str(w.get('nome', '---')),
                        "valor_rateio": str_rateio,
                        "tipo_premiacao": "Normal" 
                    }
                    item_local = obj_ganhador.copy()
                    item_local['rodada'] = id_evento
                    lista_osganhadores.append(item_local)
                    lista_resultados_ganhadores.append(obj_ganhador)

                    # ====================================================================
                    # 👉 NOVO: PAGAMENTO DO RATEIO NO FECHAMENTO DO EVENTO
                    # Só paga se o evento for finalizado com SUCESSO (botão verde)
                    # ====================================================================
                    # Dentro do loop de vencedores na rota /api/admin/resetar
                    if finalizar_com_sucesso and val_rateio_float > 0 and sales_db is not None:
                        try:
                            # 1. Busca o dono da cartela (essencial para saber quem pagar)
                            num_cartela_vencedora = int(w.get('cartela', 0))
                            id_cli_pagto = buscar_id_cliente_por_cartela(sales_db, id_evento, num_cartela_vencedora)
        
                            if id_cli_pagto:
                                desc_pagto = f"🏆 Prêmio {chave} - Evento {id_evento}"
            
                                # 2. CHAMADA DA FUNÇÃO CENTRALIZADA
                                # Note que passamos os parâmetros que a função centralizada espera
                                sucesso = registrar_transacao_cliente(
                                    db_vendas=sales_db, 
                                    id_cliente=id_cli_pagto, 
                                    valor=float(val_rateio_float),  # Valor positivo para crédito
                                    tipo='premio', 
                                    descricao=desc_pagto, 
                                    id_evento=id_evento,
                                    id_venda=f"PREMIO-{id_evento}-{num_cartela_vencedora}", # Referência única
                                    origem="SISTEMA_SORTEIO",
                                    registrado_por="ADMIN"
                                )

                                if sucesso:
                                    print(f"✅ [PAGAMENTO CENTRALIZADO] R$ {val_rateio_float:.2f} creditado ao cliente {id_cli_pagto} (Cartela {num_cartela_vencedora})")
                                else:
                                    print(f"❌ [PAGAMENTO CENTRALIZADO] Falha ao processar crédito para cliente {id_cli_pagto}")
        
                            else:
                                # Se cair aqui, a cartela foi sorteada mas não existe registro de venda dela
                                print(f"⚠️ [PAGAMENTO RATEIO] Cartela {num_cartela_vencedora} sem dono identificado nas vendas.")

                        except Exception as err_pagto:
                            print(f"❌ [PAGAMENTO RATEIO] Erro crítico ao pagar cartela {w.get('cartela')}: {err_pagto}")     
           
        # ======================================================================
        # 🔥 PROCESSAMENTO DOS GANHADORES SORTE EXTRA (COM RATEIO CEIL)
        # ======================================================================
        if ganhadores_extra and sales_db is not None:
            print(f"🍀 [DEBUG] Processando {len(ganhadores_extra)} ganhadores do Sorte Extra...")
            
            # 1. Primeiro passamos um "pente fino" para contar quantos ganharam cada prêmio
            contagem_por_premio = {}
            for g in ganhadores_extra:
                nome_p = g.get('premio')
                contagem_por_premio[nome_p] = contagem_por_premio.get(nome_p, 0) + 1

            # 2. Agora processamos a lista real aplicando a matemática de arredondamento
            for g_extra in ganhadores_extra:
                nome_premio = g_extra.get('premio')
                
                # Pegamos o valor total bruto enviado pelo front/admin
                # (Ex: "R$ 50,00" vira 50.0)
                valor_total_bruto = parse_brl(g_extra.get('valor_total_premio'))
                qtd_vencedores = contagem_por_premio.get(nome_premio, 1)

                # CÁLCULO CEIL: Divide, arredonda para cima e remove centavos
                rateio_float = float(math.ceil(valor_total_bruto / qtd_vencedores))
                str_rateio_formatado = f"R$ {format_brl(rateio_float)}"

                obj_extra = {
                    "premio": nome_premio,
                    "valor_total_premio": g_extra.get('valor_total_premio'),
                    "cartela": str(g_extra.get('cartela')),
                    "nome": g_extra.get('nome'),
                    "valor_rateio": str_rateio_formatado, # Valor agora arredondado para cima
                    "tipo_premiacao": "Sorte Extra",
                    "dezenas_cupom": g_extra.get('dezenas_cupom', [])
                }
                
                lista_resultados_ganhadores.append(obj_extra)

                # 3. PAGAMENTO DO SORTE EXTRA (Seguindo a nova regra de pagar no reset)
                if finalizar_com_sucesso and rateio_float > 0:
                    try:
                        # No Sorte Extra, o nick já costuma ser o identificador. 
                        # Buscamos o cliente pelo nick para garantir o ID correto.
                        cli_extra = sales_db.clientes.find_one({"nick": g_extra.get('nome')})
                        if cli_extra:
                            id_cli_extra = cli_extra.get('id_cliente')
                            desc_extra = f"Sorte Extra: {nome_premio} - Evento {id_evento}"
                            
                            # Usando sua nova função centralizada e atômica
                            registrar_transacao_cliente(
                                db_vendas=sales_db,
                                id_cliente=id_cli_extra,
                                valor=rateio_float,
                                tipo='premio_sorte_extra',
                                descricao=desc_extra,
                                id_evento=id_evento,
                                origem="MESA_ADMIN",
                                registrado_por="SISTEMA_SORTE_EXTRA"
                            )
                            print(f"✅ [PAGTO EXTRA] R$ {rateio_float:.2f} para {g_extra.get('nome')}")
                    except Exception as e_p_extra:
                        print(f"❌ [PAGTO EXTRA] Erro ao pagar: {e_p_extra}")

        else:
            print("ℹ️ [DEBUG] Sem ganhadores extra ou sem DB de vendas.")

        # --- 2. GRAVAÇÃO E LIMPEZA ---
        db.osganhadores.delete_many({})
        if lista_osganhadores:
            db.osganhadores.insert_many(lista_osganhadores)

        # ======================================================================
        # 🚨 PONTO CRÍTICO: TENTATIVA DE SALVAR NO HISTÓRICO
        # ======================================================================
        #print(f"💾 [DEBUG] Verificando condições de salvamento no Histórico:")
        #print(f"   -> Total Bolas: {total_bolas}")
        #print(f"   -> Total Ganhadores (Unificado): {len(lista_resultados_ganhadores)}")
        #print(f"   -> Ganhadores Extra: {len(ganhadores_extra)}")
        
        condition_met = (total_bolas > 0 and len(lista_resultados_ganhadores) > 0) or len(ganhadores_extra) > 0
        print(f"   -> Condição aceita? {'SIM' if condition_met else 'NÃO'}")

        if condition_met:
            try:
                # CORREÇÃO 3: Uso de 'is not None'
                if sales_db is not None:
                    doc_resultado = {
                        "id_evento": id_evento,
                        "descricao" : descricao, 
                        "data_evento": data_hoje,
                        "hora_inicial": hora_inicial,
                        "hora_final": hora_atual,
                        "total_de_bolas": total_bolas,
                        "bolas_sorteadas": str(bolas_lista), 
                        "ganhadores": lista_resultados_ganhadores, 
                        "status": "finalizado" if finalizar_com_sucesso else "cancelado"
                    }
                    print("📝 [DEBUG] Inserindo documento na coleção 'resultados'...")
                    result = sales_db.resultados.insert_one(doc_resultado)
                    print(f"✅ [DEBUG] Histórico salvo! ID do documento: {result.inserted_id}")
                else:
                    print("❌ [DEBUG] IMPOSSÍVEL SALVAR: sales_db é None (Conexão perdida).")
            except Exception as e_sales:
                print(f"❌ [DEBUG] ERRO EXCEPTION AO SALVAR NO MONGODB: {e_sales}")
                import traceback
                traceback.print_exc()
        else:
             print("⚠️ [DEBUG] Histórico IGNORADO (Não cumpriu requisitos mínimos: ter bolas E ganhadores, OU ter extra).")

        # --- RESTANTE DA LIMPEZA ---
        print("🧹 [DEBUG] Iniciando limpeza local...")
        timeStart = None 
        db.bolas.update_one({}, {'$set': {'bolas_cantadas': [], 'proxima_bola': "--", 'ultimas_bolas': [], 'ordem':0}}, upsert=True)
        db.bolas_mesa.update_one({}, {'$set': {'bolas_cantadas': [], 'proxima_bola': "--", 'ultimas_bolas': []}}, upsert=True)
        db.ganhadores.delete_many({})
        db.melhores.delete_many({})
        db.confere.delete_many({})
        db.confere.insert_one({"rodada": int(id_evento), "cartao": 0, "numeros": "null", "ganhador": "null"})

        print(f"🔄 [DEBUG] Resetando status da rodada {id_evento}...")
        db.rodada.update_one({}, {
            '$set': {
                'id_evento': str(id_evento),
                'estado': 'resetando',
                'ordem': 0,
                'data_sorteio': hora_brasil()  
            }
        }, upsert=True)

        print("⏳ Aguardando limpeza nos terminais (2s)...") 
        time.sleep(2.0)

        # --- PRÓXIMO EVENTO ---
        proximo_id_str = "0"
        if finalizar_com_sucesso:
            prox_evento = buscar_proximo_evento_automatico(id_evento)
            if prox_evento:
                proximo_id_str = str(prox_evento.get('id_evento'))
                desc_prox = prox_evento.get('descricao', 'Próximo Evento')
                db.parametros.update_one({}, {'$set': {'nome_sala': desc_prox}}, upsert=True)
                print(f"⏩ [DEBUG] Próximo evento definido: {proximo_id_str}")
            else:
                proximo_id_str = str(id_evento) 
        else:
            proximo_id_str = str(id_evento)

        db.rodada.update_one({}, {
            '$set': {
                'id_evento': proximo_id_str,
                'estado': 'intervalo',
                'ordem': 0,
                'data_sorteio': hora_brasil()
            }
        }, upsert=True)

        print("🏁 [DEBUG] Reset concluído com sucesso.")
        return jsonify({
            'status': 'Reset concluído', 
            'proximo_evento': proximo_id_str,
            'modo': 'sucesso' if finalizar_com_sucesso else 'cancelamento'
        })
        
    except Exception as e:
        print(f"❌ [DEBUG] ERRO FATAL NA ROTINA RESETAR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# --- ROTA DE DETALHES (COM SINCRONIZAÇÃO AUTOMÁTICA DE CARTELAS)  ---
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
             
             db.rodada.update_one({}, {'$set': {'id_evento': id_evt,'estado': 'em andamento'}}, upsert=True)

             # aa db.premio.delete_many({})
             
             serie_max = evento.get('numero_maximo', 72000) 

             # === AJUSTE DE LÓGICA DE PERÍODOS (INICIAL vs FINAL) ===
             inicial_evento = evento.get('numero_inicial', 1)
             final_evento = 0
        
             # Busca o ponteiro de vendas na tabela controle_venda
             controle = sales_db.controle_venda.find_one({
                'id_evento': {'$in': [int(id_evt), str(id_evt)]}
             })

             if controle and controle.get('inicial_proxima_venda'):
                 try:
                     # O "Final" é sempre o próximo que seria vendido menos 1
                     final_evento = int(controle['inicial_proxima_venda']) - 1
                 except (TypeError, ValueError):
                     final_evento = ultimo_cartao
             else:
                 # Se não houver registro no controle_venda para este ID, 
                 # usamos o 'ultimo_cartao' calculado pelo aggregate das vendas
                 final_evento = ultimo_cartao
             
             dados_premio = {
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
                 'total_cartelas_em_jogo': qtde_vendida
             }

             # --- LOGS DE DEBUG (PARA CAÇAR O ERRO DE COMPARAÇÃO) ---
             print(f"DEBUG: id_evt type={type(id_evt)} value={id_evt}")
             print(f"DEBUG: inicial_evento type={type(inicial_evento)} value={inicial_evento}")
             print(f"DEBUG: final_evento type={type(final_evento)} value={final_evento}")
             print(f"DEBUG: serie_max type={type(serie_max)} value={serie_max}")

             # 👉 LÓGICA DOS PERÍODOS (Blindada contra Tipos Diferentes)
             try:
                 # Forçamos a conversão para int para garantir que a comparação < funcione
                 v_final = int(final_evento) if final_evento is not None else 0
                 v_inicial = int(inicial_evento) if inicial_evento is not None else 1
                
                 if v_final < v_inicial:
                     # 2 PERÍODOS: O sorteio "deu a volta" no número máximo
                     print(f"🔄 [EVENTO {id_evt}] 2 períodos detectados: {v_inicial}-{serie_max} e 1-{v_final}")
                     dados_premio['inicial1'] = v_inicial
                     dados_premio['final1'] = int(serie_max)
                     dados_premio['inicial2'] = 1
                     dados_premio['final2'] = v_final
                 else:
                     # 1 PERÍODO: Sorteio linear simples
                     print(f"✅ [EVENTO {id_evt}] 1 período detectado: {v_inicial}-{v_final}")
                     dados_premio['inicial1'] = v_inicial
                     dados_premio['final1'] = v_final
                     dados_premio['inicial2'] = 0
                     dados_premio['final2'] = 0
                    
             except Exception as e_comp:
                 print(f"❌ ERRO CRÍTICO NA COMPARAÇÃO: {e_comp}")
                 # Fallback de segurança para não travar o servidor
                 dados_premio['inicial1'] = 1
                 dados_premio['final1'] = int(serie_max)
                 dados_premio['inicial2'] = 0
                 dados_premio['final2'] = 0

             # Atualiza o banco com o dicionário montado

             db.premio.update_one({}, {'$set': dados_premio}, upsert=True)
             threading.Thread(target=carregar_cache_evento, args=(id_evt, sales_db)).start()

        return jsonify(response_data)

    except Exception as e:
        print(f"Erro Detalhes: {e}")
        return jsonify({'error': str(e)}), 500


# --- Adicione isto no seu server.py ---

@app.route('/api/dados_evento', methods=['GET'])
def get_dados_evento():
    try:
        # Pega o ID que o Javascript mandou (ex: ?id_evento=9)
        id_evento_str = request.args.get('id_evento')
        
        if not id_evento_str:
            return jsonify({'erro': 'ID do evento não informado'}), 400

        id_evento = int(id_evento_str)  
        
        # Conecta no banco (ajuste conforme sua estrutura de conexão)
        # Se você usa 'sales_db' ou 'mongo.db', ajuste aqui:
        sales_db = get_sales_db_connection() 
        
        # Busca o evento na coleção 'eventos' (ou 'rodadas')
        # Tenta buscar pelo campo 'id_evento' ou '_id' ou 'numero_rodada'
        evento = sales_db.eventos.find_one({'id_evento': id_evento})
        
        # Se não achar por 'id_evento', tenta 'rodada_atual' (depende do seu banco)
        if not evento:
             evento = sales_db.config.find_one({'rodada_atual': id_evento})

        controle = sales_db.controle_venda.find_one({'id_evento': id_evento})
        
        if controle:
            proximo_numero = controle.get('inicial_proxima_venda', 1)
        else:
            # Caso não exista o registro específico, tenta um global ou padrão 1
            proximo_numero = 1

        if evento:
            # 1. Pega o valor bruto do banco
            val_bruto = evento.get('valor_de_venda', 1.00)

            # 2. CONVERSÃO DE SEGURANÇA (Decimal128 -> Float)
            try:
                # Verifica se é um objeto Decimal128 do MongoDB
                if hasattr(val_bruto, 'to_decimal'):
                    preco_final = float(val_bruto.to_decimal())
                else:
                    # Se já for número ou string, apenas garante float
                    preco_final = float(val_bruto)
            except:
                preco_final = 1.00 # Valor de segurança em caso de erro

            return jsonify({
                'status': 'ok',
                'id_evento': evento.get('id_evento'), 
                'preco_cartela': preco_final, 
                'numeracao_atual_venda': proximo_numero, # Valor vindo da controle_venda
                'descricao': evento.get('descricao', f'Evento {id_evento}'),
                'data_evento': evento.get('data_evento', ''),
                'hora_evento': evento.get('hora_evento', '')
            })
        else:
            # Se não achar evento, retorna um padrão para não travar
            return jsonify({
                'status': 'ok', 
                'id_evento': id_evento, 
                'preco_cartela': 2.00, # PREÇO PADRÃO DE EMERGÊNCIA
                'numeracao_atual_venda': proximo_numero,
                'obs': 'Evento não encontrado no banco, usando padrão'
            })

    except Exception as e:
        print(f"Erro ao buscar evento: {e}")
        return jsonify({'erro': str(e)}), 500

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
    global db, CACHE_MAX_BOLAS, valorPremioQuadra
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

        # 3. Sua variável específica (Com tratamento para Decimal128)
        raw_val = evento.get('premio_quadra', 0)
        
        try:
            # Se for o tipo especial do Mongo (Decimal128)
            if hasattr(raw_val, 'to_decimal'):
                valorPremioQuadra = float(raw_val.to_decimal())
            else:
                # Se já for número ou string texto ("10.0")
                valorPremioQuadra = float(raw_val)
        except:
            print(f"⚠️ Erro ao converter premio_quadra: {raw_val}")
            valorPremioQuadra = 0.0

        if tipo_cartela == 25:
            CACHE_MAX_BOLAS = 75
        else:
            CACHE_MAX_BOLAS = 90   
        print(f"📂 Evento pede: Arquivo {num_max} | Tipo {tipo_cartela}")

        # 3. Executa a Troca de Arquivo (Sincronização)
        # Chamamos a função que já existe no seu código, mas de forma síncrona (sem Thread)
        # para garantir que o frontend espere terminar.
        verificar_e_sincronizar_cartelas(num_max, tipo_cartela)
        
        # 4. Já atualiza os parâmetros globais para os terminais detectarem a mudança
        if db is not None:
             db.parametros.update_one({}, {'$set': {
                'tipo_sorteio': int(tipo_cartela),
                'tipo_cartela': int(tipo_cartela),
                'arquivo_de_cartela': int(num_max),
                # Atualiza também o nome da sala se possível, para já mudar no header do cliente
                'nome_sala': evento.get('descricao', 'Sorteio')
            }}, upsert=True)

        return jsonify({'status': 'ok', 'msg': 'Base de cartelas sincronizada com sucesso.'})

    except Exception as e:
        print(f"❌ Erro ao preparar evento: {e}")
        return jsonify({'error': str(e)}), 500



# ==============================================================================
# 🛡️ MOTOR FINANCEIRO CENTRALIZADO E ATÓMICO (SERVER.PY)
# ==============================================================================
def registrar_transacao_cliente(db_vendas, id_cliente, valor, tipo, descricao, id_evento=None, id_venda=None, origem="WEB_CLIENTE", registrado_por="SISTEMA"):
    """
    Centraliza TODA movimentação financeira do cliente no terminal.
    Usa Operação Atômica ($inc) para evitar corrupção de saldo em acessos simultâneos.
    """
    from pymongo import ReturnDocument
    try:
        valor_float = float(valor)
        if valor_float == 0:
            return True, "Transação de valor zero ignorada."

        # 1. Classificação
        natureza = "ENTRADA" if valor_float > 0 else "SAIDA"
        valor_decimal = Decimal128(str(valor_float))

        # 2. OPERAÇÃO ATÔMICA (Soma e retorna o saldo já atualizado)
        # Tenta buscar como INT primeiro (Padrão novo)
        cliente_atualizado = db_vendas.clientes.find_one_and_update(
            {'id_cliente': int(id_cliente) if str(id_cliente).isdigit() else id_cliente},
            {
                '$inc': {'saldo_atual': valor_decimal},
                '$set': {'ultima_movimentacao': hora_brasil()}
            },
            return_document=ReturnDocument.AFTER
        )

        # Fallback de segurança caso o ID no banco esteja como String
        if not cliente_atualizado:
            cliente_atualizado = db_vendas.clientes.find_one_and_update(
                {'id_cliente': str(id_cliente)},
                {
                    '$inc': {'saldo_atual': valor_decimal},
                    '$set': {'ultima_movimentacao': hora_brasil()}
                },
                return_document=ReturnDocument.AFTER
            )
            
        if not cliente_atualizado:
            print(f"⚠️ [FINANCEIRO] Cliente {id_cliente} não encontrado para a transação: {descricao}")
            return False, "Cliente não encontrado."

        # 3. Matemática Reversa (Descobrir o saldo anterior)
        saldo_posterior_float = converter_decimal(cliente_atualizado.get('saldo_atual', 0.0))
        saldo_anterior_float = saldo_posterior_float - valor_float

        # 4. Gravação no Livro-Razão (Extrato)
        doc_transacao = {
            'id_transacao': f"TRX{int(time.time()*1000)}",
            'id_cliente': cliente_atualizado['id_cliente'],
            'data_hora': hora_brasil(),
            'natureza': natureza,
            'tipo': tipo,
            'valor': valor_decimal,
            'saldo_anterior': Decimal128(str(saldo_anterior_float)),
            'saldo_posterior': Decimal128(str(saldo_posterior_float)),
            'descricao': descricao,
            'id_evento': id_evento,
            'id_venda': id_venda,
            'origem': origem,
            'registrado_por': registrado_por
        }
        
        db_vendas.transacoes_clientes.insert_one(doc_transacao)
        return True, "Sucesso"

    except Exception as e:
        print(f"❌ [ERRO CRÍTICO FINANCEIRO] Falha ao registrar transação do cliente {id_cliente}: {e}")
        import traceback
        traceback.print_exc()
        return False, str(e)


def buscar_id_cliente_por_cartela(sales_db, id_evento, cartela_id):
    """Descobre quem é o dono da cartela na tabela de vendas."""
    try:
        col_vendas = sales_db[f"vendas{id_evento}"]
        # Busca em qualquer uma das faixas
        venda = col_vendas.find_one({
            '$or': [
                {'numero_inicial': {'$lte': cartela_id}, 'numero_final': {'$gte': cartela_id}},
                {'numero_inicial2': {'$lte': cartela_id}, 'numero_final2': {'$gte': cartela_id}}
            ]
        }, {'id_cliente': 1})
        
        return venda.get('id_cliente') if venda else None
    except:
        return None


@app.route('/api/login_cliente', methods=['POST'])
def api_login_cliente():
    # print("📍 [DEBUG] 999. Requisição recebida na rota de login.")
    try:
        # CORREÇÃO 1: Use get_json() é mais seguro que .json direto
        data = request.get_json()
        
        # Proteção caso data seja None
        if not data:
            return jsonify({'erro': 'Corpo da requisição inválido (JSON esperado).'}), 400

        usuario = data.get('usuario', '').strip()
        senha = data.get('senha', '').strip()
        
        # print(f"📍 [DEBUG] 02. Dados extraídos. Usuario: {usuario}")

        if not usuario or not senha:
            return jsonify({'erro': 'Preencha usuário e senha.'}), 400

        # --- PONTO DE TRAVAMENTO 1: CONEXÃO ---
        # print("📍 [DEBUG] 03. Chamando get_sales_db_connection()...")
        sales_db = get_sales_db_connection()
        
        if sales_db is None:
            # print("❌ [DEBUG] Falha: sales_db retornou None.")
            return jsonify({'erro': 'Erro interno: Banco de clientes inacessível.'}), 500
        # print("📍 [DEBUG] 04. Conexão obtida com sucesso.")

        # --- PONTO DE TRAVAMENTO 2: CONSULTA MONGO ---
        # print("📍 [DEBUG] 05. Executando find_one no Mongo...")
        cli = sales_db.clientes.find_one({'nick': {'$regex': f'^{usuario}$', '$options': 'i'}})
        # print(f"📍 [DEBUG] 06. Consulta finalizada. Cliente encontrado? {cli is not None}")

        if not cli:
            return jsonify({'erro': 'Usuário não encontrado.'}), 401

        # --- PONTO DE TRAVAMENTO 3: BCRYPT (PROCESSAMENTO PESADO) ---
        if 'senha' in cli:

            # ATENÇÃO: Capitalize aqui pode impedir login se a senha real for "batata" e virar "Batata"
            # O ideal seria testar a senha original primeiro, e depois o capitalize como fallback.
            senha_fmt = senha.capitalize()

            senha_banco = cli['senha']
            
            # print("📍 [DEBUG] 07. Iniciando verificação de senha (bcrypt)...")
            
            # ATENÇÃO: Se travar aqui, é incompatibilidade do Gevent com C-Extensions
            try:
                # Testa com capitalize (como estava no seu código original)
                senha_valida = bcrypt.checkpw(senha_fmt.encode('utf-8'), cli['senha'].encode('utf-8'))
            except:
                senha_valida = False

            # print(f"📍 [DEBUG] 08. Bcrypt finalizado. Senha válida? {senha_valida}")

            if senha_valida:
                # --- SUCESSO NO LOGIN ---
                session['id_cliente'] = str(cli['id_cliente'])
                session['nick_cliente'] = cli['nick']
                
                saldo = converter_decimal(cli.get('saldo_atual', 0.0))
                
                # --- VERIFICAÇÃO DE TROCA DE SENHA OBRIGATÓRIA ---
                # CUIDADO: No seu código estava "@senha@". Voltei para "senha".
                # Se a sua senha padrão for realmente "@senha@", altere abaixo.
                if senha.lower() == "senha": 
                    session['id_cliente'] = str(cli['id_cliente']) 
                    session['nick_cliente'] = cli['nick']
                    session['troca_senha_pendente'] = True

                    return jsonify({
                        "status": "troca_senha_obrigatoria",
                        "mensagem": "Por segurança, você deve atualizar sua senha.",
                        "redirect_url": url_for('cliente_troca_senha_obrigatoria')
                     })
                    
                # Busca Evento Ativo
                id_evento_ativo = None
                try:
                    evt_ativo = sales_db.eventos.find_one({'status': 'ativo'})
                    if evt_ativo:
                        id_evento_ativo = str(evt_ativo.get('id_evento') or evt_ativo.get('numero') or evt_ativo.get('seq') or evt_ativo['_id'])
                except Exception as e_evt:
                    print(f"⚠️ Aviso no evento: {e_evt}")
                
                # 👉 NOVO: Busca o parâmetro receber_pix da tabela parametros
                parametros = sales_db.parametros.find_one({}) or {}

                admin_quer_pix = parametros.get('receber_pix', False)

                # 👉 NOVO 1: Puxa o texto de saque personalizado (se não existir, usa o padrão)
                texto_padrao_saque = "ℹ️ O valor solicitado ficará pendente de aprovação. Seu saldo continuará disponível para jogo até o pagamento ser processado pelo operador."
                texto_saque = parametros.get('texto_requisicao_saque', texto_padrao_saque)

                # 👉 NOVO 2: Verifica se o cliente tem saques pendentes
                tem_saque_pendente = False
                try:
                    # Procure na sua tabela de saques. Adapte 'saques' para o nome real da sua tabela!
                    busca_saque = sales_db.saques.find_one({
                        'id_cliente': int(cli['id_cliente']), 
                        'status': 'pendente' 
                    })
                    if busca_saque:
                        tem_saque_pendente = True
                except Exception as e_saque:
                    print(f"⚠️ Aviso ao buscar saques: {e_saque}")


                # 2. Olha para o sistema (A capacidade técnica do servidor)
                # (Lembrando que lá no topo do ficheiro deixámos mp_sdk = None se não houver .env)
                servidor_tem_token = (mp_sdk is not None)

                # 3. A SUA VARIÁVEL GLOBAL UNIFICADA:
                # Só mostra o PIX se o Admin quiser E o servidor tiver a chave!
                receberemos_pix = (admin_quer_pix == True) and servidor_tem_token

                return jsonify({
                    'status': 'ok', 
                    'msg': 'Logado com sucesso!',
                    'nick': cli['nick'],
                    'saldo': saldo,
                    'id': str(cli['id_cliente']),
                    'id_evento_ativo': id_evento_ativo,
                    'receber_pix': receberemos_pix,
                    'texto_saque': texto_saque,              # 👉 Envia para o Front
                    'tem_saque_pendente': tem_saque_pendente # 👉 Envia para o Front
                })
            else:
                print("⛔ [DEBUG] Senha incorreta.")
                return jsonify({'erro': 'Senha incorreta.'}), 401
        else:
            return jsonify({'erro': 'Usuário sem senha cadastrada.'}), 401

    except Exception as e:
        print(f"❌ [DEBUG] ERRO CRÍTICO (EXCEPTION): {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'erro': f'Erro no servidor: {str(e)}'}), 500


@app.route('/api/dados_cliente', methods=['GET'])
def api_dados_cliente():
    """Retorna saldo e extrato (Últimas 20 movimentações)."""        

    if 'id_cliente' not in session:
        return jsonify({'erro': 'Não logado'}), 401

    # 1. Conecta ao Banco de Vendas
    sales_db = get_sales_db_connection()

    if sales_db is None:
        return jsonify({'erro': 'Banco de Vendas desconectado.'}), 500

    try:
        id_sessao = session['id_cliente']
        
        # --- 2. BUSCA CLIENTE (COM BLINDAGEM DE TIPO INT/STR) ---
        # Tenta buscar direto
        cli = sales_db.clientes.find_one({'id_cliente': id_sessao})
        
        # Se falhou, tenta inverter o tipo (String <-> Int) para garantir
        if not cli:
            try:
                if isinstance(id_sessao, str):
                    cli = sales_db.clientes.find_one({'id_cliente': int(id_sessao)})
                else:
                    cli = sales_db.clientes.find_one({'id_cliente': str(id_sessao)})
            except: pass
            
        if not cli: 
            session.clear()
            return jsonify({'erro': 'Cliente não encontrado na base de vendas.'}), 404
        
        # Garante que usamos o ID no formato correto que está no banco para buscar as transações
        id_cli_correto = cli.get('id_cliente')
        
        # Converte o saldo corretamente
        saldo = converter_decimal(cli.get('saldo_atual', 0.0))
        
        # --- 3. BUSCA HISTÓRICO (AGORA COM LIMIT 20) ---
        extrato = []
        if 'transacoes_clientes' in sales_db.list_collection_names():
           
            cursor = sales_db.transacoes_clientes.find({'id_cliente': id_cli_correto})\
                                                 .sort('data_hora', -1)\
                                                 .limit(20)
                                                 
            for t in cursor:
                val_t = converter_decimal(t.get('valor', 0))
                # 👉 NOVO: Extrai e converte o saldo posterior de forma segura
                saldo_post = converter_decimal(t.get('saldo_posterior', 0))
                
                # Tratamento seguro de data
                data_raw = t.get('data_hora')
                if data_raw:
                    # Se for objeto datetime do python
                    if hasattr(data_raw, 'strftime'):
                        data_fmt = data_raw.strftime("%d/%m %H:%M")
                    # Se for string (ex: ISO format)
                    else:
                        data_str = str(data_raw)
                        # Slice simples: Pega chars 8 a 10 (dia), 5 a 7 (mes), 11 a 16 (hora)
                        if len(data_str) >= 16:
                             data_fmt = f"{data_str[8:10]}/{data_str[5:7]} {data_str[11:16]}"
                        else:
                             data_fmt = data_str
                else:
                    data_fmt = "--/--"
                
                extrato.append({
                    'data': data_fmt,
                    'tipo': t.get('tipo', '?'),
                    'natureza':t.get('natureza','SAIDA'),
                    'desc': t.get('descricao', ''),
                    'valor': val_t,
                    'saldo_posterior': saldo_post
                })
            
        return jsonify({
            'saldo': saldo,
            'extrato': extrato,
            'nick': cli.get('nick')
        })

    except Exception as e:
        print(f"Erro dados cliente: {e}")
        return jsonify({'erro': str(e)}), 500


@app.route('/api/comprar_cartelas', methods=['POST'])
def api_comprar_cartelas():
    """Processa a compra de forma ATÓMICA e com Rollover perfeito."""
    if 'id_cliente' not in session:
        return jsonify({'erro': 'Sessão expirada. Faça login novamente.'}), 401
        
    data = request.json
    qtd_desejada = int(data.get('quantidade', 0))
    id_solicitado = data.get('id_evento') 
    
    if qtd_desejada <= 0: return jsonify({'erro': 'Quantidade inválida.'}), 400
    
    sales_db = get_sales_db_connection()
    if sales_db is None: return jsonify({'erro': 'Banco de Vendas offline.'}), 500

    try:
        id_cli = int(session['id_cliente'])
        
        # --- DEFINIÇÃO DO ID DO EVENTO ---
        if id_solicitado:
            print(f"🛒 Solicitado Evento ID: {id_solicitado}")
            try: raw_id = int(id_solicitado)
            except: raw_id = str(id_solicitado)
        else:
            print("⚠️ Nenhum ID recebido. Usando evento da rodada atual.")
            rodada_info = db.rodada.find_one({})
            raw_id = rodada_info.get('id_evento') if rodada_info else None

        busca_ids = [raw_id, str(raw_id)]
        if isinstance(raw_id, str) and raw_id.isdigit():
            busca_ids.append(int(raw_id))
            
        evento = sales_db.eventos.find_one({'id_evento': {'$in': busca_ids}})
        
        if not evento:
            return jsonify({'erro': f'Evento {raw_id} não encontrado.'}), 400
            
        # ==================================================================
        # 🚫 VALIDAÇÃO DE STATUS
        # ==================================================================
        status_atual = str(evento.get('status', '')).lower().strip()
        
        if status_atual != 'ativo':
            print(f"⛔ Tentativa de compra bloqueada. Status: {status_atual}")
            return jsonify({
                'erro': 'Vendas encerradas!', 
                'detalhe': f'O evento está {status_atual}. Aguarde o próximo.'
            }), 400

        id_evento_oficial = evento.get('id_evento')
        limite_maximo_cartelas = int(evento.get('numero_maximo', 72000))
        numero_inicial_evento = int(evento.get('numero_inicial', 1))
        
        cliente = sales_db.clientes.find_one({'id_cliente': id_cli})
        if not cliente: return jsonify({'erro': 'Cliente não encontrado.'}), 400

        nome_do_cliente_db = cliente.get('nick', 'Cliente')
        id_colaborador_indicacao = cliente.get('id_colaborador', 0)
  
        # Verifica Saldo
        valor_unit = converter_decimal(evento.get('valor_de_venda', 0))
        custo_total = valor_unit * qtd_desejada
        
        saldo_cliente = converter_decimal(cliente.get('saldo_atual', 0))
        if saldo_cliente < custo_total:
             return jsonify({'erro': 'Saldo insuficiente para esta compra.'}), 400

        # ==============================================================================
        # 🚀 MOTOR DE VENDAS ATÓMICO (SEM LOCKS EM PYTHON, PARTILHADO COM APP.PY)
        # O MongoDB garante a exclusividade das sequências via find_one_and_update
        # ==============================================================================
        
        # (Dentro da api_comprar_cartelas no server.py)
        numero_inicial_atual = get_next_bilhete_sequence(
            db=sales_db, 
            id_evento=id_evento_oficial, 
            increment_field='inicial_proxima_venda', # <-- Veja se diz 'increment_field'
            qtd=qtd_desejada,
            limite_maximo=limite_maximo_cartelas # <-- Veja se diz 'limite_maximo'
        )
                                                   
        if numero_inicial_atual is None:
            return jsonify({'erro': 'Falha interna ao gerar número do bilhete.'}), 500

        # Lógica de Rollover / Reinício (Igual ao app.py)
        if numero_inicial_atual == 1: 
            numero_inicial_atual = numero_inicial_evento
            sales_db.controle_venda.update_one(
                {'id_evento': id_evento_oficial},
                {'$set': {'inicial_proxima_venda': numero_inicial_atual + qtd_desejada}}
            )

        numero_final_atual = numero_inicial_atual + qtd_desejada - 1
        
        numero_inicial2_atual = 0 
        numero_final2_atual = 0 
        
        # Tratamento perfeito de se a compra "atravessar" o limite máximo
        if numero_final_atual > limite_maximo_cartelas:
            numero_inicial2_atual = 1
            numero_final2_atual = numero_final_atual - limite_maximo_cartelas
            numero_final_atual = limite_maximo_cartelas

        # --- CONTADOR GLOBAL DE VENDAS (Seguro) ---
        retorno_global = sales_db.contadores.find_one_and_update(
            {'_id': 'global'}, 
            {'$inc': {'id_vendas_global': 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        id_venda_global = retorno_global.get('id_vendas_global')
        
        # Grava na Tabela de Vendas
        venda_doc = {
            "id_venda": f"WEB{id_venda_global}", 
            "id_evento": id_evento_oficial,
            "id_cliente": id_cli,
            "nome_cliente": nome_do_cliente_db,                          
            "nick_colaborador": "AUTO-ATENDIMENTO",
            "id_colaborador": id_colaborador_indicacao,
            "data_venda": hora_brasil(),  
            "quantidade_unidades": qtd_desejada,
            "quantidade_cartelas": qtd_desejada, 
            "numero_inicial": numero_inicial_atual,
            "numero_final": numero_final_atual,
            "numero_inicial2": numero_inicial2_atual,
            "numero_final2": numero_final2_atual,
            "valor_total": Decimal128(str(custo_total)),
            "origem": "terminal_cliente"
        }
        
        col_vendas_nome = f"vendas{id_evento_oficial}"
        sales_db[col_vendas_nome].insert_one(venda_doc)
        print(f"💾 Venda WEB gravada: {col_vendas_nome} | Cartelas: {numero_inicial_atual}-{numero_final_atual}")

        # ==================================================================
        # --- ATUALIZAÇÃO DO BUFFER PARA O ROBÔ DE PRÊMIOS ---
        tipo_premiacao = str(evento.get('tipo_premiacao', '')).lower().strip()
        if tipo_premiacao == 'porcentagem':
            sales_db.eventos.update_one(
                {"id_evento": id_evento_oficial},
                {"$inc": {"valor_pendente_telemovel": float(custo_total)}} # Corrigido para float p/ o Mongo aceitar no $inc sem erro Decimal
            )
            print(f"📈 Buffer de prêmios atualizado em +R$ {float(custo_total):.2f}")
        # ==================================================================

        # Debita e finaliza com o nosso motor financeiro seguro
        registrar_transacao_cliente(
            db_vendas=sales_db, 
            id_cliente=id_cli, 
            valor=-abs(custo_total), 
            tipo='compra_cartela', 
            descricao=f"Compra Web - {qtd_desejada} kit(s) - {evento.get('descricao')}", 
            id_evento=id_evento_oficial,
            id_venda=f"WEB{id_venda_global}",
            origem="WEB_CLIENTE",
            registrado_por="AUTO-ATENDIMENTO"
        )
        
        saldo_atual_novo = saldo_cliente - custo_total
        
        cartelas_txt = f"{numero_inicial_atual} a {numero_final_atual}"
        if numero_inicial2_atual > 0:
            cartelas_txt += f" e {numero_inicial2_atual} a {numero_final2_atual}"

        return jsonify({
            'status': 'ok',
            'msg': 'Compra realizada!',
            'novo_saldo': saldo_atual_novo,
            'cartelas': cartelas_txt,
            'inicial': numero_inicial_atual,
            'final': numero_final_atual,
            'inicial2': numero_inicial2_atual,
            'final2': numero_final2_atual
        })

    except Exception as e:
        print(f"Erro crítico compra: {e}")
        traceback.print_exc()
        return jsonify({'erro': 'Erro interno.'}), 500


@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'status': 'ok'})

# --- FUNÇÃO AUXILIAR DE VALIDAÇÃO ---
def nick_eh_valido(nick):
    """
    Retorna (True, None) se o nick for seguro.
    Retorna (False, "Motivo") se for inválido.
    """
    nick_lower = nick.strip().lower()
    
    # 1. Validação de Tamanho
    if len(nick) < 3: return False, "Mínimo de 3 caracteres."
    if len(nick) > 15: return False, "Máximo de 15 caracteres."

    # 2. Termos Reservados (Segurança Crítica Hardcoded)
    termos_reservados = [
        "admin", "suporte", "moderador", "sistema", "bot", 
        "root", "master", "bingo", "dono", "gerente", "financeiro",
        "caixa", "atendimento", "operador"
    ]
    
    for termo in termos_reservados:
        if termo in nick_lower:
            return False, f"O termo '{termo}' é reservado à administração."

    # 3. Carrega Lista de Bloqueio do Banco (Palavrões + Bloqueios de Negócio)
    lista_proibida_db = []
    
    try:
        # CORREÇÃO AQUI: Usamos a função de conexão direta em vez de confiar no 'globals'
        # Isso garante que temos uma conexão ativa com o banco correto
        conexao_db = get_sales_db_connection()
        
        if conexao_db is not None:
            # Busca na coleção 'config_bloqueio'
            config = conexao_db.config_bloqueio.find_one({'tipo': 'nicks_proibidos'})
            
            if config:
                if 'palavras' in config:
                    lista_proibida_db = config['palavras']
                    # print(f"✅ Lista carregada do Banco: {len(lista_proibida_db)} palavras.") # Debug
                else:
                    print("⚠️ Documento encontrado, mas campo 'palavras' vazio.")
            else:
                print("⚠️ Configuração 'nicks_proibidos' não encontrada no banco.")
        else:
            print("⚠️ Sem conexão com o banco para verificar palavrões.")

    except Exception as e:
        print(f"❌ Erro ao ler lista proibida: {e}")
        # Não damos 'pass' silencioso, imprimimos o erro para você ver no terminal

    # 4. Configura a biblioteca e Valida
    # Junta os reservados (código) com os proibidos (banco)
    todas_proibidas = set(lista_proibida_db + termos_reservados)
    
    # Se a lista do banco vier vazia, garante pelo menos o básico hardcoded
    if not lista_proibida_db:
        palavroes_basicos = ["puta", "merda", "cu", "caralho"] # Fallback de emergência
        todas_proibidas.update(palavroes_basicos)

    profanity.load_censor_words(todas_proibidas)

    if profanity.contains_profanity(nick):
        return False, "Este nome contém termos não permitidos."

    return True, None


# ==============================================================================
#  ROTAS DE CADASTRO DE CLIENTE (AUTO-CADASTRO)
# ==============================================================================

@app.route('/api/checar_nick_disponivel', methods=['GET'])
def checar_nick():
    """
    Verifica se um nome de usuário (nick) é válido e se já existe.
    """
    try:
        nick = request.args.get('nick', '').strip()
        
        if not nick:
            return jsonify({'disponivel': False, 'erro': 'Digite um usuário.'}), 200

        # --- 1. PRIMEIRO FILTRO: Validação de Conteúdo ---
        # Bloqueia palavrões e nomes reservados antes de ir ao banco
        valido, motivo = nick_eh_valido(nick)
        
        if not valido:
            # Retorna indisponível e o motivo (ex: "Termo ofensivo")
            return jsonify({'disponivel': False, 'erro': motivo})
        # -------------------------------------------------

        sales_db = get_sales_db_connection()
        if sales_db is None:
            return jsonify({'erro': 'Erro de conexão DB'}), 500

        # --- 2. SEGUNDO FILTRO: Duplicidade no Banco ---
        # Busca case-insensitive (joao = Joao = JOAO)
        usuario_existente = sales_db.clientes.find_one({'nick': {'$regex': f'^{nick}$', '$options': 'i'}})
        
        if usuario_existente:
            return jsonify({'disponivel': False, 'erro': 'Este usuário já está em uso.'})
        else:
            return jsonify({'disponivel': True, 'msg': 'Usuário disponível!'})

    except Exception as e:
        print(f"❌ Erro ao verificar nick: {e}")
        return jsonify({'erro': str(e)}), 500


@app.route('/api/cadastrar_cliente', methods=['POST'])
def cadastrar_cliente():
    """
    Registra um novo cliente vindo do Auto-Cadastro usando ID Sequencial Numérico (Int32).
    """
    try:
        data = request.json
        nome = data.get('nome', '').strip().upper() 
        celular = data.get('celular', '').strip()
        pix = data.get('pix', '').strip()
        nick = data.get('usuario', '').strip().lower() 
        
        # Formatação de Senha (Capitalize)
        senha_raw = data.get('senha', '').strip()
        senha_formatada = senha_raw.capitalize() 

        cidade = data.get('cidade', '').strip().title()
 
        # --- NOVO TRECHO DE VALIDAÇÃO --- aquix
        valido, erro_msg = nick_eh_valido(nick)
        if not valido:
            return jsonify({'erro': erro_msg}), 400

        # 1. Validação Básica
        if not nome or not celular or not nick or not senha_raw or not pix or not cidade:
            return jsonify({'erro': 'Todos os campos são obrigatórios.'}), 400

        sales_db = get_sales_db_connection()
        if sales_db is None:
            return jsonify({'erro': 'Erro interno: Banco inacessível'}), 500

        # --- VERIFICAÇÃO DE MODO TREINAMENTO ---
        # A. Busca a regra de treinamento NO BANCO DE VENDAS
        # Usamos find_one porque geralmente só existe um documento de configuração
        params_vendas = sales_db.parametros.find_one({})
        
        # Se não achar o documento ou o campo, o padrão é False (Segurança em 1º lugar)
        modo_treino = params_vendas.get('em_treinamento', False) if params_vendas else False

        # B. Define o saldo inicial baseado na regra acima
        # Importante: Usamos Decimal128 para manter a precisão que o seu motor financeiro exige
        valor_inicial = Decimal128("1000.00") if modo_treino else Decimal128("0.00")

        # 2. Verificação de Duplicidade
        if sales_db.clientes.find_one({'nick': {'$regex': f'^{nick}$', '$options': 'i'}}):
            return jsonify({'erro': 'Este usuário já está sendo usado por outra pessoa.'}), 409

        if senha_raw.lower() == "senha":
            return jsonify({'erro': "Você não pode usar a senha padrão 'Senha'. Escolha outra."}), 400

        # 3. Criptografia da Senha
        senha_hash = bcrypt.hashpw(senha_formatada.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # 4. Geração de ID Sequencial (Numérico / Int32)
        contador = sales_db.contadores.find_one_and_update(
            {'_id': 'id_clientes_global'},       
            {'$inc': {'sequence_value': 1}},     
            return_document=ReturnDocument.AFTER, 
            upsert=True                          
        )
        
        # --- ALTERAÇÃO AQUI: Mantém como Inteiro ---
        novo_id_cliente = int(contador['sequence_value'])

        # 5. Montagem do Documento
        novo_cliente = {
            'id_cliente': novo_id_cliente, 
            'nome_cliente': nome,
            'telefone': celular,
            'chave_pix': pix,
            'nick': nick,
            'senha': senha_hash,
            'saldo_atual': valor_inicial,
            'data_cadastro': hora_brasil(),
            'origem': 'auto_cadastro_site',
            'cidade': cidade,
            'id_colaborador': 0,
            'em_treinamento': modo_treino
        }

        # 6. Inserção no Banco
        sales_db.clientes.insert_one(novo_cliente)

        # Se for modo treinamento, registra a transação de bônus no extrato
        if modo_treino:
            try:
                doc_transacao = {
                    'id_transacao': f"TRX_TREINO_{int(time.time())}",
                    'id_cliente': novo_id_cliente,
                    'data_hora': hora_brasil(),
                    'tipo': 'bonus_treinamento',
                    'natureza': 'ENTRADA',
                    'valor': Decimal128("1000.00"),
                    'saldo_anterior': Decimal128("0.00"),
                    'saldo_posterior': Decimal128("1000.00"),
                    'descricao': "Bônus de Boas-vindas (MODO TREINAMENTO)",
                    'origem': 'SISTEMA',
                    'registrado_por': 'SISTEMA'
                }
                sales_db.transacoes_clientes.insert_one(doc_transacao)
            except Exception as e_trans:
                print(f"⚠️ Erro ao gerar extrato de treino para {nick}: {e_trans}")

        tipo_log = "TREINAMENTO" if modo_treino else "REAL"
        print(f"✅ [{tipo_log}] Novo cliente: {nick} (ID: {novo_id_cliente})")

        return jsonify({
            'status': 'ok',
            'msg': 'Cadastro realizado com sucesso!',
            'id_cliente': novo_id_cliente, # O JSON enviará como número: "id_cliente": 30
            'nick': nick
        })

    except Exception as e:
        print(f"❌ Erro ao cadastrar cliente: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'erro': 'Erro interno ao salvar cadastro.'}), 500


# ==============================================================================
#  FUNÇÃO AUXILIAR: NOTIFICAÇÃO TELEGRAM
# ==============================================================================
def enviar_notificacao_telegram(mensagem):
    try:
        # 1. Tenta aceder à base de dados de vendas
        sales_db = get_sales_db_connection()
        
        if sales_db is None:
            print("⚠️ [TELEGRAM] Sem ligação à base de dados. Notificação ignorada.")
            return

        # 2. Procura os parâmetros da sala
        parametros = sales_db.parametros.find_one({}) or {}
        
        # 3. Extrai as chaves (se não existirem, retorna None)
        BOT_TOKEN = parametros.get('token_telegram')
        CHAT_ID = parametros.get('chat_id_telegram')

        # 4. Validação: Só prossegue se ambos estiverem preenchidos na base de dados
        if not BOT_TOKEN or not CHAT_ID:
            print("⚠️ [TELEGRAM] Token ou Chat ID não configurados na tabela 'parametros'. Pulei o envio.")
            return

        # Limpa possíveis espaços em branco acidentais no cadastro
        BOT_TOKEN = str(BOT_TOKEN).strip()
        CHAT_ID = str(CHAT_ID).strip()

        # 5. Envia a notificação
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": CHAT_ID,
            "text": mensagem,
            "parse_mode": "HTML"
        }
        
        resposta = requests.post(url, json=payload, timeout=5)
        
        if resposta.status_code != 200:
            print(f"⚠️ [TELEGRAM] Falha ao enviar. Código: {resposta.status_code} - Erro: {resposta.text}")
            
    except Exception as e:
        print(f"❌ Erro crítico ao enviar Telegram: {e}")


# ==============================================================================
#  ROTA DE SOLICITAÇÃO DE SAQUE (COM LOGS DE DEBUG)
# ==============================================================================

@app.route('/api/solicitar_saque', methods=['POST'])
def solicitar_saque():
    print("\n--- 🔍 INICIANDO DEBUG DE SAQUE ---") # Log Visual
    try:
        # 1. LOG DA SESSÃO
        print(f"DEBUG: Conteúdo da Session: {list(session.keys())}")
        
        if 'id_cliente' not in session:
             print("DEBUG: ❌ Erro - 'id_cliente' não está na sessão.")
             return jsonify({'erro': 'Usuário não logado.'}), 401

        id_sessao = session['id_cliente']
        print(f"DEBUG: ID na Sessão: {id_sessao} | Tipo: {type(id_sessao)}")

        data = request.get_json() # get_json() é mais seguro
        valor_solicitado = float(data.get('valor', 0))
        
        # Conexão com Banco
        sales_db = get_sales_db_connection()
        if sales_db is None: 
            print("DEBUG: ❌ Erro - Falha na conexão com DB Vendas")
            return jsonify({'erro': 'Banco de Vendas offline.'}), 500
        
        # 2. TENTATIVA DE BUSCA (COM CORREÇÃO DE TIPO)
        print(f"DEBUG: Buscando cliente na coleção 'clientes'...")
        
        cliente = sales_db.clientes.find_one({'id_cliente': id_sessao})
        
        if not cliente:
            print("DEBUG: ⚠️ Busca exata falhou. Tentando conversão de tipo...")
            try:
                if isinstance(id_sessao, str):
                    cliente = sales_db.clientes.find_one({'id_cliente': int(id_sessao)})
                    print(f"DEBUG: Sucesso buscando como INT: {int(id_sessao)}")
                else:
                    cliente = sales_db.clientes.find_one({'id_cliente': str(id_sessao)})
                    print(f"DEBUG: Sucesso buscando como STRING: {str(id_sessao)}")
            except Exception as e_conv:
                print(f"DEBUG: Falha na conversão de tipo: {e_conv}")

        if not cliente:
            print(f"DEBUG: ❌ ERRO CRÍTICO - Cliente não encontrado no banco. ID buscado: {id_sessao}")
            return jsonify({'erro': 'Cliente não encontrado.'}), 404

        print(f"DEBUG: ✅ Cliente encontrado: {cliente.get('nick')}")
        
        # 3. CORREÇÃO DO DECIMAL128 E CÁLCULO DE SALDO
        raw_saldo = cliente.get('saldo_atual', 0.0)
        
        if hasattr(raw_saldo, 'to_decimal'):
            saldo_atual = float(raw_saldo.to_decimal())
        else:
            saldo_atual = float(raw_saldo)

        # Validações
        if valor_solicitado <= 0:
            return jsonify({'erro': 'Valor inválido.'}), 400
            
        if valor_solicitado > saldo_atual:
            print(f"DEBUG: Saldo insuficiente. Tem: {saldo_atual}, Pediu: {valor_solicitado}")
            return jsonify({'erro': 'Saldo insuficiente para esta solicitação.'}), 400

        # 👉 NOVO: CALCULA O NOVO SALDO APÓS O SAQUE
        novo_saldo = saldo_atual - valor_solicitado

        # 4. Criação do Registro de Saque
        novo_saque = {
            'id_cliente': id_sessao,
            'nick': cliente.get('nick', 'Desconhecido'),
            'nome_completo': cliente.get('nome_cliente', ''),
            'chave_pix': cliente.get('chave_pix') or data.get('chave_pix', 'Não informada'),
            'data_requisicao': hora_brasil().strftime('%Y-%m-%d %H:%M:%S'),
            'valor_requerido': valor_solicitado,
            'saldo_no_momento': saldo_atual,
            'status': 'pendente',
            'data_pgto': None,
            'operador_pgto': None,
            'valor_pgto': 0.0,
            'saldo_atual_pgto': 0.0
        }
        
        # Insere o pedido de saque
        resultado_saque = sales_db.requisao_saque.insert_one(novo_saque)
        id_novo_saque = str(resultado_saque.inserted_id)

        # 👉 NOVO: Debita o saldo e registra no extrato de forma segura
        registrar_transacao_cliente(
            db_vendas=sales_db,
            id_cliente=id_sessao,
            valor=-abs(valor_solicitado), # Saque é negativo
            tipo='saque_solicitado',
            descricao=f"Requisição de Saque (ID: {id_novo_saque[-6:]})",
            id_evento='SAQUE',
            origem="WEB_CLIENTE",
            registrado_por="SISTEMA_SAQUE"
        )

        # Envia Notificação ao Telegram
        try:
            data_formatada = hora_brasil().strftime('%d/%m/%Y às %H:%M:%S')
            valor_str = f"{valor_solicitado:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            saldo_str = f"{novo_saldo:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

            msg_telegram = (
                f"💰 <b>SOLICITAÇÃO DE SAQUE</b>\n"
                f"\n"
                f"👤 <b>ID: {cliente.get('id_cliente')} - {cliente.get('nick')}</b>\n"
                f"💲 Valor Solicitado: R$ {valor_str}\n" 
                f"🏦 Saldo Restante: R$ {saldo_str}\n"
                f"🔑 <b>PIX: {novo_saque['chave_pix']}</b>\n"
                f"🔄 Data: {data_formatada}"
            )
            enviar_notificacao_telegram(msg_telegram)

        except Exception as e_msg:
            print(f"Erro ao notificar Telegram: {e_msg}")

        print(f"✅ Saque solicitado e saldo atualizado: {cliente.get('nick')} - R$ {valor_solicitado}")
        print("--- FIM DEBUG ---\n")

        return jsonify({
            'status': 'ok', 
            'msg': 'Solicitação enviada! O valor foi retido para análise.',
            'novo_saldo': novo_saldo # Devolvemos o novo saldo para o Front atualizar a tela!
        })

    except Exception as e:
        print(f"❌ Erro EXCEPTION no saque: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'erro': 'Erro interno ao processar saque.'}), 500


@app.route('/api/historico_resultados', methods=['GET'])
def api_historico_resultados():
    """
    Retorna JSON com os últimos X eventos finalizados para exibir em cartões.
    Ordena corretamente Data/Hora e limita conforme tabela 'parametros'.
    """
    try:
        # 1. Conexão com o banco específico de Vendas
        sales_db = get_sales_db_connection()
        if sales_db is None:
            return jsonify({'erro': 'Erro de conexão com banco de vendas'}), 500

        # 2. Busca o Limite na tabela 'parametros'
        # Padrão: 10 eventos se não encontrar configuração
        limite_historico = 10
        try:
            param_doc = sales_db.parametros.find_one({}) # Pega o primeiro doc de parâmetros
            if param_doc and 'qtde_de_historicos' in param_doc:
                limite_historico = int(param_doc['qtde_de_historicos'])
        except Exception as e_param:            
            print(f"⚠️ Aviso: Usando limite padrão (10). Erro ao ler parametros: {e_param}")


        # 3. Busca TODOS os resultados (para podermos ordenar corretamente no Python)
        # Nota: Como a data é string "DD/MM/YYYY", o sort do Mongo não funciona cronologicamente.
        # Trazemos tudo (a lista de resultados não costuma ser gigante) e ordenamos na memória.
        cursor = sales_db.resultados.find({})
        lista_bruta = list(cursor)

        # 4. Função auxiliar de Ordenação
        def extrair_data_hora(item):
            # Tenta criar um objeto datetime combinando Data + Hora Final
            try:
                data_str = item.get('data_evento', '') # ex: "18/01/2026"
                hora_str = item.get('hora_final', '00:00') # ex: "23:57"
                
                # Formato esperado: DD/MM/YYYY HH:MM
                dt_str = f"{data_str} {hora_str}"
                return datetime.strptime(dt_str, "%d/%m/%Y %H:%M")
            except:
                # Se der erro na data, joga para o final da fila (ano 1900)
                return datetime(1900, 1, 1)

        # Ordena a lista (Do mais recente para o mais antigo -> reverse=True)
        lista_bruta.sort(key=extrair_data_hora, reverse=True)

        # 5. Aplica o Limite (Slice)
        lista_filtrada = lista_bruta[:limite_historico]

        # 6. Monta o JSON de Resposta (Formato Cartão)
        historico_cards = []

        for evento in lista_filtrada:
            # Processa Ganhadores (conforme estrutura do seu exemplo)
            ganhadores_fmt = []
            raw_ganhadores = evento.get('ganhadores', [])
            
            if isinstance(raw_ganhadores, list):
                for g in raw_ganhadores:
                    if not isinstance(g, dict): continue
                    
                    # Pega apenas o essencial para o card
                    ganhadores_fmt.append({
                        'premio': g.get('premio', 'Prêmio'),
                        'nome': g.get('nome', 'Anônimo'),
                        'valor': g.get('valor_rateio', g.get('valor_total_premio', 'R$ 0,00')),
                        'cartela': g.get('cartela', '--')
                    })

            # Adiciona ao card principal
            historico_cards.append({
                'id_evento': evento.get('id_evento'),
                'descricao': evento.get('descricao'),
                'data': evento.get('data_evento'),
                'hora_fim': evento.get('hora_final'),
                'total_bolas': evento.get('total_de_bolas'),
                'ganhadores': ganhadores_fmt
            })

        return jsonify({
            'status': 'ok',
            'quantidade': len(historico_cards),
            'limite_aplicado': limite_historico,
            'historico': historico_cards
        })

    except Exception as e:
        print(f"❌ Erro ao buscar histórico de resultados: {e}")
        return jsonify({'erro': 'Erro interno ao buscar histórico.'}), 500


@app.route('/api/cliente/config_sorte_extra/<id_evento_solicitado>', methods=['GET'])
def get_config_sorte_extra(id_evento_solicitado):
    def safe_money(val):
        try:
            return float(str(val)) if val is not None else 0.00
        except: return 0.00

    try:
        sales_db = get_sales_db_connection()
        if sales_db is None: return jsonify({'erro': 'Banco offline'}), 500
        
        param_config = db.parametros.find_one({}) or {}
        ativar_extra_global = param_config.get('buscar_sorte_extra', True) # Padrão True se não existir

        # 1. Busca a Configuração Global (sem filtro de ID, pega a ativa)
        config = sales_db.sorte_extra_config.find_one({}) 

        if config is None:
            return jsonify({'erro': 'Sorte Extra não configurado'}), 404

        # 2. Lógica Simplificada de "Evento Futuro"
        id_evento_venda = int(config.get('id_evento', 0))
        id_evento_tela = 0
        try: id_evento_tela = int(id_evento_solicitado)
        except: pass

        # Se o ID da venda for diferente do ID da tela, é futuro
        is_futuro = (id_evento_venda != id_evento_tela)

        # 3. LÊ DIRETO DO BANCO (Sem buscas extras)
        # Se não tiver gravado ainda, usa um fallback genérico   

        raw_info = config.get('data_hora_evento', 'Próximo Evento')

        # Verifica se o texto é longo o suficiente para ter a data no final
        # O trecho "30/01/2026 às 18:00" tem 16 caracteres
        if len(raw_info) > 16:
            
            # 1. Pega a Descrição (O Início)
            # Vai do começo até faltar 16 caracteres para o fim.
            # Ex: "Notebook No Valor De 2000 - "
            descricao = raw_info[:-17] 

            # 2. Pega a Data Curta (O Dia/Mês)
            # Começa no -16 e pega 5 letras.
            # Ex: "30/01"
            data_curta = raw_info[-16:-11]

            # 3. Pega a Hora (As 5 últimas letras)
            # Ex: "18:00"
            hora = raw_info[-5:]

            # 4. Junta tudo formatado
            # Resultado: "Notebook No Valor De 2000 - 30/01-18:00"
            info_evento = f"{descricao}{data_curta}-{hora}"
            
        else:
            # Se for texto curto (ex: "Aguarde..."), mantém original
            info_evento = raw_info

         
        if not ativar_extra_global:
            print(f"🔒 [API] Chave Global OFF. Ocultando Sorte Extra do evento {id_evento_venda}.")
            is_futuro = False
            id_evento_venda = 0

        resposta = {
            "id_evento": id_evento_venda,
            "ativo": ativar_extra_global,  
            "qtde_dezenas": config.get('qtde_dezenas', 5),
            "qtde_tope_sorte_extra": config.get('qtde_tope_sorte_extra', 10),
            "preco_cupom": safe_money(config.get('preco_cupom')),
            "premio_maximo": safe_money(config.get('premio_maximo')),             
            "premio_intermediario": safe_money(config.get('premio_intermediario')), 
            "premio_base": safe_money(config.get('premio_base')),                   
            "texto_regra_vitoria": config.get('texto_regra_vitoria', "Consulte as regras."),
            
            # --- CAMPOS VISUAIS ---
            "is_evento_futuro": is_futuro,
            "data_hora_evento": info_evento # <--- LIDO DIRETO DA TABELA CONFIG
        }

        return jsonify(resposta), 200

    except Exception as e:
        print(f"❌ Erro API: {e}")
        return jsonify({'erro': 'Erro interno'}), 500


# --- ROTA 2: CRIAÇÃO (PROVISÓRIA - ADMIN) ---
@app.route('/api/admin/criar_config_exemplo', methods=['POST'])
def criar_config_exemplo():
    sales_db = get_sales_db_connection()
    if sales_db is None: return jsonify({'error': 'Sem DB'}), 500

    data = request.json or {}
    
    # PEGA O ID E CONVERTE PARA INT32
    try:
        raw_id = data.get('id_evento', 18) # Padrão 18
        id_evt = int(raw_id)
    except:
        id_evt = 18 # Fallback seguro

    try:
        novo_config = {
            "id_evento": id_evt, # Gravando como Int32!
            "ativo": True,
            "qtde_dezenas": 3,
            "preco_cupom": Decimal128("5.00"),
            "premio_maximo": Decimal128("1500.00"),       
            "premio_intermediario": Decimal128("500.00"), 
            "premio_base": Decimal128("100.00"),          
            "texto_regra_vitoria": "🏆 REGRAS DO SORTEIO EXTRA: ..."
        }

        # Remove qualquer versão antiga (Int ou String) para limpar
        sales_db.sorte_extra_config.delete_many({'id_evento': {'$in': [id_evt, str(id_evt)]}})
        
        # Insere a nova correta
        sales_db.sorte_extra_config.insert_one(novo_config)

        #print(f"✅ Configuração Sorte Extra criada para evento {id_evt} (Int32)")
        return jsonify({'msg': f'Configuração criada com sucesso para o evento {id_evt}!'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- SUBSTITUA A ROTA DE COMPRA SORTE EXTRA POR ESTA ---
@app.route('/api/cliente/comprar_sorte_extra', methods=['POST', 'OPTIONS'])
def comprar_extra():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200
    if 'id_cliente' not in session: return jsonify({'erro': 'Sessão expirada.'}), 401

    try:
        sales_db = get_sales_db_connection()
        if sales_db is None: return jsonify({'erro': 'Banco offline.'}), 500

        data = request.json
        id_evento = data.get('id_evento')
        carrinho = data.get('carrinho') # Lista de listas: [[1,2,3], [10,20,30]]

        if not id_evento or not carrinho: return jsonify({'erro': 'Dados inválidos.'}), 400

        id_cli = int(session['id_cliente'])
        nick_cli = session.get('nick_cliente', 'Cliente Web')
        id_evento_int = int(id_evento)
        qtd_cupons = len(carrinho)

        # 1. Busca Cliente e Configuração
        cliente = sales_db.clientes.find_one({'id_cliente': id_cli})
        config_extra = sales_db.sorte_extra_config.find_one({'id_evento': id_evento_int})
        
        preco_unitario = float(str(config_extra.get('preco_cupom', 2.00))) if config_extra else 2.00
        custo_total = qtd_cupons * preco_unitario
        
        saldo_cliente = float(str(cliente.get('saldo_atual', 0)))
        if saldo_cliente < custo_total: return jsonify({'erro': 'Saldo insuficiente.'}), 400

        # =================================================================
        # 🐰 PULO DO GATO: GERAÇÃO DE ID SEQUENCIAL (CONTROLE_VENDA)
        # =================================================================
        # Incrementa o contador global do evento em X unidades (qtd de cupons comprados)
        retorno_seq = sales_db.controle_venda.find_one_and_update(
            {'id_evento': id_evento_int},
            {'$inc': {'cupom_sorte_extra': qtd_cupons}}, # Incrementa o lote todo
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        
        # Se eu comprei 3 cupons e o contador parou em 23:
        # Meus IDs são: 21, 22, 23.
        ultimo_id_gerado = retorno_seq.get('cupom_sorte_extra')
        primeiro_id_lote = ultimo_id_gerado - qtd_cupons + 1

        # Transforma o carrinho simples em carrinho com Objetos Identificados
        # De: [[1,2,3], [4,5,6]]
        # Para: [{id: 21, numeros: [1,2,3]}, {id: 22, numeros: [4,5,6]}]
        cartelas_com_id = []
        
        current_id = primeiro_id_lote
        for nums in carrinho:
            cartelas_com_id.append({
                'id_cupom': current_id,
                'numeros': nums
            })
            current_id += 1
        # =================================================================

        # 2. Grava a Venda
        nome_colecao_vendas = f"vendas_sorte_extra{id_evento_int}"
        nova_venda = {
            "id_evento": id_evento_int,
            "id_cliente": id_cli,
            "nick_cliente": nick_cli,
            "tipo": "sorte_extra",
            "cartelas": cartelas_com_id, # <--- Agora gravamos com ID!
            "qtd_cartelas": qtd_cupons,
            "valor_total": custo_total,
            "data_compra": hora_brasil(),
            "origem": "web_sorte_extra"
        }
        sales_db[nome_colecao_vendas].insert_one(nova_venda)

        # 3. Debita e Registra no Extrato
        registrar_transacao_cliente(
            db_vendas=sales_db,
            id_cliente=id_cli,
            valor=-abs(custo_total),
            tipo='compra_sorte_extra',
            descricao=f"Sorte Extra - Ev. {id_evento_int} ({qtd_cupons} cupons)",
            id_evento=id_evento_int,
            origem="WEB_CLIENTE",
            registrado_por="AUTO-ATENDIMENTO"
        )

        return jsonify({'status': 'ok', 'msg': 'Sucesso!', 'novo_saldo': saldo_cliente - custo_total}), 200

    except Exception as e:
        print(f"❌ Erro Sorte Extra: {e}")
        return jsonify({'erro': 'Erro interno.'}), 500


# --- ROTA DE VALIDAÇÃO: NOVA LÓGICA DE ACERTOS (5, 4, 3, 2) ---
@app.route('/api/admin/validar_sorte_extra', methods=['POST'])
def validar_sorte_extra():
    if db is None: return jsonify({'error': 'Sem conexão com DB Jogo'}), 500
    
    try:
        print("\n" + "="*50)
        print("🕵️ VALIDAÇÃO SORTE EXTRA (LÓGICA DE ACERTOS NO TOPE)")
        
        # 1. PEGA E NORMALIZA AS BOLAS DA MESA
        dados_bolas = db.bolas_mesa.find_one({}) or {}
        todas_bolas_raw = dados_bolas.get('bolas_cantadas', [])
        
        try:
            todas_bolas_int = [int(b) for b in todas_bolas_raw]
        except Exception as e:
            return jsonify({'error': 'Dados de bolas inválidos no banco'}), 500

        print(f"🎱 Bolas Sorteadas ({len(todas_bolas_int)}): {todas_bolas_int}")
        
        # 2. IDENTIFICA O EVENTO E CONFIGURAÇÃO
        rodada_info = db.rodada.find_one({})
        id_evento_ativo = int(rodada_info.get('id_evento', 0)) if rodada_info else 0
        
        sales_db = get_sales_db_connection()
        if sales_db is None: return jsonify({'error': 'Sem conexão DB Vendas'}), 500

        config = sales_db.sorte_extra_config.find_one({'id_evento': id_evento_ativo})
        
        # Pega a quantidade TOPE (Padrão 10) e o tamanho do cupom (Padrão 5)
        # Nota: O user mencionou 'Termos x (5 padrão) dezenas possíveis', assumindo cupom de 5.
        qtde_tope = int(config.get('qtde_tope_sorte_extra', 10)) if config else 10
        tamanho_cupom = int(config.get('qtde_dezenas', 5)) if config else 5 

        # 3. VERIFICA SE TEM BOLAS SUFICIENTES (O TOPE)
        #if len(todas_bolas_int) < qtde_tope:
            #msg = f'Aguardando {qtde_tope} bolas... Sorteados: {len(todas_bolas_int)}'
            #print(f"⏳ {msg}")
            #return jsonify({'status': 'aguardando', 'msg': msg})

        # 4. DEFINE O UNIVERSO DE ACERTO (As primeiras 'qtde_tope' bolas)
        # O user disse: "TODAS EM ORDEM ALEATORIA", então usamos SET para comparar
        bolas_tope_list = todas_bolas_int[:qtde_tope]
        set_bolas_tope = set(bolas_tope_list)
        
        print(f"🎯 UNIVERSO DE VALIDAÇÃO (TOP {qtde_tope}): {set_bolas_tope}")

        # 5. BUSCA CUPONS NO BANCO
        col_name = f"vendas_sorte_extra{id_evento_ativo}"
        if col_name not in sales_db.list_collection_names():
            cursor_vendas = sales_db.vendas_sorte_extra.find({'id_evento': id_evento_ativo})
        else:
            cursor_vendas = sales_db[col_name].find({})
        
        # Listas de ganhadores por quantidade de acertos
        ganhadores = {
            'acertos_5': [], # Prêmio Máximo
            'acertos_4': [], # Prêmio Intermediário
            'acertos_3': [], # Prêmio Base
            'acertos_2': []  # Bônus
        }
        
        total_cupons_analisados = 0
        
        for venda in cursor_vendas:
            nick = venda.get('nick_cliente', 'Anonimo')
            cartelas = venda.get('cartelas', [])
            
            for cupom in cartelas:
                if isinstance(cupom, list): continue 
                
                cid = cupom.get('id_cupom')
                numeros_raw = cupom.get('numeros', [])
                
                try:
                    numeros_int = [int(n) for n in numeros_raw]
                except: continue

                # Validação básica de integridade
                if len(numeros_int) < 2: continue 

                total_cupons_analisados += 1
                
                # ========================================================
                # 🧠 LÓGICA MATEMÁTICA (INTERSEÇÃO DE CONJUNTOS)
                # ========================================================
                
                # Transforma cupom em conjunto e compara com o conjunto do TOPE
                set_cupom = set(numeros_int)
                
                # A interseção devolve apenas os números que estão nos dois grupos
                acertos = len(set_cupom.intersection(set_bolas_tope))

                # Classificação Hierárquica (elif garante que só entra em um)
                if acertos == 5:
                    ganhadores['acertos_5'].append({'id': cid, 'nick': nick, 'nums': numeros_int, 'hits': acertos})
                    print(f"   🏆 5 ACERTOS: {nick} (#{cid})")
                    
                elif acertos == 4:
                    ganhadores['acertos_4'].append({'id': cid, 'nick': nick, 'nums': numeros_int, 'hits': acertos})
                    print(f"   🥈 4 ACERTOS: {nick} (#{cid})")
                    
                elif acertos == 3:
                    ganhadores['acertos_3'].append({'id': cid, 'nick': nick, 'nums': numeros_int, 'hits': acertos})
                    print(f"   🥉 3 ACERTOS: {nick} (#{cid})")
                    
                elif acertos == 2:
                    ganhadores['acertos_2'].append({'id': cid, 'nick': nick, 'nums': numeros_int, 'hits': acertos})
                    # print(f"   ✨ 2 ACERTOS: {nick} (#{cid})") # Opcional: printar bonus

        print(f"✅ Análise concluída. Total Cupons: {total_cupons_analisados}")
        print("="*50 + "\n")

        return jsonify({
            'status': 'sucesso',
            'total_analisado': total_cupons_analisados,
            'bolas_base': bolas_tope_list,
            'ganhadores': ganhadores, # Retorna o objeto com as 4 chaves
            'totais': {
                'a5': len(ganhadores['acertos_5']),
                'a4': len(ganhadores['acertos_4']),
                'a3': len(ganhadores['acertos_3']),
                'a2': len(ganhadores['acertos_2'])
            }
        })
        
    except Exception as e:
        print(f"❌ ERRO CRÍTICO NO SERVIDOR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



# --- ROTA ATUALIZADA: PERMITE LIMPAR A TELA (ENVIA NULL) ---
@app.route('/api/admin/publicar_cupom_terminal', methods=['POST'])
def publicar_cupom_terminal():
    try:
        data = request.json
        cupom_payload = data.get('cupom') # Pode ser os dados ou None

        # 1. SALVAR NO ARQUIVO FISICAMENTE
        with open(CUPOM_FILE, "w") as f:
            json.dump(cupom_payload, f)

        # 2. MANDAR O AVISO PELO WEBSOCKET (O "Empurrão")
        msg_ws = {
            'type': 'EXIBIR_CUPOM',
            'cupom': cupom_payload 
        }
        broadcast_para_clientes(msg_ws)
        
        return jsonify({'status': 'ok', 'msg': 'Arquivo atualizado e Broadcast enviado'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get_cupom_atual')
def get_cupom_atual():
    if os.path.exists(CUPOM_FILE):
        with open(CUPOM_FILE, "r") as f:
            dados = json.load(f)
        return jsonify(dados)
    return jsonify(None)



# --- ROTA ATUALIZADA: PERMITE LIMPAR A TELA (ENVIA NULL) ---
@app.route('/api/admin/publicar_cupom_terminal_aaa', methods=['POST'])
def publicar_cupom_terminal_aaa():
    try:
        data = request.json
        # Pega o cupom (pode ser um Objeto cheio ou None/Null para limpar)
        cupom_payload = data.get('cupom')

        # REMOVIDO: if not cupom_payload... (Isso bloqueava o limpar)

        # Monta a mensagem para o WebSocket
        msg_ws = {
            'type': 'EXIBIR_CUPOM',
            'cupom': cupom_payload # Se for None, o JS entende que é pra limpar
        }

        # Envia para todos
        broadcast_para_clientes(msg_ws)
        
        acao = "Cupom enviado" if cupom_payload else "Tela Limpa"
        #print(f"📡 Broadcast TV: {acao}")
        
        return jsonify({'status': 'ok', 'msg': acao})

    except Exception as e:
        print(f"Erro broadcast cupom: {e}")
        return jsonify({'error': str(e)}), 500


# --- FUNÇÃO ATUALIZADA: GRAVAR DATA/HORA NA CONFIG ---
def atualizar_ponteiro_sorte_extra(id_evento_finalizado):
    try:
        print(f"🔄 Iniciando migração do Sorte Extra (Evento Encerrado: {id_evento_finalizado})")
        
        sales_db = get_sales_db_connection()
        if sales_db is None: 
            print("❌ Erro: Sem conexão com banco de vendas.")
            return

        # 1. Busca Evento Atual (Lógica Híbrida Int/Str)
        busca_id = int(id_evento_finalizado)
        evento_atual = sales_db.eventos.find_one({'id_evento': busca_id})
        
        if not evento_atual:
            evento_atual = sales_db.eventos.find_one({'id_evento': str(busca_id)})

        if not evento_atual:
            print(f"❌ Evento {id_evento_finalizado} não encontrado. Abortando.")
            return

        # 2. Tenta ler a data atual para referência
        raw_data = evento_atual.get('data_evento') or evento_atual.get('data_inicio')
        raw_hora = evento_atual.get('hora_evento') or evento_atual.get('hora_inicio')
        
        try:
            dt_atual_str = f"{raw_data} {raw_hora}"
            dt_atual_obj = datetime.strptime(dt_atual_str, "%d/%m/%Y %H:%M")
        except Exception as e:
            print(f"⚡ Data inválida no evento atual. Usando AGORA como referência.")
            dt_atual_obj = hora_brasil() 

        # 3. Busca Próximo Evento
        candidatos = sales_db.eventos.find({
            'status': {'$in': ['ativo', 'paralizado']},
            'id_evento': {'$ne': busca_id}, 
            'id_evento': {'$ne': str(busca_id)} 
        })

        proximo_evento = None
        menor_diferenca = None

        for cand in candidatos:
            try:
                d_cand = cand.get('data_evento') or cand.get('data_inicio')
                h_cand = cand.get('hora_evento') or cand.get('hora_inicio')
                dt_cand_str = f"{d_cand} {h_cand}"
                dt_cand_obj = datetime.strptime(dt_cand_str, "%d/%m/%Y %H:%M")
                
                if dt_cand_obj > dt_atual_obj:
                    diferenca = dt_cand_obj - dt_atual_obj
                    if proximo_evento is None or diferenca < menor_diferenca:
                        menor_diferenca = diferenca
                        proximo_evento = cand
            except: continue
        
        # 4. PREPARA OS DADOS PARA GRAVAR NA TABELA DE CONFIG
        novo_id = 0
        texto_info_evento = "" # Campo novo

        if proximo_evento:
            novo_id = int(proximo_evento['id_evento'])
            
            # Pega os dados para formatar o texto
            adata_next = proximo_evento.get('data_evento')
            hora_next = proximo_evento.get('hora_evento')
            descricao_next = proximo_evento.get('descricao')
            
            # --- FORMATAÇÃO DE DATA COMPACTA (DD/MM - HH:MM) ---    
            adata_next = f"{adata_next[:5]} - {hora_next}"
 
            # Cria a string formatada "DD/MM/YYYY às HH:MM"  yyy
            texto_info_evento = f"{descricao_next} - {adata_next}"
            
            print(f"✅ PRÓXIMO: {descricao_next} - ID {novo_id} - Info: {texto_info_evento}")
        else:
            print("🚫 Nenhum evento futuro. Zerando configuração.")
            texto_info_evento = "Aguardando agendamento"

        # 5. ATUALIZA A CONFIGURAÇÃO COM O NOVO CAMPO
        campos_atualizar = {
            'id_evento': novo_id,
            'data_hora_evento': texto_info_evento # <--- GRAVANDO DIRETO NO BANCO
        }

        res = sales_db.sorte_extra_config.update_one(
            {'id_evento': int(id_evento_finalizado)}, 
            {'$set': campos_atualizar}
        )
        
        # Fallback se não achar pelo ID int
        if res.modified_count == 0:
             sales_db.sorte_extra_config.update_one(
                {'id_evento': str(id_evento_finalizado)}, 
                {'$set': campos_atualizar}
            )
        
        # Fallback final: Se não achou pelo ID antigo (pq já mudou?), atualiza QUALQUER config existente
        # Isso garante que o sistema não trave se o ID já tiver sido trocado manualmente
        if res.matched_count == 0:
             sales_db.sorte_extra_config.update_one({}, {'$set': campos_atualizar})
            
    except Exception as e:
        print(f"❌ Erro crítico migração: {e}")


# --- ROTA: PAGAMENTO IMEDIATO (COM AUTO-DETECÇÃO DE EVENTO) xxy ---
@app.route('/api/admin/pagar_ganhadores_imediato', methods=['POST'])
def pagar_ganhadores_imediato():
    try:
        data = request.json
        lista_pagar = data.get('ganhadores', [])
        
        # --- Lógica de detecção de Evento (Mantida da versão anterior) ---
        id_evento_recebido = data.get('id_evento')
        rodada_ativa = db.rodada.find_one({})
        id_evento_oficial = rodada_ativa.get('id_evento') if rodada_ativa else None
        
        id_final = id_evento_oficial if id_evento_oficial else id_evento_recebido
            
        if not id_final:
            return jsonify({'erro': 'ERRO DE SISTEMA: Não há rodada ativa para vincular o pagamento.'}), 400
        # -----------------------------------------------------------------

        if not lista_pagar:
            return jsonify({'erro': 'Lista vazia'}), 400

        sales_db = get_sales_db_connection()
        if sales_db is None: 
            return jsonify({'error': 'Sem conexão com banco de Vendas'}), 500

        logs = []
        pagos_count = 0
        id_evento_int = int(id_final)

        for g in lista_pagar:
            nick = g.get('nome')
            
            # Tratamento de valor
            raw_valor = g.get('valor_numerico', 0)
            if isinstance(raw_valor, str): raw_valor = raw_valor.replace(',', '.')
            valor = float(raw_valor)
            
            premio_desc = g.get('premio')
            id_cupom = str(g.get('cartela'))

            if valor <= 0: continue

            # 1. Busca Cliente (Para pegar o ID_CLIENTE numérico)
            cliente = sales_db.clientes.find_one({"nick": nick})
            if not cliente:
                logs.append(f"❌ Cliente {nick} não encontrado.")
                continue
            
            # Pega o ID numérico (ex: 41)
            id_cliente_db = cliente.get('id_cliente') 

            # Validação de Duplicidade (Pela descrição exata)
            descricao_formatada = f"Sorte Extra - {premio_desc} - #{id_cupom} - Evento {id_evento_int}"
            
            ja_pagou = sales_db.transacoes_clientes.find_one({
                'id_cliente': id_cliente_db,
                'id_evento': id_evento_int,
                'descricao': descricao_formatada
            })

            if ja_pagou:
                logs.append(f"⚠️ {nick} já recebeu. Ignorado.")
                continue

            # ==============================================================================
            # 2. ATUALIZAÇÃO ATÔMICA E GERAÇÃO DE EXTRATO CENTRALIZADA
            # ==============================================================================
            sucesso, msg = registrar_transacao_cliente(
                db_vendas=sales_db,
                id_cliente=id_cliente_db,
                valor=valor, # Valor positivo = ENTRADA/CRÉDITO
                tipo='premio_sorte_extra', # Conforme o nosso dicionário
                descricao=descricao_formatada,
                id_evento=id_evento_int,
                origem="MESA_ADMIN",
                registrado_por="MESA_ADMIN"
            )

            if sucesso:
                pagos_count += 1
                logs.append(f"✅ Pago R$ {valor:.2f} para {nick}")
            else:
                logs.append(f"❌ Erro ao atualizar saldo de {nick}: {msg}")

        return jsonify({'status': 'sucesso', 'pagos': pagos_count, 'logs': logs})

    except Exception as e:
        print(f"❌ ERRO PAGAMENTO: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Erro interno: {str(e)}"}), 500


@app.route('/api/get_nome_sala', methods=['GET'])
def get_nome_sala_api():
    # Retorna o JSON que o JavaScript está esperando
    return jsonify({"nome": nome_da_Sala})


# ========================
#  FORÇAR TROCA DE SENHA
# ========================
@app.route('/cliente/troca-senha-obrigatoria', methods=['GET', 'POST'])
def cliente_troca_senha_obrigatoria():
    # 1. SEGURANÇA: Verifica se tem id_cliente na sessão
    if 'id_cliente' not in session:
        return redirect('/cliente/login') # Ajuste para sua rota de login

    # Nome do arquivo HTML correto (o último que você enviou)
    NOME_TEMPLATE = 'cliente_trocar_senha.html'

    # --- NOVO: PEGA O NOME DA SESSÃO PARA EXIBIR ---
    nome_exibir = session.get('nick_cliente', 'Cliente') # Pega o nick salvo no login
    # -----------------------------------------------

    if request.method == 'POST':
        nova_senha = request.form.get('nova_senha', '').strip()
        confirma_senha = request.form.get('confirma_senha', '').strip()
        
        # Pega o ID da sessão
        id_cliente_sessao = session['id_cliente']

        # --- VALIDAÇÕES ---
        if nova_senha != confirma_senha:
            return render_template(NOME_TEMPLATE, error="As senhas não coincidem!")

        if nova_senha.lower() == "senha":
            return render_template(NOME_TEMPLATE, error="⚠️ Você não pode usar a senha padrão 'Senha'.")

        if len(nova_senha) < 4:
            return render_template(NOME_TEMPLATE, error="A senha deve ter pelo menos 4 caracteres.")

        try:
            # 2. CONEXÃO: Garante que pega o banco de vendas conectado
            sales_db = get_sales_db_connection()
            if sales_db is None:
                return render_template(NOME_TEMPLATE, error="Erro de conexão com o banco.")

            # Fiz este ajuste , ficou correto?
            nova_senha_gravar =  nova_senha.capitalize()
            
            # 3. CRIPTOGRAFIA: Gera o Hash para o login funcionar depois
            senha_hash = bcrypt.hashpw(nova_senha_gravar.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            # Prepara o filtro (alguns bancos usam int, outros string)
            try:
                filtro_id = int(id_cliente_sessao)
            except:
                filtro_id = str(id_cliente_sessao)

            # --- ATUALIZAÇÃO NO BANCO ---
            resultado = sales_db.clientes.update_one(
                {"id_cliente": filtro_id}, 
                {
                    "$set": {"senha": senha_hash}
                }
            )

            if resultado.modified_count > 0:
                print(f"✅ Senha do cliente {filtro_id} alterada com sucesso.")
                # Remove a obrigação de trocar a senha
                session.pop('troca_senha_pendente', None)
                
                # Redireciona para o Painel do Cliente
                return redirect('/') # Ajuste se sua rota for diferente
            else:
                # Se não mudou nada (talvez a senha fosse igual ou erro de ID)
                print(f"⚠️ Cliente {filtro_id} encontrado, mas senha não alterada.")
                return redirect('/')

        except Exception as e:
            print(f"❌ Erro ao salvar senha: {e}")
            return render_template(NOME_TEMPLATE, error="Erro interno. Tente novamente.")

    # Se for GET, mostra a tela
    return render_template(NOME_TEMPLATE, nome=nome_exibir)

# ========================
#  LOGOUT DO CLIENTE
# ========================
@app.route('/logout-cliente')
def logout_cliente():
    # Limpa todos os dados da sessão (ID, Nick, Flags, etc.)
    session.clear()
    print("👋 Cliente fez logout via Cancelar/Sair.")
    
    # Redireciona para a tela inicial (Login)
    return redirect('/')


# ==============================================================================
# 🤖 ROTA EXCLUSIVA DO ROBÔ: BUSCAR PRÓXIMO EVENTO E CALCULAR CRONÔMETRO
# ==============================================================================
@app.route('/api/admin/proximo_evento_robo', methods=['GET'])
def api_proximo_evento_robo():
    try:
        # Pega o ID do evento que acabou de terminar (para não o buscar de novo)
        id_atual = request.args.get('id_evento_atual')
        
        sales_db = get_sales_db_connection()
        if sales_db is None:
            return jsonify({'erro': 'Banco de Vendas offline'}), 500

        # 1. FILTRO: Busca apenas eventos Ativos ou Paralisados
        filtro = {'status': {'$in': ['ativo', 'paralizado', 'ATIVO', 'PARALIZADO']}}
        
        # Ignora o evento atual (se vier na URL)
        if id_atual:
            filtro['id_evento'] = {'$nin': [int(id_atual), str(id_atual)]}

        # 2. ORDENAÇÃO CRONOLÓGICA ABSOLUTA
        cursor = sales_db.eventos.find(filtro).sort([('data_evento', 1), ('hora_evento', 1)])
        
        proximo_evento = None
        agora = hora_brasil()

        # 3. VALIDAÇÃO DE DATA
        for evt in cursor:
            data_str = evt.get('data_evento')
            hora_str = evt.get('hora_evento')
            if not data_str or not hora_str:
                continue
                
            try:
                # Tenta converter a string do banco (DD/MM/YYYY HH:MM) para Objeto Tempo real
                dt_evt = datetime.strptime(f"{data_str} {hora_str}", "%d/%m/%Y %H:%M")
                
                # O primeiro que passar na conversão é o nosso alvo cronológico!
                proximo_evento = evt
                break
            except Exception as e:
                print(f"⚠️ [ROBO] Evento ignorado por formato de data inválido: {data_str} {hora_str}")
                continue

        if not proximo_evento:
            return jsonify({'status': 'fim_fila', 'msg': 'Não há mais eventos agendados.'})

        # 4. CÁLCULO INTELIGENTE DO TEMPO
        dt_alvo = datetime.strptime(f"{proximo_evento.get('data_evento')} {proximo_evento.get('hora_evento')}", "%d/%m/%Y %H:%M")
        
        # Diferença em Segundos (Pode ser positivo ou negativo)
        diferenca_segundos = (dt_alvo - agora).total_seconds()

        # 5. BUSCA O TEMPO DE VENDAS (Grace Period)
        param_config = db.parametros.find_one({}) or {}
        tempo_vendas = int(param_config.get('aviso_fim_das_vendas', 30))

        # 6. A REGRA DO "ATRASO"
        # Se a diferença for menor que o tempo de vendas (ou seja, o evento já devia ter começado),
        # nós limitamos a espera apenas ao tempo necessário para o fechamento de vendas.
        if diferenca_segundos <= tempo_vendas:
            segundos_espera_real = tempo_vendas
            status_tempo = "atrasado_ou_imediato"
        else:
            segundos_espera_real = int(diferenca_segundos)
            status_tempo = "agendado"

        # 7. RETORNO PARA O JAVASCRIPT
        return jsonify({
            'status': 'ok',
            'id_evento': str(proximo_evento.get('id_evento')),
            'descricao': proximo_evento.get('descricao', 'Sem Nome'),
            'data': proximo_evento.get('data_evento'),
            'hora': proximo_evento.get('hora_evento'),
            'segundos_restantes': segundos_espera_real,
            'tempo_vendas_config': tempo_vendas,
            'status_tempo': status_tempo
        })

    except Exception as e:
        print(f"❌ [ROBO] Erro na rota proximo_evento_robo: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'erro': str(e)}), 500


# ==============================================================================
# 💸 MÓDULO DE PAGAMENTOS (PIX) - FASE DE SIMULAÇÃO
# ==============================================================================

@app.route('/api/pagamento/gerar_pix_simulador', methods=['POST'])
def gerar_pix_simulado():
    # 👉 BLINDAGEM: Verifica se está logado e pega o ID da Sessão
    if 'id_cliente' not in session:
        return jsonify({'error': 'Usuário não logado.'}), 401
        
    try:
        dados = request.get_json()
        cliente_id = session['id_cliente'] # <--- Muito mais seguro!
        valor = float(dados.get('valor', 0))

        if valor <= 0:
            return jsonify({'error': 'Valor inválido'}), 400

        sales_db = get_sales_db_connection()
        if sales_db is None:
            return jsonify({'error': 'Erro de conexão com o banco'}), 500

        # 1. Cria um ID único para esta transação
        transacao_id = f"PIX-{uuid.uuid4().hex[:8].upper()}"

        # 2. Salva no Banco de Dados como PENDENTE
        nova_transacao = {
            'transacao_id': transacao_id,
            'cliente_id': cliente_id,
            'valor': valor,
            'status': 'PENDENTE',
            'data_criacao': datetime.now(ZoneInfo('America/Sao_Paulo')),
            'gateway': 'MERCADO_PAGO_MOCK'
        }
        
        # Cria a coleção 'transacoes_pix' automaticamente se não existir
        sales_db.transacoes_pix.insert_one(nova_transacao)

        # 3. Retorna os dados falsos para a tela do cliente testar
        # Quando tivermos o Mercado Pago, estas duas strings virão da API deles!
        codigo_copia_e_cola = f"00020101021126360014br.gov.bcb.pix0114+5511999999999520400005303986540{valor}5802BR5913BINGO MOCK6009SAO PAULO62070503***6304"
        qr_code_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" # Um pixel preto falso
        
        return jsonify({
            'sucesso': True,
            'transacao_id': transacao_id,
            'copia_e_cola': codigo_copia_e_cola,
            'qr_code_base64': qr_code_base64, # Imagem em base64
            'mensagem': 'PIX gerado com sucesso (Modo Simulação)'
        })

    except Exception as e:
        print(f"❌ Erro ao gerar PIX: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/webhook/pix_confirmado_simulador', methods=['POST'])
def webhook_pix_simulado():
    try:
        dados = request.get_json()
        transacao_id = dados.get('transacao_id')

        if not transacao_id:
            return jsonify({'error': 'ID da transação não informado'}), 400

        sales_db = get_sales_db_connection()
        
        # 1. Procura a transação no banco
        transacao = sales_db.transacoes_pix.find_one({'transacao_id': transacao_id})
        
        if not transacao:
            return jsonify({'error': 'Transação não encontrada'}), 404
            
        if transacao.get('status') == 'PAGO':
            return jsonify({'mensagem': 'Esta transação já foi processada anteriormente'}), 200

        # 2. Atualiza a transação PIX para PAGO
        sales_db.transacoes_pix.update_one(
            {'transacao_id': transacao_id},
            {'$set': {
                'status': 'PAGO',
                'data_pagamento': hora_brasil()
            }}
        )

        # ==============================================================================
        # 3. MÁGICA FINANCEIRA: Adiciona Saldo e Grava no Extrato (Atómico e Seguro)
        # ==============================================================================
        cliente_id_int = int(transacao['cliente_id'])
        valor_creditado = float(transacao['valor'])

        sucesso, msg = registrar_transacao_cliente(
            db_vendas=sales_db,
            id_cliente=cliente_id_int,
            valor=valor_creditado,
            tipo='compra_credito_pix', # Categoria oficial do nosso dicionário
            descricao=f"Depósito via PIX ({transacao_id})",
            id_evento='RECARGA_CARTEIRA', 
            origem="WEB_PIX_SIMULADO",
            registrado_por="SISTEMA_PIX"
        )

        if sucesso:
            print(f"✅ PIX SIMULADO CONFIRMADO E REGISTRADO! R$ {valor_creditado:.2f} creditados para o cliente {cliente_id_int}.")
        else:
            print(f"⚠️ AVISO CRÍTICO: PIX simulado recebido, mas falha ao creditar cliente {cliente_id_int}: {msg}")

        return jsonify({'sucesso': True, 'mensagem': 'Saldo creditado e histórico registrado com sucesso!'}), 200

    except Exception as e:
        print(f"❌ Erro no Webhook PIX: {e}")
        return jsonify({'error': str(e)}), 500


#2. A Rota Ouvinte (O Webhook de Confirmação)
#Esta é a rota onde o Mercado Pago vai bater à porta do seu servidor para avisar que o dinheiro caiu. Nós vamos construí-la agora, para que #possamos "fingir" que somos o Mercado Pago batendo nela.
###################################################

@app.route('/api/pagamento/gerar_pix', methods=['POST'])
def gerar_pix_real():
    if 'id_cliente' not in session:
        return jsonify({'error': 'Usuário não logado.'}), 401
        
    try:
        dados = request.get_json()
        cliente_id = session['id_cliente']
        valor = float(dados.get('valor', 0))

        if valor <= 0:
            return jsonify({'error': 'Valor inválido'}), 400

        # 1. Preparar os dados para o Mercado Pago
        # O MP exige um email. Como podemos não ter o email do cliente, geramos um falso válido
        email_cliente = f"cliente_{cliente_id}@seubingo.com.br"
        
        # Cria um ID de referência nosso para cruzar os dados depois
        referencia_interna = f"PIX-{uuid.uuid4().hex[:8].upper()}"

        payment_data = {
            "transaction_amount": valor,
            "description": f"Depósito na Carteira - Cliente {cliente_id}",
            "payment_method_id": "pix",
            "payer": {
                "email": email_cliente,
                "first_name": f"Cliente {cliente_id}"
            },
            "external_reference": referencia_interna
        }

        # 2. Envia o pedido para o Mercado Pago
        payment_response = mp_sdk.payment().create(payment_data)
        payment = payment_response["response"]

        # Verifica se o MP aceitou criar a cobrança
        if payment.get("status") != "pending":
            mensagem_erro = payment.get("message", "Erro desconhecido no gateway.")
            print(f"❌ Erro do Mercado Pago: {payment}")
            return jsonify({'error': f'O gateway recusou a transação: {mensagem_erro}'}), 400

        # 3. Extrai os dados preciosos (ID deles e o QR Code)
        id_transacao_mp = str(payment["id"]) # O ID real da transação no banco deles
        qr_code_base64 = payment["point_of_interaction"]["transaction_data"]["qr_code_base64"]
        copia_e_cola = payment["point_of_interaction"]["transaction_data"]["qr_code"]

        # 4. Salva no nosso banco de dados
        sales_db = get_sales_db_connection()
        nova_transacao = {
            'transacao_id': id_transacao_mp, # Agora usamos o ID deles!
            'referencia_interna': referencia_interna,
            'cliente_id': cliente_id,
            'valor': valor,
            'status': 'PENDENTE',
            'data_criacao': hora_brasil(),
            'gateway': 'MERCADO_PAGO'
        }
        
        sales_db.transacoes_pix.insert_one(nova_transacao)

        # 5. Manda para a tela do cliente
        return jsonify({
            'sucesso': True,
            'transacao_id': id_transacao_mp,
            'copia_e_cola': copia_e_cola,
            'qr_code_base64': qr_code_base64,
            'mensagem': 'PIX gerado com sucesso!'
        })

    except Exception as e:
        print(f"❌ Erro crítico ao gerar PIX Real: {e}")
        return jsonify({'error': 'Erro interno ao processar pagamento.'}), 500


@app.route('/api/webhook/pix_confirmado', methods=['POST'])
def webhook_mercado_pago():
    try:
        dados = request.args.to_dict() # O MP manda alguns dados na URL (query params)
        body = request.get_json() or {} # E outros no corpo (JSON)
        
        print("🔔 Notificação recebida do Mercado Pago:", dados, body)

        # O Mercado Pago pode mandar "data.id" ou "id" dependendo do tipo de notificação
        payment_id = dados.get('data.id') or body.get('data', {}).get('id')

        # Se não enviou ID de pagamento, ignoramos (pode ser notificação de teste ou de outro tipo)
        if not payment_id:
            return jsonify({'sucesso': True, 'mensagem': 'Notificação ignorada (sem ID de pagamento)'}), 200

        # 1. BLINDAGEM MÁXIMA: Pergunta ao Mercado Pago o status real desse ID
        payment_info = mp_sdk.payment().get(payment_id)
        payment = payment_info["response"]

        if payment.get("status") != "approved":
            return jsonify({'sucesso': True, 'mensagem': 'Pagamento ainda não está aprovado.'}), 200

        # Se chegámos aqui, O PIX FOI REALMENTE PAGO! 
        transacao_id = str(payment_id)
        sales_db = get_sales_db_connection()
        
        # 2. Procura a transação no nosso banco
        transacao = sales_db.transacoes_pix.find_one({'transacao_id': transacao_id})
        
        if not transacao:
            # Pode ser um PIX gerado em outro sistema seu, apenas ignoramos
            return jsonify({'sucesso': True}), 200
            
        if transacao.get('status') == 'PAGO':
            return jsonify({'sucesso': True, 'mensagem': 'Já processado anteriormente'}), 200

        # 3. Atualiza a transação para PAGO
        sales_db.transacoes_pix.update_one(
            {'transacao_id': transacao_id},
            {'$set': {'status': 'PAGO', 'data_pagamento': hora_brasil()}}
        )

        # ==============================================================================
        # 4. A MÁGICA DO SALDO (Totalmente segura e atómica agora)
        # ==============================================================================
        cliente_id_int = int(transacao['cliente_id'])
        valor_creditado = float(transacao['valor'])

        sucesso, msg = registrar_transacao_cliente(
            db_vendas=sales_db,
            id_cliente=cliente_id_int,
            valor=valor_creditado,
            tipo='compra_credito_pix', # Categoria oficial do nosso dicionário
            descricao=f"Depósito via PIX ({transacao_id})",
            id_evento='RECARGA_CARTEIRA',
            origem="WEB_PIX",
            registrado_por="SISTEMA_PIX"
        )

        if sucesso:
            print(f"✅🤑 PIX DE R$ {valor_creditado:.2f} RECEBIDO E CREDITADO PARA O CLIENTE {cliente_id_int}!")
        else:
            print(f"⚠️ AVISO CRÍTICO: PIX recebido, mas falha ao creditar cliente {cliente_id_int}: {msg}")

        # Tem que devolver 200 pro MP ou ele fica tentando mandar a mesma notificação infinitamente
        return jsonify({'sucesso': True}), 200

    except Exception as e:
        print(f"❌ Erro no Webhook MP: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/saques_pendentes', methods=['GET'])
def api_saques_pendentes():
    if 'id_cliente' not in session:
        return jsonify({'erro': 'Usuário não logado.'}), 401

    try:
        sales_db = get_sales_db_connection()
        
        # 👉 TRATAMENTO DE EXCEÇÃO: Converte para string e elimina espaços vazios
        id_cliente_limpo = str(session['id_cliente']).strip()

        # Faz a busca na tabela requisao_saque
        cursor = sales_db.requisao_saque.find({
            'id_cliente': id_cliente_limpo,
            'status': 'pendente'
        }).sort('data_requisicao', -1) # Ordena do mais novo para o mais antigo

        lista_pendentes = []
        for req in cursor:
            lista_pendentes.append({
                'id_requisicao': str(req.get('_id')),
                'valor_requerido': float(req.get('valor_requerido', 0.0)),
                'saldo_no_momento': float(req.get('saldo_no_momento', 0.0)),
                'data_requisicao': str(req.get('data_requisicao', '')),
                'status': str(req.get('status', 'pendente'))
            })

        return jsonify({'sucesso': True, 'dados': lista_pendentes})

    except Exception as e:
        print(f"❌ Erro ao buscar saques pendentes: {e}")
        return jsonify({'erro': 'Erro interno ao processar a requisição.'}), 500


# ==============================================================================
# 🚀 MAIN: VERSÃO OTIMIZADA PARA DOCKER E WINDOWS (SEM TRAVAMENTOS)
# ==============================================================================
def main():
    print(f"🚩 [1] Script iniciado para SALA: {PARAM_ID_SALA}")

    try:
        # Pega a porta do ambiente (Docker) ou usa 3001 (Local)
        port = int(os.environ.get('PORT', 3001))

        # 1. Banco de Dados
        connect_main_db()
        print(f"🚩 [2] Banco Conectado com sucesso!")

        # --- ADICIONE ESTA LINHA AQUI ---
        carregar_configuracao_treinamento() 
        # -------------------------------

        # 2. Watcher (Monitora o banco em paralelo)
        print("🚩 [3] Iniciando Watcher...")
        gevent.spawn(watch_collections)

        # 3. Servidor Web (WSGI)
        from gevent import pywsgi
        from geventwebsocket.handler import WebSocketHandler

        # --- AQUI ESTÁ A CORREÇÃO VITAL PARA O ERRO 'BlockingSwitchOutError' ---
        # Criamos um Pool de 1000 conexões. Isso isola cada cliente num processo leve.
        # Sem isso, o Python 3.12+ no Windows pode confundir o loop de eventos.
        pool_de_conexoes = pool.Pool(1000) 

        print(f"🚩 [4] Iniciando WSGIServer na porta {port} (Modo Pool)...")
        
        server = pywsgi.WSGIServer(
            ('0.0.0.0', port), 
            app, 
            handler_class=WebSocketHandler,
            log=None,
            spawn=pool_de_conexoes # <--- AQUI A MÁGICA ACONTECE
        )
        
        print("✅ [5] Servidor ONLINE e PRONTO. Aguardando conexões...")
        server.serve_forever()

    except KeyboardInterrupt:
        print("\n🛑 Servidor parado pelo usuário.")
    except Exception as e:
        print(f"\n❌ Erro Fatal no Main: {e}")
        traceback.print_exc()

# ==============================================================================
# GATILHO DE EXECUÇÃO
# ==============================================================================
if __name__ == '__main__':
    main()
