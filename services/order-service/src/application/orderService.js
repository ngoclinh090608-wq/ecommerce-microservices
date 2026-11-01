const repo = require('../infrastructure/orderRepository');
const clients = require('../infrastructure/grpcClients');
const { invalid, notFound, forbidden } = require('../domain/errors');
const { normalizeItems } = require('../domain/orderValidation');
const { discountPercent } = require('../domain/discountPolicy');
const { computeTotals } = require('../domain/money');

function toDto(order, shipmentStatus = '') {
  const items = order.details.map((d) => ({ pid: d.pid, qty: d.qty, unit_price: Number(d.unitPrice) }));
  const discount = Number(order.discount);
  return {
    oid: order.oid,
    uid: order.uid,
    discount,
    total_amount: computeTotals(items, discount).total_amount,
    items,
    shipment_status: shipmentStatus,
  };
}

async function createOrder({ uid, items }) {
  if (!Number.isInteger(uid) || uid < 1) throw invalid('uid is required');
  const wanted = normalizeItems(items);

  const membership = await clients.getMembership(uid);
  const discount = discountPercent(membership.score);

  const reserved = (await clients.reserveStock(wanted)).items;

  let order;
  try {
    order = await repo.createWithOutbox({ uid, discount, lines: reserved });
  } catch (e) {
    // Bù trừ: trả lại kho đã trừ vì đơn không lưu được
    try {
      await clients.releaseStock(reserved.map(({ pid, qty }) => ({ pid, qty })));
    } catch (err) {
      console.error('[order] FAILED to release stock after DB error:', JSON.stringify(reserved), err.message);
    }
    throw e;
  }
  return toDto(order, 'PENDING');
}

async function getOrder({ oid, requester_uid, requester_role }) {
  if (!Number.isInteger(oid) || oid < 1) throw invalid('invalid oid');
  const order = await repo.findById(oid);
  if (!order) throw notFound('Order not found');
  if (requester_role !== 'admin' && order.uid !== requester_uid) throw forbidden('Access denied');
  return toDto(order);
}

async function listOrders({ requester_uid, requester_role }) {
  const orders = requester_role === 'admin' ? await repo.listAll() : await repo.listByUid(requester_uid);
  return { items: orders.map((o) => toDto(o)) };
}

module.exports = { createOrder, getOrder, listOrders };