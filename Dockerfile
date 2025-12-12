# Usar Node 18
FROM node:18-alpine

# Diretório de trabalho
WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar todo o código
COPY . .

# Build do frontend (Vite)
RUN npm run build

# Expor a porta
EXPOSE 3002

# Comando para rodar o servidor
CMD ["node", "server.js"]
```

---

## 📝 ARQUIVO 4: CRIAR `.dockerignore`

**CRIE um arquivo novo chamado `.dockerignore` (com o ponto na frente) na raiz do projeto:**
```
node_modules
.git
.env
.env.local
dist
*.log
README.md
.gitignore
```

---

## 📝 ARQUIVO 5: VERIFICAR/ATUALIZAR `.gitignore`

**ABRA seu arquivo `.gitignore` e CERTIFIQUE-SE de que contém estas linhas:**
```
# Dependências
node_modules

# Arquivos de ambiente (NUNCA SUBIR PRO GITHUB!)
.env
.env.local
.env.production

# Build
dist
dist-ssr

# Logs
*.log

# Outros
.DS_Store