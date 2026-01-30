from gevent import monkey
monkey.patch_all()

from flask import Flask, request
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
import json
import time

app = Flask(__name__)

@app.route('/')
def index():
    return "Servidor de Teste Online!"

@app.route('/stream')
def stream():
    if request.environ.get('wsgi.websocket'):
        ws = request.environ['wsgi.websocket']
        print("✅ [TESTE] WebSocket CONECTADO!")
        try:
            while not ws.closed:
                ws.send(json.dumps({"mensagem": "Estou vivo", "timestamp": time.time()}))
                print("ping...")
                time.sleep(2)
        except Exception as e:
            print(f"❌ Erro: {e}")
    return ""

if __name__ == '__main__':
    print("🚀 Iniciando Teste Mínimo na porta 3001...")
    http_server = WSGIServer(('0.0.0.0', 3001), app, handler_class=WebSocketHandler)
    http_server.serve_forever()