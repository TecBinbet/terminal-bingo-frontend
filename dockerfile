FROM python:3.9-slim

WORKDIR /app
# Isso obriga o Python a mostrar o print na hora
ENV PYTHONUNBUFFERED=1

# Instala compiladores (Necessário para Gevent e bibliotecas C)
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    musl-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Instala dependências
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo o projeto
COPY . .

# Limpa caches antigos do Python para evitar conflitos
RUN find . -type d -name "__pycache__" -exec rm -rf {} +

# Expõe a porta interna (o Nginx acessa aqui)
EXPOSE 3001

CMD ["python", "server.py"]