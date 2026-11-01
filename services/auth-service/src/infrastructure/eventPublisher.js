const { Kafka, Partitioners } = require('kafkajs');
const { randomUUID } = require('crypto');
const config = require('../config');

const kafka = new Kafka({
  clientId: 'auth-service',
  brokers: config.kafkaBrokers,
  retry: { initialRetryTime: 300, maxRetryTime: 5000, retries: 20 },
});
const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });

async function connect() {
  await producer.connect();
}

async function publishUserRegistered({ uid, username }) {
  const event = {
    eventId: randomUUID(),
    uid,
    username,
    fullname: username,
    occurredAt: new Date().toISOString(),
  };
  await producer.send({
    topic: 'user-registered',
    messages: [{ key: String(uid), value: JSON.stringify(event) }],
  });
}

async function disconnect() {
  await producer.disconnect();
}

module.exports = { connect, publishUserRegistered, disconnect };