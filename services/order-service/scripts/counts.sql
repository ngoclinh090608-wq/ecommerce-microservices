SELECT (SELECT count(*) FROM "Order") AS orders,
       (SELECT count(*) FROM "OutboxEvent" WHERE "publishedAt" IS NULL) AS unpublished;