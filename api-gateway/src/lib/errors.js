const grpc = require('@grpc/grpc-js');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const HTTP_BY_GRPC = {
  [grpc.status.INVALID_ARGUMENT]: 400,
  [grpc.status.UNAUTHENTICATED]: 401,
  [grpc.status.PERMISSION_DENIED]: 403,
  [grpc.status.NOT_FOUND]: 404,
  [grpc.status.ALREADY_EXISTS]: 409,
  [grpc.status.FAILED_PRECONDITION]: 409,
  [grpc.status.UNAVAILABLE]: 503,
  [grpc.status.DEADLINE_EXCEEDED]: 503,
};

function fromGrpc(err) {
  const status = HTTP_BY_GRPC[err.code] || 500;
  if (status === 500) {
    console.error('[gateway] upstream error:', err.code, err.details || err.message);
    return new HttpError(500, 'Internal server error');
  }
  if (status === 503) return new HttpError(503, 'Service temporarily unavailable');
  return new HttpError(status, err.details || err.message);
}

module.exports = { HttpError, fromGrpc };