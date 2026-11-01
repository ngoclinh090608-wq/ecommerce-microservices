const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const requestLogger = require('./middlewares/requestLogger');
const { createGlobalLimiter, createAuthLimiter } = require('./middlewares/rateLimit');
const authenticate = require('./middlewares/authenticate');
const errorHandler = require('./middlewares/errorHandler');
const { HttpError } = require('./lib/errors');

function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(requestLogger);
  app.use('/api', createGlobalLimiter());
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', require('./routes/health'));
  app.use('/api/auth', createAuthLimiter(), require('./routes/auth'));
  app.use('/api/customers', authenticate, require('./routes/customers'));
  app.use('/api/products', authenticate, require('./routes/products'));
  app.use('/api/orders', authenticate, require('./routes/orders'));
  app.use('/api/shipments', authenticate, require('./routes/shipments'));

  app.use((req, res, next) => next(new HttpError(404, 'Route not found')));
  app.use(errorHandler);
  return app;
}

module.exports = { buildApp };