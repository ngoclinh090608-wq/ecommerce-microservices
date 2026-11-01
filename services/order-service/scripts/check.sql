SELECT o.oid, o.uid, o.discount, d.pid, d.qty, d.unit_price
FROM "Order" o JOIN "OrderDetail" d USING (oid)
ORDER BY o.oid DESC, d.pid LIMIT 12;

SELECT id, "eventId", topic, "eventKey", ("publishedAt" IS NOT NULL) AS published
FROM "OutboxEvent" ORDER BY id DESC LIMIT 12;