FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=8787
ENV LUCKYTODO_DATA=/data

VOLUME ["/data"]
EXPOSE 8787

CMD ["node", "src/index.js"]
