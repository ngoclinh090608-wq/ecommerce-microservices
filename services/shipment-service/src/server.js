const db = require('./infrastructure/db');
const consumer = require('./infrastructure/orderCreatedConsumer');
const { handleOrderCreated } = require('./application/shipmentService');
const grpcServer = require('./interfaces/grpcServer');

async function main() {
  await db.connect();
  console.log('[shipment] connected to MongoDB');
  const server = await grpcServer.start();
  await consumer.start(handleOrderCreated);

  const shutdown = () => {
    server.tryShutdown(async () => {
      await consumer.stop();
      await db.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[shipment] failed to start:', e);
  process.exit(1);
});