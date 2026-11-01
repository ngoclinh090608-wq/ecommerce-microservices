const jwt = require('jsonwebtoken');
const config = require('../config');
const { HttpError } = require('../lib/errors');

module.exports = function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Missing or invalid Authorization header'));
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const uid = Number(payload.sub);
    if (!Number.isInteger(uid) || uid < 1 || typeof payload.role !== 'string') throw new Error('bad claims');
    req.user = { uid, role: payload.role };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
};