const { Kafka } = require('kafkajs');
const config = require('../config');
const { AppError } = require('../domain/errors');
const repo = require('./shipmentRepository');

const kafka = new Kafka({
  clientId: 'shipment-service',
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
    console.error('[shipment] consumer crashed:', payload.error.message, 'restart=', payload.restart);
    if (!payload.restart) process.exit(1);
  });
  return c;
}

// Ghi nhận sự kiện lỗi rồi bỏ qua (không chặn hàng đợi)
async function reject(reason, { topic, partition, message }) {
  console.error(`[shipment] invalid event skipped (${reason}) at ${topic}[${partition}]@${message.offset}`);
  await repo.recordInvalidEvent({
    reason,
    raw: String(message.value || '').slice(0, 2000),
    topic,
    partition,
    offset: message.offset,
  });
}

async function start(handler) {
  for (let attempt = 1; ; attempt++) {
    consumer = newConsumer();
    try {
      await consumer.connect();
      await consumer.subscribe({ topic: 'order-created', fromBeginning: true });
      await consumer.run({
        eachMessage: async (ctx) => {
          let event;
          try {
            event = JSON.parse(ctx.message.value.toString());
          } catch {
            return reject('malformed JSON', ctx);
          }
          try {
            const r = await handler(event);
            console.log(
              r.created
                ? `[shipment] created shipid=${r.shipment.shipid} for oid=${event.oid}`
                : `[shipment] duplicate event for oid=${event.oid} ignored`
            );
          } catch (e) {
            if (e instanceof AppError) return reject(e.message, ctx);
            throw e; // lỗi hạ tầng: để kafkajs thử lại, không mất sự kiện
          }
        },
      });
      return;
    } catch (e) {
      await consumer.disconnect().catch(() => {});
      if (attempt >= MAX_ATTEMPTS) throw e;
      console.error(`[shipment] Kafka not ready (attempt ${attempt}/${MAX_ATTEMPTS}): ${e.message}`);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

async function stop() {
  if (consumer) await consumer.disconnect();
}

module.exports = { start, stop };