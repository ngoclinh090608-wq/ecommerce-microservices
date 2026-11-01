# Kafka events

## user-registered  (producer: auth-service, consumer: customer-service)
{ "eventId": "uuid", "uid": 1, "username": "john", "fullname": "john", "occurredAt": "ISO-8601" }

## order-created  (producer: order-service via Outbox, consumer: shipment-service)
{ "eventId": "uuid", "oid": 1001, "uid": 1, "occurredAt": "ISO-8601" }

Rules: consumers must be idempotent (dedupe by eventId or oid); key = uid / oid.
