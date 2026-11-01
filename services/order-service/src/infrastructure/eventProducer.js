const { Kafka, Partitioners } = require('kafkajs');
const config = require('../config');

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: config.kafkaBrokers,
  retry: { initialRetryTime: 300, maxRetryTime: 5000, retries: 20 },
});
const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });

module.exports = {
  connect: () => producer.connect(),
  disconnect: () => producer.disconnect(),
  send: (topic, key, value) => producer.send({ topic, messages: [{ key, value }] }),
};