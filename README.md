# E-commerce MVP: Microservices, DDD, Database-per-Service

Backend RESTful API cho hệ thống thương mại điện tử phiên bản MVP, viết bằng Node.js theo kiến trúc Microservices.

## Kiến trúc

```
Client --REST--> API Gateway (:3000) --gRPC--> Auth | Customer | Product | Order | Shipment
                      |                          |        |         |        |         |
                    Redis                    Postgres Postgres  MongoDB  Postgres  MongoDB
        (cache, rate limit)                                         \       /
                                                                   Kafka (user-registered, order-created)
```

| Thành phần | Cổng gRPC | CSDL | Trách nhiệm |
|---|---|---|---|
| api-gateway | 3000 (REST) | Redis | Routing, xác thực JWT, phân quyền, rate limit, cache, log |
| auth-service | 50051 | PostgreSQL | Đăng ký, đăng nhập, cấp JWT, role |
| customer-service | 50052 | PostgreSQL | Khách hàng, hạng thành viên, score |
| product-service | 50053 | MongoDB | Sản phẩm, trừ kho nguyên tử |
| order-service | 50054 | PostgreSQL | Đặt hàng, tính discount, Outbox |
| shipment-service | 50055 | MongoDB | Tạo và cập nhật giao hàng |

- Mỗi service có CSDL riêng (Database-per-Service); dữ liệu chéo luôn đi qua gRPC hoặc Kafka.
- Luồng bất đồng bộ: `user-registered` (Auth → Customer) và `order-created` (Order → Shipment, qua Outbox Pattern).
- Tính discount theo `score` của hạng thành viên: 0 → 0%, 100 → 5%, 500 → 10%, 1000 → 15%.

## Chạy hệ thống

Yêu cầu: Docker Desktop.

```powershell
Copy-Item .env.example .env      # rồi sửa các giá trị change-me
docker compose up -d --build
```

Chờ khoảng một phút cho đến khi 13 container `healthy` (`docker compose ps`). Chỉ cổng 3000 được mở ra máy chủ.

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Tài khoản có sẵn (giá trị lấy từ `.env`): `admin` (role admin), `staff` (role shipment_staff). Đăng ký công khai chỉ tạo role `member`.
Ba sản phẩm mẫu được tạo tự động khi kho trống.

## API

| Method | Đường dẫn | Quyền |
|---|---|---|
| POST | /api/auth/register | công khai |
| POST | /api/auth/login | công khai |
| GET | /api/customers/:uid | chính chủ, admin |
| PUT | /api/customers/:uid | chính chủ (fullname), admin (fullname, mid) |
| GET | /api/products, /api/products/:pid | đã đăng nhập |
| POST, PUT, DELETE | /api/products, /api/products/:pid | admin |
| POST | /api/orders | đã đăng nhập |
| GET | /api/orders, /api/orders/:oid | chủ đơn, admin |
| GET | /api/shipments/:shipid | chủ đơn, admin, shipment_staff |
| PATCH | /api/shipments/:shipid/status | admin, shipment_staff |
| GET | /api/health | công khai |

Ví dụ:

```powershell
$login = Invoke-RestMethod -Method Post http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
$h = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod http://localhost:3000/api/products -Headers $h
```

## Kiểm thử

Các bộ test gọi trực tiếp cổng gRPC nên cần file compose phụ (chỉ dùng khi phát triển):

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev-ports.yml up -d --build
powershell -ExecutionPolicy Bypass -File .\generate-test-report.ps1
```

Kết quả: `docs\test-report.md` (đối chiếu 25 test case của đề bài). `cold-start-test.ps1` kiểm tra khởi động lạnh nhiều lần.

## Tài liệu

- `docs/design-decisions.md`: các giả định và quyết định thiết kế.
- `docs/known-risks.md`: rủi ro và giới hạn đã biết.
- `docs/kafka-events.md`: định dạng sự kiện Kafka.
- `docs/test-report.md`: báo cáo kiểm thử.

## Cấu trúc

```
api-gateway/        Gateway REST
services/           5 service gRPC
shared/proto/       hợp đồng gRPC (chỉ chứa file .proto)
docs/               tài liệu
docker-compose.yml  hệ thống đầy đủ (chỉ mở cổng 3000)
```

## Tắt và bật hệ thống

```powershell
docker compose stop      # tắt sạch (các CSDL được đóng đúng cách)
docker compose start     # bật lại
```

Không nên "Pause" rồi thoát Docker Desktop khi hệ thống đang chạy: tiến trình bị giết đột ngột, các CSDL phải tự phục hồi lúc bật lại.
Không chạy `docker compose down -v`, `docker volume prune` hay `docker system prune --volumes`: chúng xóa dữ liệu.
Toàn bộ container có `restart: unless-stopped`, nên sau khi Docker Desktop khởi động lại hệ thống tự lên.