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
  failedPrecondition: (m) => new AppError(grpc.status.FAILED_PRECONDITION, m),
};