const { client } = require('./redis');

// Mọi lỗi Redis đều bị nuốt: cache hỏng không được làm hỏng request
async function getJson(key) {
  try {
    const v = await client.sendCommand(['GET', key]);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

async function setJson(key, value, ttlSeconds) {
  try {
    await client.sendCommand(['SET', key, JSON.stringify(value), 'EX', String(ttlSeconds)]);
  } catch {
    /* bỏ qua */
  }
}

async function del(...keys) {
  try {
    if (keys.length) await client.sendCommand(['DEL', ...keys]);
  } catch {
    /* bỏ qua */
  }
}

module.exports = { getJson, setJson, del };