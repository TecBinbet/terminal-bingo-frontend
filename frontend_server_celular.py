import http.server
import socketserver
import os
import sys

PORT = 8000

# Esta função irá encontrar o caminho correto para o frontend
def get_frontend_path(relative_path):
    if getattr(sys, 'frozen', False):
        # Estamos rodando como um executável PyInstaller
        # O caminho base é o diretório temporário onde os arquivos são extraídos
        base_path = sys._MEIPASS
    else:
        # Estamos rodando como um script Python normal
        # O caminho base é o diretório do script
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, relative_path)

# Mude para o diretório onde os arquivos de frontend estarão
os.chdir(get_frontend_path('.'))

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print("Servidor do Frontend rodando na porta", PORT)
    httpd.serve_forever()