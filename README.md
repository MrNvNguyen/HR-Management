# OneCad HCNS - Hệ thống Quản lý Hành chính Nhân sự

## Tổng quan

Webapp quản lý HCNS chuyên dùng cho phòng Hành chính Nhân sự, tích hợp và đồng bộ dữ liệu nhân viên từ 2 hệ thống:
- **BIM Project Management** (OneCad BIM)
- **C3D Project Management** (OneCad C3D)

## Tính năng đã hoàn thành

### Dashboard
- KPI tổng hợp: Tổng nhân sự (BIM + C3D), hợp đồng đang hiệu lực, nhắc nhở khẩn, nghỉ phép chờ duyệt
- Biểu đồ phân bổ nhân sự theo nguồn (BIM/C3D)
- Thống kê phân bổ theo phòng ban
- Bảng hợp đồng sắp hết hạn trong 30 ngày
- Nhắc nhở cần xử lý trong 7 ngày

### Quản lý Nhân viên
- **Đồng bộ từ BIM & C3D**: Kéo dữ liệu nhân viên tự động qua API
- **Bảng nhân sự chi tiết**: Mã NV, nguồn, phòng ban, chức danh, ngày vào, trạng thái HĐ
- **Tìm kiếm & lọc**: Theo tên/mã/email, nguồn BIM/C3D, trạng thái
- **Bổ sung thông tin HCNS** (không có trong BIM/C3D):
  - Ngày sinh, giới tính, CMND/CCCD
  - Ngày vào công ty, thử việc, ngày ký HĐ chính thức
  - Trình độ học vấn, chuyên ngành
  - Số BHXH, BHYT, mã số thuế
  - Tài khoản ngân hàng
  - Địa chỉ, ghi chú HCNS
- **Thêm nhân viên thủ công** (không từ BIM/C3D)
- **Lịch sử thay đổi** theo dõi mọi chỉnh sửa

### Hợp đồng Lao động
- Thêm/sửa/xóa hợp đồng cho từng nhân viên
- Các loại: Thử việc, Có thời hạn, Vô thời hạn, Thời vụ
- Tự động tạo nhắc nhở khi thêm HĐ có thời hạn
- Cảnh báo màu sắc theo mức độ sắp hết hạn (7/30 ngày)
- Lọc theo trạng thái, sắp hết hạn theo ngày

### Nghỉ Phép
- Ghi nhận đơn nghỉ: Phép năm, Ốm đau, Không lương, Thai sản
- Phê duyệt / Từ chối đơn nghỉ

### Nhắc nhở HCNS
- Nhắc nhở tự động: HĐ hết hạn, Hết thử việc, Sinh nhật, Bảo hiểm
- Thêm nhắc nhở thủ công với mức độ ưu tiên
- Đánh dấu đã xử lý
- Lọc theo khoảng thời gian (7/30/60/90 ngày)

### Báo cáo HCNS
- Nhân viên chưa có HĐ chính thức
- Nhân viên sắp kết thúc thử việc (14 ngày tới)
- Nhân viên thiếu thông tin HCNS (ngày sinh, CMND, MST, BHXH, ngân hàng)

### Đồng bộ Dữ liệu
- Cấu hình URL & token cho BIM và C3D
- Đồng bộ 1 click với thống kê thêm mới / cập nhật
- Theo dõi trạng thái và thời gian sync cuối

### Cài đặt
- Đổi mật khẩu
- Quản lý tài khoản HCNS (hr_admin)
- Khởi tạo lại hệ thống

## URLs
- **Sandbox**: https://3000-ih8ej1iomm7ifvzyuimzs-ea026bf9.sandbox.novita.ai

## Tài khoản Demo
| Tài khoản | Mật khẩu | Vai trò |
|-----------|----------|---------|
| `admin` | `Admin@123` | Quản trị HCNS (toàn quyền) |
| `hcns` | `Hcns@123` | Nhân viên HCNS |

## Hướng dẫn sử dụng

### 1. Lần đầu sử dụng
1. Đăng nhập với admin / Admin@123
2. Vào **Đồng bộ Dữ liệu** > Nhập URL app BIM và C3D
3. Bấm **Đồng bộ ngay** để kéo dữ liệu nhân viên về
4. Vào **Danh sách Nhân viên** để bổ sung thông tin HCNS

### 2. Thêm Hợp đồng
1. Vào **Danh sách Nhân viên** > Click vào nhân viên
2. Bấm **Thêm HĐ** hoặc dùng icon hợp đồng ở cột Thao tác
3. Điền thông tin và lưu → Nhắc nhở tự động được tạo

### 3. Theo dõi HĐ sắp hết hạn
- Dashboard hiển thị các HĐ hết hạn trong 30 ngày
- Vào **Hợp đồng Lao động** > Chọn "Hết hạn trong 30 ngày"

## Kiến trúc hệ thống

- **Backend**: Hono.js (TypeScript) trên Cloudflare Workers
- **Frontend**: HTML + TailwindCSS + Chart.js + Axios
- **Database**: Cloudflare D1 (SQLite) riêng cho HCNS
- **Deployment**: Cloudflare Pages

## Mô hình dữ liệu

| Bảng | Mô tả |
|------|-------|
| `hr_users` | Tài khoản HCNS |
| `employees` | Nhân viên (từ BIM/C3D + HCNS info) |
| `contracts` | Hợp đồng lao động |
| `leave_records` | Nghỉ phép |
| `hr_reminders` | Nhắc nhở HCNS |
| `employee_history` | Lịch sử thay đổi nhân sự |
| `data_sources` | Cấu hình nguồn BIM/C3D |

## Triển khai Cloudflare Pages

```bash
# 1. Setup Cloudflare API key
npx wrangler login

# 2. Tạo D1 database
npx wrangler d1 create hr-management-production
# Cập nhật database_id vào wrangler.jsonc

# 3. Deploy
npm run build
npx wrangler pages deploy dist --project-name hr-management

# 4. Khởi tạo database production
curl -X POST https://hr-management.pages.dev/api/system/init
```

## Cần phát triển thêm

- Export danh sách nhân viên ra Excel/PDF
- Gửi email nhắc nhở tự động
- Biểu đồ thống kê nâng cao
- Quản lý lương chi tiết
- Tích hợp chấm công từ Timesheet của BIM/C3D
- Upload file hợp đồng lên R2
- Mobile responsive tốt hơn

---
**2024 OneCad Vietnam - HR Management System**
*Built on Cloudflare Workers + Hono.js*
