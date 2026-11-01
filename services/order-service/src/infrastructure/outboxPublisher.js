const prisma = require('./prisma');
const producer = require('./eventProducer');
const config = require('../config');

let running = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tick() {
  const batch = await prisma.outboxEvent.findMany({
    where: { publishedAt: null },
    orderBy: { id: 'asc' },
    take: 50,
  });
  for (const ev of batch) {
    await producer.send(ev.topic, ev.eventKey, JSON.stringify(ev.payload));
    await prisma.outboxEvent.update({ where: { id: ev.id }, data: { publishedAt: new Date() } });
    console.log('[order] published', ev.topic, 'key=', ev.eventKey);
  }
}

function start() {
  running = true;
  (async () => {
    while (running) {
      try {
        await tick();
      } catch (e) {
        console.error('[order] outbox publish failed, will retry:', e.message);
      }
      await sleep(config.outboxPollMs);
    }
  })();
}

module.exports = { start, stop: () => { running = false; } };