# DENSO Warehouse WMS v5.3 - QR Center

Bản này kế thừa toàn bộ v5.2 Multi-Zone và chỉ nâng module QR/Barcode. Không thay đổi nguyên lý kho, dữ liệu cũ, 20 kệ/Zone, 20 ô/kệ, quy tắc tải trọng, import Excel hoặc nghiệp vụ kho.

## QR Center
- QR Zone → mở đúng sơ đồ Zone.
- QR Kệ → mở đúng kệ 3D.
- QR Ô → mở trang chi tiết ô và thao tác nhanh.
- QR PART → mở kệ và tìm/highlight PART.
- Bộ lọc Zone/Kệ/Tầng/Trạng thái; tìm Rxx/Sxx/PART/Master PO.
- In hàng loạt; xuất PDF; 4 preset tem.

## Chạy
Backend:
```powershell
cd denso-wms-backend
npm install
npm run start:dev
```
Frontend:
```powershell
cd denso-wms-frontend
npm install
npm run dev
```

Không có migration mới.

## Quét QR bằng điện thoại trong mạng LAN
Frontend mặc định tạo QR theo URL đang mở. Nếu URL là localhost thì điện thoại khác không truy cập được.
Tạo file `denso-wms-frontend/.env.local`:
```env
VITE_PUBLIC_APP_URL=http://IP-LAN-CUA-MAY:4310
```
Sau đó restart frontend.
