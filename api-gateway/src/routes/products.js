const router = require('express').Router();
const { rpc } = require('../clients/grpcClients');
const cache = require('../lib/cache');
const config = require('../config');
const authorize = require('../middlewares/authorize');
const wrap = require('../lib/wrap');
const v = require('../lib/validate');

const LIST_KEY = 'cache:products';
const oneKey = (pid) => `cache:product:${pid}`;
const pub = (p) => ({ pid: p.pid, pname: p.pname, price: p.price, quantity: p.quantity });

router.get('/', wrap(async (req, res) => {
  const hit = await cache.getJson(LIST_KEY);
  if (hit) return res.set('X-Cache', 'HIT').json(hit);
  const r = await rpc('product', 'ListProducts', {});
  const out = { items: r.items.map(pub) };
  await cache.setJson(LIST_KEY, out, config.cacheTtlSeconds);
  res.set('X-Cache', 'MISS').json(out);
}));

router.get('/:pid', wrap(async (req, res) => {
  const pid = v.intParam(req.params.pid, 'pid');
  const hit = await cache.getJson(oneKey(pid));
  if (hit) return res.set('X-Cache', 'HIT').json(hit);
  const out = pub(await rpc('product', 'GetProduct', { pid }));
  await cache.setJson(oneKey(pid), out, config.cacheTtlSeconds);
  res.set('X-Cache', 'MISS').json(out);
}));

router.post('/', authorize('admin'), wrap(async (req, res) => {
  const b = v.body(req);
  const p = await rpc('product', 'CreateProduct', {
    pname: v.productName(b.pname),
    price: v.price(b.price),
    quantity: v.quantity(b.quantity),
  });
  await cache.del(LIST_KEY);
  res.status(201).json(pub(p));
}));

router.put('/:pid', authorize('admin'), wrap(async (req, res) => {
  const pid = v.intParam(req.params.pid, 'pid');
  const b = v.body(req);
  const msg = { pid, update_mask: [] };
  if (b.pname !== undefined) { msg.pname = v.productName(b.pname); msg.update_mask.push('pname'); }
  if (b.price !== undefined) { msg.price = v.price(b.price); msg.update_mask.push('price'); }
  if (b.quantity !== undefined) { msg.quantity = v.quantity(b.quantity); msg.update_mask.push('quantity'); }
  if (msg.update_mask.length === 0) throw v.bad('Provide at least one of pname, price, quantity');
  const r = await rpc('product', 'UpdateProduct', msg);
  await cache.del(LIST_KEY, oneKey(pid));
  res.json({ message: r.message, pid: r.pid });
}));

router.delete('/:pid', authorize('admin'), wrap(async (req, res) => {
  const pid = v.intParam(req.params.pid, 'pid');
  const r = await rpc('product', 'DeleteProduct', { pid });
  await cache.del(LIST_KEY, oneKey(pid));
  res.json({ message: r.message, pid: r.pid });
}));

module.exports = router;