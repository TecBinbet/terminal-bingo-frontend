import time
import socketio
import serial
import serial.tools.list_ports

# =========================================================
# CONFIGURAÇÕES
# =========================================================
# Mude para o endereço real do seu site na DigitalOcean quando subir
URL_SERVIDOR_NUVEM = 'http://localhost:3001' 
TOKEN_SALA = 'sala1' 

# GLOBAIS
sio = socketio.Client()
conexao_serial = None 
BAUD_RATE = 9600

# =========================================================
# 1. SUAS FUNÇÕES DE SERIAL (Mantidas exatamente iguais)
# =========================================================

def detectar_porta_automatica():
    print("🕵️ [SERIAL] Procurando portas disponíveis...")
    portas_encontradas = serial.tools.list_ports.comports()
    
    if not portas_encontradas:
        print("❌ [SERIAL] Nenhuma porta COM detectada.")
        return None

    for p in portas_encontradas:
        print(f"   -> Encontrado: {p.device} ({p.description})")

    primeira_porta = portas_encontradas[0].device
    print(f"🎯 [SERIAL] Porta selecionada: {primeira_porta}")
    return primeira_porta

def fechar_serial():
    global conexao_serial
    if conexao_serial and conexao_serial.is_open:
        conexao_serial.close()
        conexao_serial = None
        NOME_PORTA_ATUAL = "Desconectado"
        print("🔒 [SERIAL] Porta fechada.")

def iniciar_serial():
    global conexao_serial
    
    if conexao_serial and conexao_serial.is_open:
        return True

    try:
        porta_detectada = detectar_porta_automatica()
        
        if not porta_detectada:
            return False

        print(f"🔌 [SERIAL] Conectando em {porta_detectada}...")
        
        conexao_serial = serial.Serial(porta_detectada, BAUD_RATE, timeout=1)
        
        print("⏳ [SERIAL] Aguardando reinício...")
        time.sleep(2)
        print(f"✅ [SERIAL] Conectado na {NOME_PORTA_ATUAL}!")
        return True

    except Exception as e:
        print(f"❌ [SERIAL] Erro: {e}")
        conexao_serial = None
        return False

def enviar_brabingo(codigos):
    global conexao_serial 

    # Validação e Reconexão Automática
    if conexao_serial is None or not conexao_serial.is_open:
        print("⚠️ [BRABINGO] Conexão fechada. Tentando reconectar...")
        if not iniciar_serial():
            print("❌ [BRABINGO] Falha ao reconectar.")
            return False
            
    try:
        # Lógica de Checksum (VB6)
        s_limpa = codigos.strip() 
        z = 85
        for char in s_limpa: z += ord(char)
        z = z % 256
        checksum_final = (255 - z + 1) % 256

        # Mudei para 'latin1' para aceitar acentos se necessário, mas 'ascii' funciona tb
        payload_final = s_limpa.encode('latin1') + bytes([checksum_final]) + b'\r\n'

        conexao_serial.write(payload_final)
          
        print(f"📤 [HARDWARE] Enviado: {payload_final}")
        return True

    except Exception as e:
        print(f"❌ [BRABINGO] Erro crítico: {e}")
        fechar_serial()
        return False

# =========================================================
# 2. CONEXÃO COM A NUVEM (SocketIO)
# =========================================================

@sio.event
def connect():
    print("☁️  CONECTADO AO SERVIDOR BINGO!")
    # Avisa a nuvem: "Estou pronto para controlar a Sala 1"
    sio.emit('registro_agente', {'sala': TOKEN_SALA})
    # Tenta conectar a serial assim que logar na nuvem
    iniciar_serial()

@sio.event
def disconnect():
    print("❌ Desconectado da nuvem.")

# 🔔 AQUI É O GATILHO: Quando a nuvem mandar, o agente obedece
@sio.on('comando_hardware')
def on_comando(data):
    codigo = data.get('codigo')
    print(f"🔔 [NUVEM] Comando recebido: {codigo}")
    
    sucesso = enviar_brabingo(codigo)
    
    # Avisa a nuvem se deu certo ou não
    sio.emit('resposta_agente', {'sucesso': sucesso, 'msg': f"Comando {codigo} processado"})

# =========================================================
# 3. LOOP PRINCIPAL
# =========================================================
def main():
    print(f"🤖 AGENTE LOCAL INICIADO ({TOKEN_SALA})")
    print("---------------------------------------")
    
    while True:
        try:
            if not sio.connected:
                print(f"🔄 Tentando conectar na nuvem: {URL_SERVIDOR_NUVEM}")
                sio.connect(URL_SERVIDOR_NUVEM)
                sio.wait() # Fica esperando eventos
            else:
                time.sleep(5)
        except Exception as e:
            print(f"❌ Erro de conexão (Nuvem): {e}")
            time.sleep(5) # Espera 5s antes de tentar de novo

if __name__ == '__main__':
    main()