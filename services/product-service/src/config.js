require('dotenv').config();

module.exports = {
  grpcPort: process.env.GRPC_PORT || '50053',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27018/product_db',
  protoDir: process.env.PROTO_DIR || require('path').join(__dirname, '..', '..', '..', 'shared', 'proto'),
};