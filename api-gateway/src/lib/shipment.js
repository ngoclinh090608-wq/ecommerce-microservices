const { rpc } = require('../clients/grpcClients');
const { HttpError } = require('./errors');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Bounded best effort: Kafka delivery is asynchronous and may outlive the request.
async function waitForShipment(oid, { timeoutMs = 2500, pollMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const remaining = deadline - Date.now();
      // rpc has a channel-ready phase and a request phase; bound both together.
      const s = await rpc('shipment', 'GetShipmentByOrder', { oid }, Math.max(1, Math.min(250, Math.floor(remaining / 2))));
      return { shipid: s.shipid, status: s.status };
    } catch (e) {
      if (!(e instanceof HttpError) || e.status !== 404) {
        console.error(`[gateway] shipment lookup deferred for order ${oid}:`, e.message);
        return null;
      }
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await sleep(Math.min(pollMs, remaining));
  }
  return null;
}

module.exports = { waitForShipment };
