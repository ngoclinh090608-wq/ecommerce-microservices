FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/service
COPY services/order-service/package.json services/order-service/package-lock.json ./
RUN npm ci
COPY services/order-service/prisma ./prisma
RUN npx prisma generate
COPY services/order-service/src ./src
COPY shared/proto /app/shared/proto
RUN chown -R node:node /app
ENV NODE_ENV=production PROTO_DIR=/app/shared/proto DOTENV_CONFIG_QUIET=true
USER node
EXPOSE 50054
CMD ["sh", "-c", "npx prisma migrate deploy && exec node src/server.js"]
