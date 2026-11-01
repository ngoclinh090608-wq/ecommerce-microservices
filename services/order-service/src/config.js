require('dotenv').config();

module.exports = {
  grpcPort: process.env.GRPC_PORT || '50054',
  kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
  customerAddr: process.env.CUSTOMER_GRPC_ADDR || 'localhost:50052',
  productAddr: process.env.PRODUCT_GRPC_ADDR || 'localhost:50053',
  outboxPollMs: Number(process.env.OUTBOX_POLL_MS || 1000),
  protoDir: process.env.PROTO_DIR || require('path').join(__dirname, '..', '..', '..', 'shared', 'proto'),
};