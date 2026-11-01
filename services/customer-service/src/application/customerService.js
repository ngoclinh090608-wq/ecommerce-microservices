const repo = require('../infrastructure/customerRepository');
const { invalid, notFound, forbidden } = require('../domain/errors');

const toDto = (c) => ({
  uid: c.uid,
  fullname: c.fullname,
  mid: c.mid,
  mname: c.membership.mname,
  score: c.membership.score,
});

function cleanName(name) {
  const f = (name || '').trim();
  if (f.length < 1 || f.length > 100) throw invalid('fullname must be 1-100 characters');
  return f;
}

async function ensureCustomer(uid, fullname = '') {
  let c = await repo.findByUid(uid);
  if (c) return c;
  const def = await repo.findDefaultMembership();
  if (!def) throw new Error('no membership tiers seeded');
  await repo.createIfAbsent({ uid, fullname: fullname.slice(0, 100), mid: def.mid });
  return repo.findByUid(uid);
}

async function createCustomer({ uid, fullname }) {
  if (!uid || uid < 1) throw invalid('uid is required');
  const c = await ensureCustomer(uid, cleanName(fullname));
  return toDto(c);
}

async function getCustomer({ uid }) {
  if (!uid || uid < 1) throw invalid('uid is required');
  const c = await repo.findByUid(uid);
  if (!c) throw notFound('Customer not found');
  return toDto(c);
}

// Gọi nội bộ (Order Service). Tạo hồ sơ mặc định nếu thiếu.
async function getMembership({ uid }) {
  if (!uid || uid < 1) throw invalid('uid is required');
  const c = await ensureCustomer(uid);
  return { uid: c.uid, mid: c.mid, mname: c.membership.mname, score: c.membership.score };
}

async function updateCustomer({ uid, fullname, mid, requester_uid, requester_role }) {
  if (!uid || uid < 1) throw invalid('uid is required');
  const isAdmin = requester_role === 'admin';
  if (!isAdmin && requester_uid !== uid) throw forbidden('You can only update your own profile');

  const current = await repo.findByUid(uid);
  if (!current) throw notFound('Customer not found');

  const data = {};
  if (fullname) data.fullname = cleanName(fullname);
  if (mid && mid !== current.mid) {
    if (!isAdmin) throw forbidden('Only admin can change membership');
    if (!(await repo.findMembershipByMid(mid))) throw invalid('Membership does not exist');
    data.mid = mid;
  }
  if (Object.keys(data).length === 0) throw invalid('Nothing to update');

  await repo.update(uid, data);
  return { uid, message: 'Customer updated successfully' };
}

async function handleUserRegistered(event) {
  if (!event || !Number.isInteger(event.uid) || event.uid < 1) {
    throw invalid('user-registered event is missing a valid uid');
  }
  await ensureCustomer(event.uid, event.fullname || event.username || '');
}

module.exports = { createCustomer, getCustomer, getMembership, updateCustomer, handleUserRegistered };