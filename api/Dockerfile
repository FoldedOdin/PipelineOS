FROM node:24-alpine

WORKDIR /app

COPY api/package.json api/package-lock.json ./
RUN npm ci

COPY api/ ./

EXPOSE 3001

CMD ["npm", "run", "dev"]
