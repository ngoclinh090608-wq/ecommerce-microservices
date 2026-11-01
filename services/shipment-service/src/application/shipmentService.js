const repo = require('../infrastructure/shipmentRepository');
const { invalid, notFound, failedPrecondition } = require('../domain/errors');
const { STATUSES, isValidStatus, canTransition } = require('../domain/statusPolicy');

function requireId(value, name) {
  if (!Number.isInteger(value) || value < 1) throw invalid(`invalid ${name}`);
}

async function getShipment({ shipid }) {
  requireId(shipid, 'shipid');
  const s = await repo.findById(shipid);
  if (!s) throw notFound('Shipment not found');
  return s;
}

async function getShipmentByOrder({ oid }) {
  requireId(oid, 'oid');
  const s = await repo.findByOid(oid);
  if (!s) throw notFound('Shipment not found');
  return s;
}

async function updateShipmentStatus({ shipid, status }) {
  requireId(shipid, 'shipid');
  if (!isValidStatus(status)) throw invalid(`status must be one of: ${STATUSES.join(', ')}`);

  const current = await repo.findById(shipid);
  if (!current) throw notFound('Shipment not found');
  if (current.status === status) return current;
  if (!canTransition(current.status, status)) {
    throw failedPrecondition(`Cannot change status from ${current.status} to ${status}`);
  }
  const updated = await repo.updateStatusIf(shipid, current.status, status);
  if (!updated) throw failedPrecondition('Shipment was modified concurrently, please retry');
  return updated;
}

// Xử lý sự kiện order-created; ném AppError nếu sự kiện không hợp lệ
async function handleOrderCreated(event) {
  if (!event || typeof event !== 'object') throw invalid('event must be a JSON object');
  if (!Number.isInteger(event.oid) || event.oid < 1) throw invalid('order-created event is missing a valid oid');
  return repo.createForOrder(event.oid);
}

module.exports = { getShipment, getShipmentByOrder, updateShipmentStatus, handleOrderCreated };