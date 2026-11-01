const db = require('./infrastructure/db');
const grpcServer = require('./interfaces/grpcServer');

const { createProduct } = require('./application/productService');
const productRepo = require('./infrastructure/productRepository');

async function seedSamples() {
  if ((await productRepo.list()).length > 0) return;
  for (const p of [
    { pname: 'Laptop', price: 1500, quantity: 10 },
    { pname: 'Mouse', price: 25, quantity: 100 },
    { pname: 'Keyboard', price: 60, quantity: 50 },
  ]) {
    await createProduct(p);
  }
  console.log('[product] seeded sample products');
}

async function main() {
  await db.connect();
  console.log('[product] connected to MongoDB');
    if (process.env.SEED_SAMPLE_PRODUCTS === 'true') await seedSamples();
  const server = await grpcServer.start();

  const shutdown = () => {
    server.tryShutdown(async () => {
      await db.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[product] failed to start:', e);
  process.exit(1);
});