const http = require('http');
const { HttpError } = require('../lib/errors');

module.exports = (err, req, res, next) => {
  let status = 500;
  let message = 'Internal server error';

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  } else {
    console.error(`[gateway] unhandled error (request ${req.id}):`, err);
  }

  if (res.headersSent) return next(err);
  res.status(status).json({ status, error: http.STATUS_CODES[status] || 'Error', message });
};