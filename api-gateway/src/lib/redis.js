const { createClient } = require('redis');
const config = require('../config');

const client = createClient({
  url: config.redisUrl,
  disableOfflineQueue: true, // Redis chết thì lệnh lỗi ngay, không treo request
  socket: { reconnectStrategy: (retries) => Math.min(retries * 200, 3000) },
});
client.on('error', (e) => console.error('[gateway] redis error:', e.message));

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const connect = (ms = 5000) => withTimeout(client.connect(), ms, 'Redis connection timeout');

async function ping(ms = 1000) {
  try {
    return (await withTimeout(client.sendCommand(['PING']), ms, 'timeout')) === 'PONG';
  } catch {
    return false;
  }
}

module.exports = { client, connect, ping };