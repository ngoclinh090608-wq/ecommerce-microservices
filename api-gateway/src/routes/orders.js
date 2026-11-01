const router = require('express').Router();
const { rpc } = require('../clients/grpcClients');
const { HttpError } = require('../lib/errors');
const cache = require('../lib/cache');
const wrap = require('../lib/wrap');
const v = require('../lib/validate');

const MAX_LINES = 50;

router.post('/', wrap(async (req, res) => {
  const b = v.body(req);
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > MAX_LINES) {
    throw v.bad(`items must be an array of 1-${MAX_LINES} entries`);
  }
  const items = b.items.map((it, i) => {
    if (!it || typeof it !== 'object') throw v.bad(`items[${i}] must be an object`);
    return { pid: v.posInt(it.pid, `items[${i}].pid`), qty: v.posInt(it.qty, `items[${i}].qty`) };
  });

  const o = await rpc('order', 'CreateOrder', { uid: req.user.uid, items }, 15000);

  // Tồn kho đã đổi: xóa cache để số liệu hiển thị không cũ
  await cache.del('cache:products', ...items.map((it) => `cache:product:${it.pid}`));

  res.status(201).json({
    oid: o.oid,
    uid: o.uid,
    discount: o.discount,
    total_amount: o.total_amount,
    items: o.items,
    shipment: { status: o.shipment_status || 'PENDING' },
  });
}));

router.get('/', wrap(async (req, res) => {
  const r = await rpc('order', 'ListOrders', {
    requester_uid: req.user.uid,
    requester_role: req.user.role,
  });
  res.json({
    items: r.items.map((o) => ({ oid: o.oid, uid: o.uid, discount: o.discount, total_amount: o.total_amount })),
  });
}));

router.get('/:oid', wrap(async (req, res) => {
  const oid = v.intParam(req.params.oid, 'oid');
  const o = await rpc('order', 'GetOrder', {
    oid,
    requester_uid: req.user.uid,
    requester_role: req.user.role,
  });

  let shipment = null;
  try {
    const s = await rpc('shipment', 'GetShipmentByOrder', { oid });
    shipment = { shipid: s.shipid, status: s.status };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) shipment = { status: 'PENDING' }; // chưa kịp tạo
    else console.error(`[gateway] could not load shipment for order ${oid}:`, e.message);
  }

  res.json({
    oid: o.oid, uid: o.uid, discount: o.discount,
    total_amount: o.total_amount, items: o.items, shipment,
  });
}));

module.exports = router;