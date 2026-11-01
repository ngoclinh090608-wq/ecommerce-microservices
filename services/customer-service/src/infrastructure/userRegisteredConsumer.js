const { Kafka } = require('kafkajs');
const config = require('../config');
const { AppError } = require('../domain/errors');

const kafka = new Kafka({
  clientId: 'customer-service',
  brokers: config.kafkaBrokers,
  retry: { initialRetryTime: 300, maxRetryTime: 5000, retries: 20 },
});

const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let consumer = null;

function newConsumer() {
  const c = kafka.consumer({ groupId: config.kafkaGroupId });
  c.on(c.events.CRASH, ({ payload }) => {
    console.error('[customer] consumer crashed:', payload.error.message, 'restart=', payload.restart);
    if (!payload.restart) process.exit(1);
  });
  return c;
}

async function start(handler) {
  for (let attempt = 1; ; attempt++) {
    consumer = newConsumer();
    try {
      await consumer.connect();
      await consumer.subscribe({ topic: 'user-registered', fromBeginning: true });
      await consumer.run({
        eachMessage: async ({ message }) => {
          let event;
          try {
            event = JSON.parse(message.value.toString());
          } catch {
            console.error('[customer] skipping malformed message at offset', message.offset);
            return;
          }
          try {
            await handler(event);
            console.log('[customer] processed user-registered uid=', event.uid);
          } catch (e) {
            if (e instanceof AppError) {
              console.error('[customer] skipping invalid event:', e.message);
              return;
            }
            throw e; // infrastructure error: let kafkajs retry, never drop the event
          }
        },
      });
      return;
    } catch (e) {
      await consumer.disconnect().catch(() => {});
      if (attempt >= MAX_ATTEMPTS) throw e;
      console.error(`[customer] Kafka not ready (attempt ${attempt}/${MAX_ATTEMPTS}): ${e.message}`);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

async function stop() {
  if (consumer) await consumer.disconnect();
}

module.exports = { start, stop };
