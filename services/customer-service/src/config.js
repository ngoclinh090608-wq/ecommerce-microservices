require('dotenv').config();

module.exports = {
  grpcPort: process.env.GRPC_PORT || '50052',
  kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
  kafkaGroupId: process.env.KAFKA_GROUP_ID || 'customer-service',
  protoDir: process.env.PROTO_DIR || require('path').join(__dirname, '..', '..', '..', 'shared', 'proto'),
};