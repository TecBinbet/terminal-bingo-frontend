# Alterado para 3.12-slim (Versão leve do 3.12)
FROM python:3.9-slim

WORKDIR /app
# Isso obriga o Python a mostrar o print na hora, sem guardar segredo
ENV PYTHONUNBUFFERED=1

# Instala compiladores (Obrigatório para o Gevent no Python 3.12)
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    musl-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Atualiza o PIP para garantir compatibilidade com rodas (wheels) do 3.12
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# --- MUDANÇA AQUI ---
# 1. Copia tudo
COPY . .

# 2. Garante que não existe cache velho atrapalhando
RUN find . -type d -name "__pycache__" -exec rm -rf {} +

# 3. Força a cópia do server.py por cima de tudo para quebrar o cache do Docker
COPY server.py /app/server.py

EXPOSE 3001

CMD ["python", "server.py"]
#CMD ["python", "teste_minimo.py"]