import requests

# O token que o BotFather lhe deu
TOKEN = "8607377804:AAG-bpYXb2oRYQACVJWSBAV18cIDMGkYfmY"
url = f"https://api.telegram.org/bot{TOKEN}/getUpdates"

print("A procurar mensagens na caixa de entrada do bot...")

try:
    resposta = requests.get(url).json()
    
    if resposta.get("ok") and len(resposta.get("result", [])) > 0:
        for item in resposta["result"]:
            if "message" in item:
                chat_id = item["message"]["chat"]["id"]
                nome = item["message"]["chat"].get("first_name", "Utilizador")
                texto = item["message"].get("text", "")
                
                print(f"\n✅ SUCESSO!")
                print(f"👤 Quem enviou: {nome}")
                print(f"💬 Mensagem lida: '{texto}'")
                print(f"🎯 O SEU CHAT_ID É: {chat_id}\n")
                break
    else:
        print("\n❌ A caixa de entrada está vazia.")
        print("Tem a certeza de que enviou uma mensagem para o SEU bot no Telegram?")
        print("Envie um 'Oi' e volte a correr este script.\n")
        
except Exception as e:
    print(f"\n❌ Erro de ligação: {e}")