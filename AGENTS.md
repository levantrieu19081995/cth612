# CTH612 — Bài tập cơ sở dữ liệu nâng cao

## Mục đích và phạm vi

Dự án đặt vé máy bay để thực hành CockroachDB và Cassandra, gồm giao dịch đặt vé, phát sự kiện bằng outbox, giám sát và quan sát phân tán dữ liệu. Trao đổi với người dùng bằng tiếng Việt, giải thích qua chức năng và kết quả thực tế.

Thư mục dự án là `cth612`, độc lập với CT605, CT999 và CTH603 ở cùng cấp. Remote: `https://github.com/levantrieu19081995/cth612.git`. Nhánh đang dùng khi khởi tạo hướng dẫn: `main`.

## Cấu trúc

- `backend-java/`: Java 17, Spring Boot 4.0.8, Maven. Package chính: `vn.ctu.distributedflight`.
  - `controller/`: API đặt vé, sự kiện, thống kê, hệ thống và giám sát.
  - `service/`, `domain/`: nghiệp vụ và quy tắc đặt vé.
  - `repository/`: truy cập CockroachDB, Cassandra và khởi tạo dữ liệu theo profile.
  - `outbox/OutboxDispatcher.java`: chuyển sự kiện sang Cassandra.
  - `monitoring/`: giám sát máy, replica và trình duyệt vị trí dữ liệu.
  - `src/main/resources/application.yml`: cấu hình và biến môi trường.
  - `src/main/resources/db/`: schema SQL và CQL.
  - `src/test/java/`: kiểm thử API, nghiệp vụ, outbox và phân tán.
- `frontend-nextjs/`: Next.js App Router, React, TypeScript và Mantine.
  - `app/booking/`, `app/bookings/[id]/`: đặt vé, tạo dữ liệu mẫu và tra cứu.
  - `app/monitor/`, `app/replication/`, `app/analytics/`: giám sát, phân tán và thống kê.
  - `app/api/[...path]/route.ts`: proxy API sang backend.
  - `lib/api.ts`, `types/`: client API và kiểu dữ liệu dùng chung.
- `start-backend.cmd`, `start-frontend.cmd`: lệnh chạy bằng CMD trên máy hiện tại.
- `task.md`: ghi chú yêu cầu; đối chiếu mã hiện tại trước khi xem một mục là chưa làm.

Khi sửa frontend, đọc thêm `frontend-nextjs/AGENTS.md` và tài liệu Next.js được cài tại `frontend-nextjs/node_modules/next/dist/docs/` theo hướng dẫn trong tệp đó. Dùng phiên bản trong `package.json` và lockfile của dự án.

## Cách chạy và kiểm tra

Từ gốc dự án, chạy các lệnh sau khi cần kiểm tra thay đổi tương ứng:

```bat
mvn.cmd -f backend-java/pom.xml test
mvn.cmd -f backend-java/pom.xml package
```

Frontend, chạy trong `frontend-nextjs`:

```bat
npm.cmd ci
npm.cmd run typecheck
npm.cmd run test:distribution
node app/booking/bulk-bookings.test.cjs
npm.cmd run build
```

Chỉ cài lại dependencies khi thiếu hoặc thay đổi lockfile. Chọn kiểm tra phù hợp với phần đã sửa.

Chạy ứng dụng trong hai cửa sổ CMD ở gốc dự án:

```bat
start-backend.cmd
start-frontend.cmd
```

Backend mặc định cổng 8080; frontend cổng 3000. Script backend chạy JAR trong `backend-java/target/`, vì vậy cần build lại JAR sau khi sửa Java. Frontend dùng `BACKEND_URL=http://127.0.0.1:8080`; `NEXT_PUBLIC_API_BASE_URL` để trống để đi qua proxy cùng origin. Swagger: `/swagger-ui.html`; OpenAPI: `/v3/api-docs`; kiểm tra kết nối nhẹ: `/api/system/ping`.

