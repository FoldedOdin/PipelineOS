FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache git openssh-client
COPY runner/package.json runner/package-lock.json ./
RUN npm ci

COPY runner/ ./

CMD ["npm", "run", "dev"]
