const prisma = require('./infrastructure/prisma');
const producer = require('./infrastructure/eventProducer');
const outbox = require('./infrastructure/outboxPublisher');
const grpcServer = require('./interfaces/grpcServer');

async function main() {
  await prisma.$connect();
  await producer.connect();
  const server = await grpcServer.start();
  outbox.start();

  const shutdown = () => {
    outbox.stop();
    server.tryShutdown(async () => {
      await producer.disconnect();
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[order] failed to start:', e);
  process.exit(1);
});