const grpc = require('@grpc/grpc-js');

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

module.exports = {
  AppError,
  invalid: (m) => new AppError(grpc.status.INVALID_ARGUMENT, m),
  notFound: (m) => new AppError(grpc.status.NOT_FOUND, m),
  forbidden: (m) => new AppError(grpc.status.PERMISSION_DENIED, m),
};