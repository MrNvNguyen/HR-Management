-- ===================================================
-- Seed data - Tài khoản Admin HCNS
-- Password: SHA-256 hash
--   admin  → Admin@123  → e86f78a8a3caf0b60d8e74e5942aa6d86dc150cd3c03338aef25b7d2d7e3acc7
--   hcns   → Hcns@123   → bfea88080d7c606637817c7fc20ad6a4af69fc3e215d0081b781074130930241
-- ===================================================

INSERT OR IGNORE INTO hr_users (username, password_hash, full_name, email, role)
VALUES 
  ('admin', 'e86f78a8a3caf0b60d8e74e5942aa6d86dc150cd3c03338aef25b7d2d7e3acc7', 'Quản trị HCNS', 'admin@onecad.vn', 'hr_admin'),
  ('hcns',  'bfea88080d7c606637817c7fc20ad6a4af69fc3e215d0081b781074130930241', 'Nhân viên HCNS', 'hcns@onecad.vn',  'hr_staff');

-- Cấu hình nguồn dữ liệu Cloudflare D1 (sẽ được cập nhật từ UI)
INSERT OR IGNORE INTO data_sources (app_name, cf_account_id, cf_database_id, cf_api_token)
VALUES 
  ('BIM', '', '', ''),
  ('C3D', '', '', '');
