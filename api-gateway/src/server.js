const config = require('./config');
const redis = require('./lib/redis');
const { buildApp } = require('./app');

async function main() {
  await redis.connect(5000);
  const app = buildApp();
  const server = app.listen(config.port, () => console.log(`[gateway] listening on :${config.port}`));

  const shutdown = () => {
    server.close(async () => {
      await redis.client.quit().catch(() => {});
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[gateway] failed to start:', e);
  process.exit(1);
});