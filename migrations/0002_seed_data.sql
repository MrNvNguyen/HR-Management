-- ===================================================
-- Seed data - Tài khoản Admin HCNS
-- ===================================================

-- Tạo tài khoản admin HCNS (password: Admin@123)
INSERT OR IGNORE INTO hr_users (username, password_hash, full_name, email, role)
VALUES 
  ('admin', '$2b$10$placeholder_hash_admin', 'Quản trị HCNS', 'admin@onecad.vn', 'hr_admin'),
  ('hcns', '$2b$10$placeholder_hash_hcns', 'Nhân viên HCNS', 'hcns@onecad.vn', 'hr_staff');

-- Cấu hình nguồn dữ liệu (sẽ được cập nhật từ UI)
INSERT OR IGNORE INTO data_sources (app_name, api_url, is_active)
VALUES 
  ('BIM', 'https://your-bim-app.pages.dev', 1),
  ('C3D', 'https://your-c3d-app.pages.dev', 1);
