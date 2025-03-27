FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install


COPY . .

# Crear directorio de almacenamiento
RUN mkdir -p src/storage

EXPOSE 3002

CMD ["node", "src/server.js"]