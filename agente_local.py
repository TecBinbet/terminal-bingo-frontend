import serial
import serial.tools.list_ports

#Serial
BAUD_RATE = 9600
conexao_serial = None # Variável para guardar a conexão viva
NOME_PORTA_ATUAL = "Nenhuma"




# =========================================================
# SERIAL: FUNÇÕES PARA COMUNICAÇÃO PELA SERIAL (COMx)
# =========================================================

def detectar_porta_automatica():
    """
    Varre o sistema em busca de portas COM ativas.
    Retorna a primeira que encontrar (ex: 'COM3').
    Se não achar nada, retorna None.
    """
    print("🕵️ [SERIAL] Procurando portas disponíveis...")
    
    # Lista todas as portas encontradas
    portas_encontradas = serial.tools.list_ports.comports()
    
    if not portas_encontradas:
        print("❌ [SERIAL] Nenhuma porta COM detectada no computador.")
        return None

    # Lista para debug (mostra o que achou no log)
    for p in portas_encontradas:
        print(f"   -> Encontrado: {p.device} ({p.description})")

    # Pega a primeira da lista (comportamento igual ao seu VB6)
    primeira_porta = portas_encontradas[0].device
    
    print(f"🎯 [SERIAL] Porta selecionada automaticamente: {primeira_porta}")
    return primeira_porta


def iniciar_serial():
    global conexao_serial, NOME_PORTA_ATUAL # <--- Avisa que vamos mexer nela
    
    if conexao_serial and conexao_serial.is_open:
        return True

    try:
        porta_detectada = detectar_porta_automatica()
        
        if not porta_detectada:
            NOME_PORTA_ATUAL = "Nenhuma detectada"
            return False

        print(f"🔌 [SERIAL] Conectando em {porta_detectada}...")
        
        # Conecta
        conexao_serial = serial.Serial(porta_detectada, 9600, timeout=1)
        
        # Salva o nome na Global para usarmos depois em logs ou APIs
        NOME_PORTA_ATUAL = porta_detectada 
        
        print("⏳ [SERIAL] Aguardando reinício...")
        time.sleep(2)
        print(f"✅ [SERIAL] Conectado e Pronto na {NOME_PORTA_ATUAL}!")
        return True

    except Exception as e:
        print(f"❌ [SERIAL] Erro: {e}")
        conexao_serial = None
        NOME_PORTA_ATUAL = "Erro"
        return False


def enviar_comando_serial(comando_str):
    """
    Envia uma string para o dispositivo conectado.
    Adiciona automaticamente a quebra de linha se necessário.
    """
    global conexao_serial

    # 1. Segurança: Se não tem conexão, tenta conectar agora
    if conexao_serial is None or not conexao_serial.is_open:
        print("⚠️ [SERIAL] Conexão fechada. Tentando reconectar...")
        if not iniciar_serial():
            return False # Desiste se não conseguir conectar

    try:
        # 2. Preparação: Garante que é string e adiciona \n (muito comum em hardware)
        if not comando_str.endswith('\n'):
            comando_str += '\n'
        
        # 3. Codificação: Transforma texto em bytes (Hardware não lê texto, lê bytes)
        dados_bytes = comando_str.encode('utf-8')

        # 4. Envio
        conexao_serial.write(dados_bytes)
        print(f"📤 [SERIAL] Enviado: {comando_str.strip()}")

        # 5. (Opcional) Leitura de confirmação do dispositivo
        # Se o dispositivo responder "OK", podemos ler aqui (ajuste conforme necessidade)
        # resposta = conexao_serial.readline().decode().strip()
        # if resposta:
        #    print(f"📥 [SERIAL] Resposta: {resposta}")
        
        return True

    except Exception as e:
        print(f"❌ [SERIAL] Falha ao enviar: {e}")
        # Se deu erro de escrita, provavelmente o cabo desconectou. Fechamos para tentar depois.
        fechar_serial()
        return False

def fechar_serial():
    """Fecha a conexão de forma limpa."""
    global conexao_serial
    if conexao_serial and conexao_serial.is_open:
        conexao_serial.close()
        conexao_serial = None
        print("🔒 [SERIAL] Porta fechada.")


def enviar_brabingo(codigos):
    global conexao_serial 

    # 1. Validação e Reconexão Automática
    if conexao_serial is None or not conexao_serial.is_open:
        print("⚠️ [BRABINGO] Conexão fechada. Tentando reconectar...")
        
        # Chama a função que abre a porta. 
        # NOTA: A função iniciar_serial JÁ DEVE TER o time.sleep(2) lá dentro.
        conectou = iniciar_serial() 
        
        if not conectou:
            print("❌ [BRABINGO] Falha ao reconectar. Comando cancelado.")
            return False
            
        # Se chegou aqui, conectou e já esperou os 2 segundos do sleep.
        # Podemos prosseguir com o envio.

    try:
        # --- Lógica de Checksum (VB6 recriada) ---
        s_limpa = codigos.strip() 
        z = 85

        for char in s_limpa:
            z += ord(char)

        z = z % 256
        checksum_final = (255 - z + 1) % 256

        # Montagem do pacote
        payload_final = s_limpa.encode('ascii') + bytes([checksum_final]) + b'\r\n'

        # Envio
        conexao_serial.write(payload_final)
        
        print(f"📤 [BRABINGO] Enviado: {payload_final}")
        return True

    except Exception as e:
        print(f"❌ [BRABINGO] Erro crítico no envio: {e}")
        
        # Chama a limpeza. Não precisa de try/except aqui 
        # porque a função fechar_serial já trata tudo internamente.
        fechar_serial()
        
        return False


# =========================================================
# 1. ROTA DA SERIAL (COMx)
# =========================================================
# Mostrar a porta com selecioinada

@app.route('/api/status_hardware', methods=['GET'])
def get_status_hardware():
    # Retorna se está conectado e qual porta está usando
    conectado = (conexao_serial is not None and conexao_serial.is_open)
    return jsonify({
        "online": conectado,
        "porta": NOME_PORTA_ATUAL
    })


# Rota para receber comandos do Painel Admin e enviar para o Hardware
@app.route('/api/enviar_comando_serial', methods=['POST'])
def api_enviar_serial():
    try:
        dados = request.get_json()
        codigo = dados.get('codigo')

        if not codigo:
            return jsonify({"erro": "Código não informado"}), 400

        print(f"🤖 [API] Recebido comando serial: {codigo}")

        # Chama a sua função blindada
        sucesso = enviar_brabingo(codigo)

        if sucesso:
            return jsonify({"status": "sucesso", "msg": f"Enviado: {codigo}"}), 200
        else:
            return jsonify({"erro": "Falha ao enviar para porta serial"}), 500

    except Exception as e:
        print(f"❌ Erro na rota serial: {e}")
        return jsonify({"erro": str(e)}), 500