## Cơ sở dữ liệu

Ưu tiên dùng hai database đã có của người dùng theo cấu hình hiện tại. Các biến chính:

- `COCKROACH_JDBC_URL`, `COCKROACH_USERNAME`, `COCKROACH_PASSWORD`.
- `CASSANDRA_CONTACT_POINTS`, `CASSANDRA_LOCAL_DATACENTER`, `CASSANDRA_KEYSPACE`, `CASSANDRA_CONSISTENCY`.
- `DEPLOYMENT_MODE`, `OUTBOX_ENABLED`, `OUTBOX_POLL_MS`, `OUTBOX_BATCH_SIZE`.

Không chép mật khẩu hoặc thông tin truy cập vào hướng dẫn, log và commit. Giữ dữ liệu hiện có khi chỉnh ứng dụng; việc đọc lại ngữ cảnh không bao gồm reset database hoặc sinh thêm dữ liệu.

`LocalDataInitializer` chỉ hoạt động với profile `local` hoặc `demo` và thực hiện ghi schema/dữ liệu mẫu. `BookingDatabaseTest` là kiểm thử dùng CockroachDB thật, chỉ bật khi có `-Dflight.integration=true`; địa chỉ thử nghiệm qua `-Dflight.jdbc=...`. Phân biệt các thao tác này với kiểm thử mặc định.

Giữ đúng giao dịch đặt vé, xử lý gửi lại yêu cầu và luồng outbox khi thay đổi nghiệp vụ.

## Phần phân tán đã có

Bản local khi khởi tạo hướng dẫn có commit gần nhất `7098dfd`, bổ sung trình duyệt dữ liệu theo node và bộ đếm Cassandra.

- API: `GET /api/monitoring/distribution/records` và `GET /api/monitoring/distribution/counts`.
- Backend: `DistributionController`, `DistributionService`, `DistributionRepository`.
- Frontend: `app/replication/DistributionBrowser.tsx`, tích hợp trong trang phân tán; kiểu dữ liệu tại `types/distribution.ts`.
- Phân trang bằng cursor, cỡ trang hợp lệ 20, 50 hoặc 100. Khi lọc node SQL, mỗi lượt quét tối đa 100 bản ghi; giữ giới hạn này khi mở rộng cho hàng nghìn dòng.
- CockroachDB hỗ trợ các bảng `bookings`, `payments`, `outbox_events`, `flight_seats`.
- Cassandra đọc theo partition: mã vé/UUID cho `booking_events_by_booking`, ngày UTC cho `booking_events_by_day`.
- Replica/range/leaseholder là thông tin vị trí từ metadata, không chứng minh từng replica đã nhận bản ghi. Giữ sự phân biệt `METADATA` và `UNKNOWN` trong API và giao diện.
- Đếm Cassandra được người dùng yêu cầu trực tiếp, có cache 60 giây và timeout 3 giây mỗi truy vấn. Khi lỗi, trả `rows=null`, trạng thái `UNAVAILABLE`; không hiển thị thành 0 hay suy ra số dòng từ outbox. Không đưa thao tác đếm vào polling.

Khi bổ sung chức năng, giữ bố cục và các chức năng hiện có. Với tính năng có cả API và giao diện, làm và kiểm tra API trước, rồi nối frontend và kiểm tra toàn luồng.

## Quy ước Git

Kiểm tra trạng thái Git trước khi sửa và trước khi commit; giữ nguyên công việc đang có của người dùng.

Theo yêu cầu cập nhật của người dùng, Git giữ đầy đủ mã nguồn, dữ liệu, tài liệu, hướng dẫn, tệp chạy và minh chứng; không chặn nội dung bài tập theo đuôi tệp. Chỉ bỏ thư viện có thể cài lại, tệp tự sinh khi chạy hoặc build, cache và thông tin đăng nhập. Các ví dụ cấu hình không chứa khóa đăng nhập được phép đưa lên Git.
