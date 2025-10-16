# web_server.py
import sys
import http.server
import socketserver

PORT = 8000
# Define o endereço de ligação (bind)
HOST = '0.0.0.0'

Handler = http.server.SimpleHTTPRequestHandler

try:
    with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
        print(f"Servidor iniciado em http://{HOST}:{PORT}")
        print("Pressione Ctrl+C para parar.")
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServidor parado com sucesso.")
    sys.exit(0)
except Exception as e:
    print(f"Erro ao iniciar o servidor: {e}")
    sys.exit(1)