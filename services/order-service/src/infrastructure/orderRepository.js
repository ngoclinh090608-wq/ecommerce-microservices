const { randomUUID } = require('crypto');
const prisma = require('./prisma');

const withDetails = { details: { orderBy: { pid: 'asc' } } };

// Order + OrderDetail + OutboxEvent trong CÙNG MỘT transaction
async function createWithOutbox({ uid, discount, lines }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        uid,
        discount,
        details: {
          create: lines.map((l) => ({ pid: l.pid, qty: l.qty, unitPrice: l.unit_price })),
        },
      },
      include: withDetails,
    });
    const eventId = randomUUID();
    await tx.outboxEvent.create({
      data: {
        eventId,
        topic: 'order-created',
        eventKey: String(order.oid),
        payload: { eventId, oid: order.oid, uid, occurredAt: new Date().toISOString() },
      },
    });
    return order;
  });
}

module.exports = {
  createWithOutbox,
  findById: (oid) => prisma.order.findUnique({ where: { oid }, include: withDetails }),
  listByUid: (uid) =>
    prisma.order.findMany({ where: { uid }, orderBy: { oid: 'desc' }, take: 100, include: withDetails }),
  listAll: () => prisma.order.findMany({ orderBy: { oid: 'desc' }, take: 100, include: withDetails }),
};