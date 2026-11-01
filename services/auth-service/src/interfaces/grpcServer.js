const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const config = require('../config');
const auth = require('../application/authService');
const { AppError } = require('../domain/errors');

const def = protoLoader.loadSync(path.join(config.protoDir, 'auth.proto'), {
  keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true,
});
const proto = grpc.loadPackageDefinition(def).ecommerce.auth;

function wrap(fn) {
  return async (call, callback) => {
    try {
      callback(null, await fn(call.request));
    } catch (e) {
      if (e instanceof AppError) return callback({ code: e.code, message: e.message });
      console.error('[auth] unexpected error:', e);
      callback({ code: grpc.status.INTERNAL, message: 'Internal error' });
    }
  };
}

function start() {
  const server = new grpc.Server();
  server.addService(proto.AuthService.service, {
    Register: wrap(auth.register),
    Login: wrap(auth.login),
    VerifyToken: wrap(async (req) => auth.verifyToken(req)),
  });
  return new Promise((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${config.grpcPort}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return reject(err);
      console.log(`[auth] gRPC server listening on :${config.grpcPort}`);
      resolve(server);
    });
  });
}

module.exports = { start };