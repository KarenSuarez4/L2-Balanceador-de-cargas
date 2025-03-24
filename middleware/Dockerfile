FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Crear directorio para archivos temporales
RUN mkdir -p uploads

EXPOSE 3001

CMD ["node", "src/server.js"]