# 1. Imagem Base
FROM node:20-slim

# 2. Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# 3. Copia apenas os arquivos de dependência
COPY package*.json ./

# 3.5. NOVO PASSO: Instala o Git (necessário para alguns pacotes NPM)
RUN apt-get update && apt-get install -y git

# 4. Instala as dependências (onde o erro SIGTERM ocorre se faltar)
RUN npm install --omit=dev

# 5. Copia o resto do código (seu server.js, services, etc.)
COPY . .

# 6. Expõe a porta que o app vai escutar
EXPOSE 8080

# 7. Comando para iniciar o servidor
CMD [ "npm", "start" ]