FROM node:24-bookworm-slim
WORKDIR /app/service
COPY services/product-service/package.json services/product-service/package-lock.json ./
RUN npm ci --omit=dev
COPY services/product-service/src ./src
COPY shared/proto /app/shared/proto
RUN chown -R node:node /app
ENV NODE_ENV=production PROTO_DIR=/app/shared/proto DOTENV_CONFIG_QUIET=true
USER node
EXPOSE 50053
CMD ["node", "src/server.js"]
