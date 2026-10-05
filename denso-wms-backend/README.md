# DENSO Warehouse WMS — Backend

NestJS + TypeORM + PostgreSQL API cho quản lý kho linh kiện theo mô hình Warehouse → Zone → Rack → Slot.

## Chạy local

```powershell
Copy-Item .env.example .env
npm install
npm run migration:run
npm run start:dev
```

- API: `http://localhost:5001/api`
- Swagger: `http://localhost:5001/api/docs`

Bản v2 bổ sung vị trí kệ 20 ô, warehouse/zone và vị trí ưu tiên cho PART. Với database cũ, cần chạy `npm run migration:run` một lần trước khi khởi động.
