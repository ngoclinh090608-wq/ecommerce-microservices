FROM node:24-bookworm-slim
WORKDIR /app/service
COPY api-gateway/package.json api-gateway/package-lock.json ./
RUN npm ci --omit=dev
COPY api-gateway/src ./src
COPY shared/proto /app/shared/proto
RUN chown -R node:node /app
ENV NODE_ENV=production PROTO_DIR=/app/shared/proto DOTENV_CONFIG_QUIET=true
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
