FROM node:20-alpine

WORKDIR /app

COPY runner/package.json ./
RUN npm install

COPY runner/ ./

CMD ["npm", "run", "dev"]
