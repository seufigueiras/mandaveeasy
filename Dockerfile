# ==========================================================
# ESTÁGIO 1: BUILD DO FRONTEND (Vite/React)
# Objetivo: Criar a pasta 'dist'
# ==========================================================
FROM node:20-alpine AS builder

# Define o diretório de trabalho no container
WORKDIR /app

# Copia os arquivos de definição de dependência
# Isso é crucial para que o cache do Docker funcione
COPY package.json package-lock.json ./

# Instala todas as dependências (incluindo devDependencies para o build do Vite)
RUN npm install

# Copia o restante do código fonte (inclui o frontend React/Vite)
COPY . .

# Roda o build do frontend, que cria a pasta 'dist'
# Seu script "build": "vite build" será executado
RUN npm run build


# ==========================================================
# ESTÁGIO 2: AMBIENTE DE EXECUÇÃO (Runtime)
# Objetivo: Rodar o Express (server.js) e servir a pasta 'dist'
# ==========================================================
FROM node:20-alpine

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de definição de dependência
COPY package.json package-lock.json ./

# Instala SOMENTE as dependências de produção
# Isso exclui o Vite e devDependencies, tornando a imagem final muito menor.
RUN npm install --only=production

# Copia o código do backend e a pasta 'dist'
# 1. Copia o server.js
COPY server.js ./

# 2. Copia o build do frontend da etapa anterior (builder)
COPY --from=builder /app/dist ./dist

# Expõe a porta que o seu Express está escutando (você deve ter definido 3002 ou a variável PORT)
EXPOSE 3002

# Comando para iniciar o seu servidor Node.js (seu script "start")
# Isso executa: node server.js
CMD ["npm", "start"]