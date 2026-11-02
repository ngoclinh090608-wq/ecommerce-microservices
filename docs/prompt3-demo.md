# Chuẩn bị và trình bày Prompt 3

Chạy từ thư mục gốc repository. Node.js 24, Docker Compose; cài dependency bằng `npm ci` trong `api-gateway` và từng thư mục service. Tạo `.env` từ `.env.example`, thay các giá trị `change-me`. Chỉ dùng tài khoản demo trong môi trường phát triển.

```sh
docker compose up -d --build --wait --wait-timeout 300
docker compose ps
node scripts/prepare-demo.js
```

Script đọc ADMIN_USERNAME/ADMIN_PASSWORD từ `.env`, tạo hoặc đăng nhập `demo_gold` với mật khẩu phát triển `Demo@12345`, chờ Kafka tạo Customer, đặt hạng Gold và tạo sản phẩm `Prompt 3 Demo - 100` giá 100, tồn kho 20. Có thể cấu hình DEMO_USERNAME, DEMO_PASSWORD, GATEWAY_URL, DEMO_GOLD_MID qua biến môi trường. Gold có mid=3 trên DB mới; trên DB đã có dữ liệu hãy đặt DEMO_GOLD_MID đúng. Script kiểm tra mname=Gold và score=500, không giả định uid=65/pid=82.

Chạy lại script sẽ giữ sản phẩm và tồn kho hiện có. Muốn đưa riêng tồn kho sản phẩm demo về 20, khi không có người đặt hàng đồng thời:

```sh
node scripts/prepare-demo.js --reset-stock
```

Script không xóa đơn, vận đơn hay volume; không đổi mật khẩu tài khoản đã tồn tại; nếu mật khẩu không khớp sẽ dừng. Nếu Kafka không tạo Customer trong 30 giây, kiểm tra user-registered; script không tạo Customer ngầm. Không lưu token ra file.

Import `postman/prompt3.postman_collection.json` và environment được sinh `postman/demo.local.postman_environment.json`, chọn environment đó. File environment chỉ chứa baseUrl, demoUid, demoPid; đã được gitignore. Nếu đổi thông tin tài khoản demo, đặt demoUsername/demoPassword tương ứng trong Postman. Chạy Login đầu tiên để lấy JWT mới vào collection variable memberToken. Các file YAML cũ cũng dùng baseUrl/demoUid/demoPid/memberToken; collection JSON là bộ demo đầy đủ.

| Mục | Thao tác | Kết quả cần chỉ ra |
|---|---|---|
| 1 | Mở shared/proto, api-gateway, services | 5 hợp đồng gRPC, 5 service riêng, Gateway; domain/application/infrastructure/interfaces; mỗi service sở hữu DB riêng |
| 2 | docker compose up -d; docker compose ps | 13 container, tất cả healthy |
| 3 | Lệnh Kafka dưới đây | Kafka 3.8.0, user-registered và order-created; vai trò producer/consumer |
| 4 | Product list | HTTP 200 và danh sách có pid/pname/price/quantity |
| 5 | Customer Membership | HTTP 200, đúng demoUid, Gold, score=500 |
| 6 | Customer without token | Request có No Auth, không có Authorization; HTTP 401 |
| 7 | Create order, 2 products; List orders | HTTP 201, discount=10 (%), tổng 200, giảm 20, total_amount=180 |
| 8 | Create order and publish event; Check shipment | Cùng oid trong response, log Order và Shipment; có shipid thực |

```sh
docker compose ps kafka
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092
docker compose logs --since=5m order-service shipment-service
```

Log `[order] published order-created key=...` và `[shipment] created shipid=... for oid=...` phải khớp oid vừa tạo. Có thể đọc sự kiện thực trong topic bằng lệnh sau (dừng bằng Ctrl+C):

```sh
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic order-created --from-beginning --timeout-ms 10000
```

Consumer CLI có thể in sự kiện lịch sử; đối chiếu đúng oid. Topic tồn tại hoặc container healthy chưa chứng minh sự kiện vừa tạo đã được xử lý.

## Hợp đồng API và lỗi

- POST /api/orders trả 201 sau khi Order/OrderDetail/Outbox đã commit. Gateway chờ tối đa khoảng 2.5 giây để lấy Shipment. Khi đã có, trả `shipment: {shipid: <id>, status: "PENDING"}`.
- Nếu xử lý Kafka chậm hoặc Shipment chưa sẵn sàng, trả `shipment: {shipid: null, status: "PENDING"}` cùng header `Location: /api/orders/:oid`. GET URL này lại đến khi có shipid. Không POST lại chỉ vì shipid còn null. Đây là mở rộng async rõ ràng so với ví dụ Excel luôn có shipid.
- Customer chưa tồn tại: 404 trước khi trừ kho/lưu đơn. Đăng ký mới cần chờ user-registered tạo Customer.
- Mật khẩu đăng ký hợp lệ: ví dụ `P@ss1234`, ít nhất 8 ký tự gồm chữ và số. Ví dụ `P@ss123` trong Excel chỉ có 7 ký tự nên trả 400.
- Outbox bảo đảm Order/OrderDetail/event trong cùng PostgreSQL transaction; không tạo transaction phân tán với MongoDB. Reservation/saga bền vững cho crash/timeout vẫn là giới hạn được ghi trong known-risks.md.

## Kiểm thử

Regression test không cần DB/Kafka (chạy từng file để thấy số test chi tiết):

```sh
node tests/customer-membership.test.js
node tests/order-missing-customer.test.js
node tests/shipment-response.test.js
node tests/prepare-demo.test.js
node tests/order-create-http.test.js
```

Smoke test đầy đủ cần hệ thống đang chạy và dependency đã cài, gRPC/DB/Kafka được mở cổng cho local:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev-ports.yml up -d --build --wait --wait-timeout 300
node scripts/run-smoke-tests.js
```

Runner dùng được trên Linux/Windows, đọc `.env` ở root, chạy đủ sáu suite, thất bại nếu suite crash, timeout, có FAIL hoặc không có PASS. Trên Windows có thể dùng `generate-test-report.ps1` để sinh báo cáo đối chiếu 25 TC; runner cũng kiểm tra exit code. Báo cáo cũ trong docs/test-report.md không thay thế kết quả lần chạy mới.

## Xác thực cho bản cập nhật này

- 15 regression test đạt (2 membership, 1 order/missing Customer, 3 shipment lookup, 6 demo preparation, 3 HTTP create-order). Repository/remote dependencies được stub trong các regression test; test HTTP dùng server Express thật trên cổng tạm.
- Cả 5 proto nạp được; collection JSON và 7 request YAML parse được.
- Product gRPC smoke suite đã chạy với MongoDB thật: 32 PASS.
- Chưa xác thực seed demo, sáu smoke suite sau sửa và toàn bộ 13 container cùng chạy: máy cloud đang bị proxy từ chối tải checksum Prisma tại binaries.prisma.sh (403). Không tắt TLS hoặc bỏ xác minh checksum để vượt lỗi.
- PowerShell report generator được sửa kiểm tra exit code nhưng chưa thực thi trên Windows trong phiên này.
