import time
import requests # BIBLIOTECA PARA ACESSAR A INTERNET
import serial
import serial.tools.list_ports
from datetime import datetime

# =========================================================
# CONFIGURAÇÕES DE CONEXÃO (INTERNET)
# =========================================================
# Se for local: http://localhost:3001/api/buscar_comando
# Se for DigitalOcean: http://SEU_IP_AQUI:3001/api/buscar_comando
URL_SERVIDOR = "http://localhost:3001/api/buscar_comando"

# Identificação da Sala (Para o servidor saber qual bola entregar)
ID_SALA = "001" 

# Configurações da Máquina (Serial)
BAUD_RATE = 9600
conexao_serial = None

def get_time():
    return datetime.now().strftime("%H:%M:%S")

# =========================================================
# 1. FUNÇÕES DE SERIAL (MANTIDAS IGUAIS)
# =========================================================

def iniciar_serial():
    global conexao_serial
    if conexao_serial and conexao_serial.is_open:
        return True
    
    portas = serial.tools.list_ports.comports()
    if not portas:
        # Silenciei o erro para não poluir o log se estiver sem máquina
        # print(f"[{get_time()}] ⚠️ [SERIAL] Nenhuma porta detectada!")
        return False
        
    porta = portas[0].device
    try:
        conexao_serial = serial.Serial(porta, BAUD_RATE, timeout=1)
        print(f"[{get_time()}] 🔌 [SERIAL] Conectado na porta: {porta}")
        return True
    except Exception as e:
        print(f"[{get_time()}] ❌ [SERIAL] Erro ao abrir porta {porta}: {e}")
        return False

def enviar_brabingo(codigos):
    if not iniciar_serial():
        print(f"[{get_time()}] ⚠️ Falha: Tentando enviar '{codigos}' mas a serial está OFF.")
        return False
    try:
        s_limpa = str(codigos).strip()
        # Cálculo de Checksum
        z = 85
        for char in s_limpa:
            z += ord(char)
        z = z % 256
        checksum = (255 - z + 1) % 256
        
        payload = s_limpa.encode('latin1') + bytes([checksum]) + b'\r\n'
        conexao_serial.write(payload)
        print(f"[{get_time()}] 📤 [HARDWARE] Bola girada: {s_limpa}")
        return True
    except Exception as e:
        print(f"[{get_time()}] ❌ [HARDWARE] Erro ao enviar: {e}")
        return False

# =========================================================
# 2. LOOP DE BUSCA NA INTERNET (POLLING)
# =========================================================

def main():
    print("==================================================")
    print(f"🤖 AGENTE VIA INTERNET INICIADO EM {get_time()}")
    print(f"📡 Conectando a: {URL_SERVIDOR}")
    print(f"🏠 Sala ID: {ID_SALA}")
    print("==================================================")
    
    # Tenta abrir a serial logo no início
    iniciar_serial()

    while True:
        try:
            # 1. Pergunta ao servidor: "Tem bola para a sala 001?"
            # timeout=2 evita que o agente trave se a internet cair
            resposta = requests.get(URL_SERVIDOR, params={'sala': ID_SALA}, timeout=2)
            
            if resposta.status_code == 200:
                dados = resposta.json()
                bola = dados.get("comando") # Pode vir "F05" ou None
                
                if bola:
                    print(f"\n[{get_time()}] 📨 [RECEBIDO] Nova bola da nuvem: {bola}")
                    enviar_brabingo(bola)
                else:
                    # Se não tiver bola, não faz nada (silencioso)
                    pass
            else:
                print(f"[{get_time()}] ⚠️ Erro no Servidor: Código {resposta.status_code}")

        except requests.exceptions.ConnectionError:
            print(f"[{get_time()}] ❌ Servidor offline ou URL errada. Tentando reconectar...")
            time.sleep(2) # Espera mais tempo se estiver sem net
            
        except Exception as e:
            print(f"[{get_time()}] ⚠️ Erro genérico: {e}")
        
        # 2. Espera X segundos antes de perguntar de novo
        time.sleep(1) 

if __name__ == '__main__':
    main()