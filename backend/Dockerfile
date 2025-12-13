# 1. Imagem base do Node.js
FROM node:20-slim

# 2. Define o diretório de trabalho
WORKDIR /app

# 3. Copia package.json e package-lock.json (Para instalar dependências)
COPY package*.json ./

# 4. Instala as dependências (onde o erro SIGTERM ocorre se faltar)
RUN npm install --omit=dev

# 5. Copia o resto do código (seu server.js)
COPY . .

# 6. EXPÕE A PORTA (Atenção: A porta deve ser a que o Node.js está usando)
EXPOSE 3002

# 7. Comando para rodar a aplicação
CMD ["node", "server.js"]