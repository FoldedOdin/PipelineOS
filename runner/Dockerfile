FROM node:24-alpine

WORKDIR /app

COPY runner/package.json runner/package-lock.json ./
RUN npm ci

COPY runner/ ./

CMD ["npm", "run", "dev"]
