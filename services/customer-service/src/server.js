const prisma = require('./infrastructure/prisma');
const consumer = require('./infrastructure/userRegisteredConsumer');
const { bootstrap } = require('./application/bootstrap');
const { handleUserRegistered } = require('./application/customerService');
const grpcServer = require('./interfaces/grpcServer');

async function main() {
  await bootstrap();
  const server = await grpcServer.start();
  await consumer.start(handleUserRegistered);

  const shutdown = () => {
    server.tryShutdown(async () => {
      await consumer.stop();
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[customer] failed to start:', e);
  process.exit(1);
});