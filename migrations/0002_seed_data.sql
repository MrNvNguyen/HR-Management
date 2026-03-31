-- ===================================================
-- Seed data - Tài khoản Admin HCNS
-- ===================================================

-- Tạo tài khoản admin HCNS (password: Admin@123)
INSERT OR IGNORE INTO hr_users (username, password_hash, full_name, email, role)
VALUES 
  ('admin', '$placeholder_hash_admin', 'Quản trị HCNS', 'admin@onecad.vn', 'hr_admin'),
  ('hcns', '$placeholder_hash_hcns', 'Nhân viên HCNS', 'hcns@onecad.vn', 'hr_staff');

-- Cấu hình nguồn dữ liệu Cloudflare D1 (sẽ được cập nhật từ UI)
INSERT OR IGNORE INTO data_sources (app_name, cf_account_id, cf_database_id, cf_api_token)
VALUES 
  ('BIM', '', '', ''),
  ('C3D', '', '', '');
