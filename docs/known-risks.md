# Known risks

## Prisma CLI: deepmerge-ts (GHSA-ggr8-5vv4-36mx), severity high
- Affects: auth-service, customer-service, order-service (Prisma 6.19.3)
- Scope: Prisma CLI config loading (build time), not request handling
- Decision: keep Prisma 6; upgrading to Prisma 7 is a breaking change
- Mitigation (decided in Step 9): the CLI stays in the image (prisma is a dependency of @prisma/client) and migrations run at container start
  (prisma migrate deploy). Containers run as the non-root user "node". The advisory concerns CLI config loading, not request handling.
- Review: re-run npm audit before final submission

## Auth: dual write (DB then Kafka)
- Affects: auth-service Register
- Risk: user row is saved, then user-registered is published; not one transaction.
  If Kafka fails, the user exists but has no Customer profile, so ordering fails later.
- Status: open; mitigation planned in Step 4 (Customer Service creates a default profile on demand)

## kafkajs TimeoutNegativeWarning (Node v24.19.0)
- Source: kafkajs RequestQueue.scheduleCheckPendingRequests (inside the library)
- Impact: low; Node clamps the timeout to 1 ms and the service keeps working
- Status: accepted; re-check if Kafka connectivity problems appear


## Product: stock operations
- MongoDB runs standalone (no replica set), so reserving several products is not a transaction.
  ReserveStock rolls back manually; if the rollback itself fails, stock stays reduced (logged).
- ReleaseStock is not idempotent: calling it twice adds stock twice.
  Order Service must call it at most once per failed order.

## Local infrastructure has no authentication
- MongoDB, Redis and Kafka run without authentication and their ports are published to the host.
- Acceptable for local development only; must not be exposed beyond the developer machine.
- Since Step 9 the default docker-compose.yml publishes only the gateway port (3000); databases, Redis, Kafka and the gRPC ports are
  reachable only inside the Docker network. docker-compose.dev-ports.yml publishes them for local testing only.

## Order: stock reservation is not durable
- Stock is reduced in Product Service before the order row is committed.
  If Order Service crashes between those two steps, the stock stays reduced with no order.
- Mitigation for production: reservations with an expiry, or a persistent saga state.

## Order: outbox delivery is at-least-once
- A crash after Kafka accepted the event but before publishedAt is set re-sends the event.
- Consumers (Shipment Service) must deduplicate by eventId or oid.
- The publisher assumes a single Order Service instance; several instances would need SELECT ... FOR UPDATE SKIP LOCKED.


## Gateway: JWT
- HS256 with a secret shared by Auth Service and Gateway; there is no logout or revocation, a token stays valid until it expires (1 hour).

## Gateway: Redis failure mode
- Rate limiting and caching fail open: while Redis is down brute-force protection is off.

## Development credentials
- admin and staff accounts are seeded from .env with development passwords (Admin@12345, Staff@12345).
  They must be changed for any deployment outside a developer machine.


## Kafka readiness at startup
- Kafka reports healthy before topic partitions and the group coordinator are loaded. Consumers (Customer, Shipment) retry for about a
  minute instead of exiting, and the producers (Auth, Order) use the same retry settings. Verified with three consecutive cold starts.

## kafkajs warnings on Node 24
- "TimeoutNegativeWarning" and "[RequestQueue] Response without match" come from inside kafkajs. No functional effect observed; accepted.

## Health check scope
- /api/health checks Redis and that the five gRPC channels are ready. It does not check each service's own database or Kafka connection.  