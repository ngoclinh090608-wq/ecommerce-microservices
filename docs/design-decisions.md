# Design decisions (assumptions)

1. discount is a percentage. total_amount = sum(qty * unit_price) * (1 - discount/100).
2. POST /api/orders returns shipment_status = "PENDING" only; shipid is not returned
   because the shipment is created asynchronously from the OrderCreated event.
3. Discount table (provisional): score < 100 -> 0%; 100-499 -> 5%; 500-999 -> 10%; >= 1000 -> 15%.
4. Money is double in proto for the MVP; round to 2 decimals. Known weakness of floating point.
5. pid and shipid are integers generated from a counters collection in MongoDB.

6. Per ERD, score belongs to MemberShip (tier), not to the customer. Seed tiers: Standard 0, Silver 100, Gold 500, Platinum 1000.
7. Only admin may change a customer's mid (members could otherwise self-promote to a higher discount).
8. GetMembership creates a default profile if missing (compensates for a lost user-registered event); GetCustomer does not (TC-CUS-02 expects 404).
9. Open question for Step 6: UC07 says "discount amount"; current decision is percentage.

10. Integer fields (pid, qty, quantity) are int32 on the wire; a value such as 1.5 is truncated to 1 before the service sees it.
    The API Gateway must reject non-integer JSON numbers for these fields (400) before calling gRPC.

11. API response casing: API-AUTH-02 uses camelCase (accessToken, tokenType, expiresIn) while order items use unit_price.
    The Gateway maps the snake_case gRPC fields to the exact shapes in the API Specification.


12. Shipment status policy (assumption beyond the spec): PENDING -> SHIPPING -> DELIVERED, and CANCELLED from PENDING or SHIPPING.
    No skipping steps, no going backwards, DELIVERED and CANCELLED are final. Repeating the current status is accepted (idempotent).

13. Shipment ownership: Shipment has no uid, so the Gateway authorizes a customer's GET /api/shipments/:shipid by asking Order Service GetOrder for the shipment's oid.
    Admin and shipment_staff are not checked.

14. GET /api/customers/:uid is limited to the customer themself or an admin (403 otherwise); the spec only lists 401 and 404 for it.
15. PUT /api/products/:pid uses an update_mask so a partial update never overwrites stock changed concurrently by orders.
16. Product reads are cached in Redis (default 15 s) and invalidated on product writes and successful orders.
    Displayed stock can be stale up to the TTL; orders always check the real stock.
17. Rate limits: 200 requests/min/IP overall and 10/min/IP on /api/auth. If Redis is down the gateway fails open
    (no cache, no limiting) and /api/health reports 503.