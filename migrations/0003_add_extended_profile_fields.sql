-- Migration 0003: Thêm trường học vấn chi tiết vào bảng employees
-- NOTE: university và graduation_year đã được thêm vào schema 0001 rồi.
-- Migration này chỉ để tương thích với các DB cũ chưa có 2 cột đó.
-- Nếu cột đã tồn tại → SQLite sẽ báo lỗi "duplicate column name" → bỏ qua.

-- Chạy từng lệnh riêng (wrangler d1 migrations apply xử lý từng statement):
ALTER TABLE employees ADD COLUMN university TEXT;
ALTER TABLE employees ADD COLUMN graduation_year INTEGER;
