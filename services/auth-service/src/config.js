require('dotenv').config();

const config = {
  grpcPort: process.env.GRPC_PORT || '50051',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: Number(process.env.JWT_EXPIRES_IN || 3600),
  kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
  protoDir: process.env.PROTO_DIR || require('path').join(__dirname, '..', '..', '..', 'shared', 'proto'),
  admin: {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    email: process.env.ADMIN_EMAIL,
  },

staff: {
  username: process.env.STAFF_USERNAME,
  password: process.env.STAFF_PASSWORD,
  email: process.env.STAFF_EMAIL,
},

};

if (!config.jwtSecret) throw new Error('JWT_SECRET is required');

module.exports = config;