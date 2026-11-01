require('dotenv').config();
const path = require('path');

function required(name) {
  if (!process.env[name]) throw new Error(`${name} is required`);
  return process.env[name];
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: required('JWT_SECRET'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  corsOrigin: process.env.CORS_ORIGIN || false,
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 15),
  rateLimit: {
    windowMs: 60 * 1000,
    globalMax: Number(process.env.RATE_LIMIT_MAX || 200),
    authMax: Number(process.env.RATE_LIMIT_AUTH_MAX || 10),
  },
  grpc: {
    auth: process.env.AUTH_GRPC_ADDR || 'localhost:50051',
    customer: process.env.CUSTOMER_GRPC_ADDR || 'localhost:50052',
    product: process.env.PRODUCT_GRPC_ADDR || 'localhost:50053',
    order: process.env.ORDER_GRPC_ADDR || 'localhost:50054',
    shipment: process.env.SHIPMENT_GRPC_ADDR || 'localhost:50055',
  },
  protoDir: process.env.PROTO_DIR || path.join(__dirname, '..', '..', 'shared', 'proto'),
};