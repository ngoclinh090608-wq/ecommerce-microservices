# Test report

Generated: 2026-10-24 02:05:00

Produced by `generate-test-report.ps1`: it runs the six smoke-test suites against the running system and maps their checks to the 25 test cases of the specification.

## Result: 25 of 25 test cases passed

| Test case | Bounded context | Description | Evidence (suite: number of checks) | Result |
|---|---|---|---|---|
| TC-IAM-01 | Identity & Access | Đăng ký tài khoản hợp lệ | gateway: 1 check(s); auth: 1 check(s) | PASS |
| TC-IAM-02 | Identity & Access | Đăng ký username đã tồn tại | gateway: 1 check(s); auth: 1 check(s) | PASS |
| TC-IAM-03 | Identity & Access | Đăng ký thiếu password | gateway: 1 check(s) | PASS |
| TC-IAM-04 | Identity & Access | Đăng nhập đúng thông tin | gateway: 1 check(s); auth: 1 check(s) | PASS |
| TC-IAM-05 | Identity & Access | Đăng nhập sai password | gateway: 1 check(s); auth: 1 check(s) | PASS |
| TC-CUS-01 | Customer & Membership | Lấy Customer tồn tại | gateway: 1 check(s); customer: 1 check(s) | PASS |
| TC-CUS-02 | Customer & Membership | Lấy Customer không tồn tại | gateway: 1 check(s); customer: 1 check(s) | PASS |
| TC-CUS-03 | Customer & Membership | Cập nhật fullname | gateway: 1 check(s); customer: 1 check(s) | PASS |
| TC-CUS-04 | Customer & Membership | Lấy thông tin Membership | gateway: 1 check(s); customer: 1 check(s) | PASS |
| TC-CUS-05 | Customer & Membership | Truy vấn Customer không có token | gateway: 1 check(s) | PASS |
| TC-PRO-01 | Product | Lấy danh sách Product | gateway: 1 check(s); product: 1 check(s) | PASS |
| TC-PRO-02 | Product | Lấy Product tồn tại | gateway: 1 check(s); product: 1 check(s) | PASS |
| TC-PRO-03 | Product | Lấy Product không tồn tại | gateway: 1 check(s); product: 1 check(s) | PASS |
| TC-PRO-04 | Product | Tạo Product | gateway: 1 check(s); product: 1 check(s) | PASS |
| TC-PRO-05 | Product | Cập nhật tồn kho | gateway: 1 check(s); product: 1 check(s) | PASS |
| TC-ORD-01 | Order | Tạo Order hợp lệ | gateway: 1 check(s); order: 1 check(s) | PASS |
| TC-ORD-02 | Order | Tạo Order không có JWT | gateway: 1 check(s) | PASS |
| TC-ORD-03 | Order | Đặt số lượng vượt tồn kho | gateway: 1 check(s); order: 1 check(s) | PASS |
| TC-ORD-04 | Order | Tính discount theo score | gateway: 1 check(s); order: 3 check(s) | PASS |
| TC-ORD-05 | Order | Tạo Order và phát sự kiện | order: 1 check(s); order: 1 check(s) | PASS |
| TC-SHP-01 | Shipment | Nhận OrderCreated Event | shipment: 1 check(s); shipment: 1 check(s) | PASS |
| TC-SHP-02 | Shipment | Event thiếu oid | shipment: 1 check(s); shipment: 1 check(s) | PASS |
| TC-SHP-03 | Shipment | Cập nhật trạng thái Shipment | shipment: 1 check(s); gateway: 1 check(s) | PASS |
| TC-SHP-04 | Shipment | Cập nhật Shipment không tồn tại | shipment: 1 check(s); gateway: 1 check(s) | PASS |
| TC-SHP-05 | Shipment | Nhận cùng Event hai lần | shipment: 1 check(s) | PASS |

## Automated suites

| Suite | Passed | Failed | Exit code |
|---|---|---|---|
| auth | 10 | 0 | 0 |
| customer | 16 | 0 | 0 |
| product | 32 | 0 | 0 |
| order | 27 | 0 | 0 |
| shipment | 20 | 0 | 0 |
| gateway | 79 | 0 | 0 |
| **Total** | **184** | **0** | |
