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
  unauthenticated: (m) => new AppError(grpc.status.UNAUTHENTICATED, m),
  conflict: (m) => new AppError(grpc.status.ALREADY_EXISTS, m),
};