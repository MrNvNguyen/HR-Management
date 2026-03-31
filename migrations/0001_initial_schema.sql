-- ===================================================
-- HCNS - HR Management System - Database Schema
-- Quản lý Hành chính Nhân sự
-- Đây là D1 riêng cho HCNS, chứa thêm thông tin HCNS
-- Dữ liệu nhân viên được import từ BIM & C3D databases
-- ===================================================

-- Bảng HR Admin Users (tài khoản HCNS)
CREATE TABLE IF NOT EXISTS hr_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'hr_staff', -- hr_admin, hr_staff
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng nhân viên HCNS (dữ liệu gốc từ BIM + C3D + bổ sung HCNS)
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Thông tin gốc từ nguồn app
  source_app TEXT NOT NULL, -- 'BIM' hoặc 'C3D'
  source_id INTEGER NOT NULL, -- ID gốc trong app nguồn
  username TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,            -- Vai trò trong app gốc
  department TEXT,      -- Phòng ban
  salary_monthly REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  
  -- Thông tin HCNS bổ sung
  employee_code TEXT,          -- Mã nhân viên HCNS
  date_of_birth DATE,          -- Ngày sinh
  gender TEXT,                 -- Nam / Nữ / Khác
  id_number TEXT,              -- CMND/CCCD
  id_issue_date DATE,          -- Ngày cấp
  id_issue_place TEXT,         -- Nơi cấp
  address TEXT,                -- Địa chỉ thường trú
  current_address TEXT,        -- Địa chỉ tạm trú
  
  -- Thông tin vào công ty
  join_date DATE,              -- Ngày vào công ty
  probation_start DATE,        -- Bắt đầu thử việc
  probation_end DATE,          -- Kết thúc thử việc
  official_start DATE,         -- Ngày ký HĐ chính thức
  position TEXT,               -- Chức danh
  education TEXT,              -- Trình độ học vấn (degree từ BIM/C3D)
  major TEXT,                  -- Chuyên ngành
  university TEXT,             -- Trường đại học
  graduation_year INTEGER,     -- Năm tốt nghiệp
  
  -- Thông tin bảo hiểm & thuế
  social_insurance TEXT,       -- Số BHXH
  health_insurance TEXT,       -- Số BHYT
  tax_code TEXT,               -- Mã số thuế
  
  -- Ngân hàng
  bank_account TEXT,           -- Số tài khoản
  bank_name TEXT,              -- Tên ngân hàng
  bank_branch TEXT,            -- Chi nhánh
  
  -- Ghi chú HCNS
  notes TEXT,
  
  synced_at DATETIME,          -- Lần cuối sync từ app nguồn
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(source_app, source_id)
);

-- Bảng hợp đồng lao động
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  contract_number TEXT UNIQUE NOT NULL,  -- Số hợp đồng
  contract_type TEXT NOT NULL,           -- trial (thử việc), fixed_term (có thời hạn), indefinite (vô thời hạn), seasonal (thời vụ)
  start_date DATE NOT NULL,              -- Ngày bắt đầu
  end_date DATE,                         -- Ngày kết thúc (null = vô thời hạn)
  salary REAL DEFAULT 0,                 -- Mức lương trong HĐ
  position TEXT,                         -- Chức vụ trong HĐ
  department TEXT,                       -- Phòng ban
  status TEXT DEFAULT 'active',          -- active, expired, terminated, renewed
  signed_date DATE,                      -- Ngày ký
  file_url TEXT,                         -- Link file HĐ
  renewal_reminder_days INTEGER DEFAULT 30, -- Nhắc trước bao nhiêu ngày
  notes TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (created_by) REFERENCES hr_users(id)
);

-- Bảng nghỉ phép
CREATE TABLE IF NOT EXISTS leave_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  leave_type TEXT NOT NULL,  -- annual (phép năm), sick (ốm đau), unpaid (không lương), maternity (thai sản), other
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days REAL NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',  -- pending, approved, rejected
  approved_by INTEGER,
  approved_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (approved_by) REFERENCES hr_users(id)
);

-- Bảng nhắc nhở HCNS
CREATE TABLE IF NOT EXISTS hr_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER,
  contract_id INTEGER,
  reminder_type TEXT NOT NULL,  -- contract_expiry, probation_end, birthday, insurance, other
  title TEXT NOT NULL,
  description TEXT,
  remind_date DATE NOT NULL,    -- Ngày nhắc
  is_resolved INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

-- Bảng lịch sử thay đổi nhân sự
CREATE TABLE IF NOT EXISTS employee_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  changed_by INTEGER NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (changed_by) REFERENCES hr_users(id)
);

-- Bảng cấu hình sync nguồn dữ liệu (Cloudflare D1 HTTP API)
CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT UNIQUE NOT NULL,   -- 'BIM' hoặc 'C3D'
  cf_account_id TEXT,              -- Cloudflare Account ID
  cf_database_id TEXT,             -- D1 Database ID của app nguồn
  cf_api_token TEXT,               -- API Token có quyền D1:Read
  last_sync DATETIME,              -- Lần sync cuối
  sync_status TEXT DEFAULT 'pending', -- pending, success, error
  sync_message TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_source ON employees(source_app, source_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_contracts_employee ON contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON hr_reminders(remind_date);
CREATE INDEX IF NOT EXISTS idx_reminders_resolved ON hr_reminders(is_resolved);
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_records(employee_id);
