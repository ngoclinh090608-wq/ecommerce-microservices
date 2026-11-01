const { randomUUID } = require('crypto');
const morgan = require('morgan');

morgan.token('id', (req) => req.id);
morgan.token('user', (req) => (req.user ? `${req.user.uid}:${req.user.role}` : '-'));

function assignId(req, res, next) {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

// Không ghi Authorization và body (có mật khẩu)
module.exports = [assignId, morgan(':id :remote-addr :method :url :status :response-time ms user=:user')];