-- Migration 0003: Thêm trường học vấn chi tiết vào bảng employees
-- Đồng bộ với schema mở rộng của BIM/C3D (migration 0018-0020)
ALTER TABLE employees ADD COLUMN university TEXT;       -- Trường đại học
ALTER TABLE employees ADD COLUMN graduation_year INTEGER; -- Năm tốt nghiệp
