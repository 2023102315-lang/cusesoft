FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN node scripts/make-assets.mjs

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "--env-file-if-exists=.env", "server/index.js"]
