FROM node:20-alpine

WORKDIR /app

COPY api/package.json ./
RUN npm install

COPY api/ ./

EXPOSE 3001

CMD ["npm", "run", "dev"]
