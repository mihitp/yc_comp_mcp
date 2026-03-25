FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/db/package*.json ./packages/db/
COPY packages/scraper/package*.json ./packages/scraper/

RUN npm ci

COPY . .

RUN npx turbo build

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
