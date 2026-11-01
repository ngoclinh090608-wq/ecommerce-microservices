const config = require('./config');
const events = require('./infrastructure/eventPublisher');
const prisma = require('./infrastructure/prisma');
const { bootstrap } = require('./application/bootstrap');
const grpcServer = require('./interfaces/grpcServer');

async function main() {
  await bootstrap();
  await events.connect();
  const server = await grpcServer.start();

  const shutdown = async () => {
    server.tryShutdown(async () => {
      await events.disconnect();
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[auth] failed to start:', e);
  process.exit(1);
});