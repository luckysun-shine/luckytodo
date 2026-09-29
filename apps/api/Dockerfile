FROM node:22-bookworm-slim

WORKDIR /app

# API
COPY apps/api/package.json ./apps/api/
COPY apps/api/src ./apps/api/src

# Web (App + /admin.html 轻量管理页)
COPY apps/web ./apps/web

ENV NODE_ENV=production
ENV PORT=8787
ENV LUCKYTODO_DATA=/data
ENV LUCKYTODO_WEB=/app/apps/web

VOLUME ["/data"]
EXPOSE 8787

WORKDIR /app/apps/api
CMD ["node", "src/index.js"]
