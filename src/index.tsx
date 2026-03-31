import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

// ===================================================
// HCNS - HR Management System Backend
// Hono API for Cloudflare Pages + D1
// ===================================================

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS
app.use('/api/*', cors({ origin: '*' }))

// ===== JWT HELPER =====
// Base64url encode that handles Unicode
function b64uEncode(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach(b => bin += String.fromCharCode(b))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64uDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - str.length % 4) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function signJWT(payload: object, secret: string): Promise<string> {
  const header = b64uEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64uEncode(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }))
  const data = `${header}.${body}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${data}.${sigB64}`
}

async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const data = `${parts[0]}.${parts[1]}`
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data))
    if (!valid) return null
    return JSON.parse(b64uDecode(parts[1]))
  } catch { return null }
}

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder().encode(password)
  const hash = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Auth middleware
async function authMiddleware(c: any, next: any) {
  const auth = c.req.header('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const secret = c.env.JWT_SECRET || 'hcns-secret-key-2024'
  const payload = await verifyJWT(auth.substring(7), secret)
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  c.set('user', payload)
  await next()
}

// ===== AUTH ROUTES =====
app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json()
  const db = c.env.DB
  const user = await db.prepare('SELECT * FROM hr_users WHERE username = ? AND is_active = 1').bind(username).first() as any
  if (!user) return c.json({ error: 'Tài khoản không tồn tại' }, 401)
  const hashed = await hashPassword(password)
  if (user.password_hash !== hashed) return c.json({ error: 'Mật khẩu không đúng' }, 401)
  const secret = c.env.JWT_SECRET || 'hcns-secret-key-2024'
  const token = await signJWT({ id: user.id, username: user.username, role: user.role, full_name: user.full_name }, secret)
  return c.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } })
})

app.get('/api/auth/me', authMiddleware, async (c) => {
  return c.json({ user: c.get('user') })
})

app.post('/api/auth/change-password', authMiddleware, async (c) => {
  const user = c.get('user')
  const { old_password, new_password } = await c.req.json()
  const db = c.env.DB
  const dbUser = await db.prepare('SELECT * FROM hr_users WHERE id = ?').bind(user.id).first() as any
  const oldHash = await hashPassword(old_password)
  if (dbUser.password_hash !== oldHash) return c.json({ error: 'Mật khẩu cũ không đúng' }, 400)
  const newHash = await hashPassword(new_password)
  await db.prepare('UPDATE hr_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newHash, user.id).run()
  return c.json({ success: true })
})

// ===== SYSTEM INIT =====
app.post('/api/system/init', async (c) => {
  const db = c.env.DB
  try {
    // Tạo bảng HR users
    await db.prepare(`CREATE TABLE IF NOT EXISTS hr_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'hr_staff',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run()

    // Tạo bảng employees
    await db.prepare(`CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_app TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT,
      department TEXT,
      salary_monthly REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      employee_code TEXT,
      date_of_birth DATE,
      gender TEXT,
      id_number TEXT,
      id_issue_date DATE,
      id_issue_place TEXT,
      address TEXT,
      current_address TEXT,
      join_date DATE,
      probation_start DATE,
      probation_end DATE,
      official_start DATE,
      position TEXT,
      education TEXT,
      major TEXT,
      social_insurance TEXT,
      health_insurance TEXT,
      tax_code TEXT,
      bank_account TEXT,
      bank_name TEXT,
      bank_branch TEXT,
      notes TEXT,
      synced_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_app, source_id)
    )`).run()

    // Tạo bảng contracts
    await db.prepare(`CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      contract_number TEXT UNIQUE NOT NULL,
      contract_type TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      salary REAL DEFAULT 0,
      position TEXT,
      department TEXT,
      status TEXT DEFAULT 'active',
      signed_date DATE,
      file_url TEXT,
      renewal_reminder_days INTEGER DEFAULT 30,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run()

    // Tạo bảng leave_records
    await db.prepare(`CREATE TABLE IF NOT EXISTS leave_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days REAL NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      approved_by INTEGER,
      approved_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run()

    // Tạo bảng hr_reminders
    await db.prepare(`CREATE TABLE IF NOT EXISTS hr_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      contract_id INTEGER,
      reminder_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      remind_date DATE NOT NULL,
      is_resolved INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run()

    // Tạo bảng employee_history
    await db.prepare(`CREATE TABLE IF NOT EXISTS employee_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      changed_by INTEGER NOT NULL,
      field_changed TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run()

    // Tạo bảng data_sources (dùng Cloudflare D1 HTTP API)
    await db.prepare(`CREATE TABLE IF NOT EXISTS data_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT UNIQUE NOT NULL,
      cf_account_id TEXT,
      cf_database_id TEXT,
      cf_api_token TEXT,
      last_sync DATETIME,
      sync_status TEXT DEFAULT 'pending',
      sync_message TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run()
    // Migrate: add new columns if not exist (safe)
    try { await db.prepare(`ALTER TABLE data_sources ADD COLUMN cf_account_id TEXT`).run() } catch (_) {}
    try { await db.prepare(`ALTER TABLE data_sources ADD COLUMN cf_database_id TEXT`).run() } catch (_) {}
    try { await db.prepare(`ALTER TABLE data_sources ADD COLUMN cf_api_token TEXT`).run() } catch (_) {}

    // Tạo admin mặc định (password: Admin@123)
    const adminHash = await hashPassword('Admin@123')
    const hrHash = await hashPassword('Hcns@123')
    // Check existing and update password if needed
    const existAdmin = await db.prepare('SELECT id FROM hr_users WHERE username = ?').bind('admin').first()
    if (existAdmin) {
      await db.prepare('UPDATE hr_users SET password_hash = ? WHERE username = ?').bind(adminHash, 'admin').run()
    } else {
      await db.prepare(`INSERT INTO hr_users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)`).bind('admin', adminHash, 'Quản trị HCNS', 'admin@onecad.vn', 'hr_admin').run()
    }
    const existHcns = await db.prepare('SELECT id FROM hr_users WHERE username = ?').bind('hcns').first()
    if (existHcns) {
      await db.prepare('UPDATE hr_users SET password_hash = ? WHERE username = ?').bind(hrHash, 'hcns').run()
    } else {
      await db.prepare(`INSERT INTO hr_users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)`).bind('hcns', hrHash, 'Nhân viên HCNS', 'hcns@onecad.vn', 'hr_staff').run()
    }

    // Cấu hình nguồn dữ liệu (dùng Cloudflare D1 HTTP API)
    await db.prepare(`INSERT OR IGNORE INTO data_sources (app_name, cf_account_id, cf_database_id, cf_api_token) VALUES (?, ?, ?, ?)`).bind('BIM', '', '', '').run()
    await db.prepare(`INSERT OR IGNORE INTO data_sources (app_name, cf_account_id, cf_database_id, cf_api_token) VALUES (?, ?, ?, ?)`).bind('C3D', '', '', '').run()

    return c.json({ success: true, message: 'Hệ thống đã được khởi tạo thành công!' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ===== DASHBOARD =====
app.get('/api/dashboard/stats', authMiddleware, async (c) => {
  const db = c.env.DB
  const today = new Date().toISOString().split('T')[0]
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const totalEmp = await db.prepare(`SELECT COUNT(*) as cnt FROM employees WHERE is_active = 1`).first() as any
  const bimEmp = await db.prepare(`SELECT COUNT(*) as cnt FROM employees WHERE source_app = 'BIM' AND is_active = 1`).first() as any
  const c3dEmp = await db.prepare(`SELECT COUNT(*) as cnt FROM employees WHERE source_app = 'C3D' AND is_active = 1`).first() as any
  const activeContracts = await db.prepare(`SELECT COUNT(*) as cnt FROM contracts WHERE status = 'active'`).first() as any
  const expiringContracts = await db.prepare(`SELECT COUNT(*) as cnt FROM contracts WHERE status = 'active' AND end_date IS NOT NULL AND end_date BETWEEN ? AND ?`).bind(today, in30days).first() as any
  const urgentReminders = await db.prepare(`SELECT COUNT(*) as cnt FROM hr_reminders WHERE is_resolved = 0 AND remind_date <= ?`).bind(in7days).first() as any
  const pendingLeave = await db.prepare(`SELECT COUNT(*) as cnt FROM leave_records WHERE status = 'pending'`).first() as any

  // Hợp đồng sắp hết hạn (chi tiết)
  const expiringList = await db.prepare(`
    SELECT c.*, e.full_name, e.source_app, e.department, e.position
    FROM contracts c JOIN employees e ON c.employee_id = e.id
    WHERE c.status = 'active' AND c.end_date IS NOT NULL AND c.end_date BETWEEN ? AND ?
    ORDER BY c.end_date ASC LIMIT 10
  `).bind(today, in30days).all()

  // Nhắc nhở chưa xử lý
  const reminderList = await db.prepare(`
    SELECT r.*, e.full_name, e.source_app
    FROM hr_reminders r LEFT JOIN employees e ON r.employee_id = e.id
    WHERE r.is_resolved = 0 AND r.remind_date <= ?
    ORDER BY r.remind_date ASC, r.priority DESC LIMIT 10
  `).bind(in7days).all()

  // Thống kê theo phòng ban
  const byDept = await db.prepare(`
    SELECT department, COUNT(*) as cnt FROM employees WHERE is_active = 1 GROUP BY department ORDER BY cnt DESC
  `).all()

  // Thống kê theo nguồn
  const bySource = await db.prepare(`
    SELECT source_app, COUNT(*) as cnt FROM employees WHERE is_active = 1 GROUP BY source_app
  `).all()

  return c.json({
    stats: {
      total_employees: totalEmp?.cnt || 0,
      bim_employees: bimEmp?.cnt || 0,
      c3d_employees: c3dEmp?.cnt || 0,
      active_contracts: activeContracts?.cnt || 0,
      expiring_contracts: expiringContracts?.cnt || 0,
      urgent_reminders: urgentReminders?.cnt || 0,
      pending_leave: pendingLeave?.cnt || 0
    },
    expiring_contracts: expiringList.results,
    reminders: reminderList.results,
    by_department: byDept.results,
    by_source: bySource.results
  })
})

// ===== EMPLOYEES =====
app.get('/api/employees', authMiddleware, async (c) => {
  const db = c.env.DB
  const { search, source, department, is_active, page = '1', limit = '20' } = c.req.query()
  const offset = (parseInt(page) - 1) * parseInt(limit)

  let where = ['1=1']
  let params: any[] = []

  if (search) { where.push(`(e.full_name LIKE ? OR e.username LIKE ? OR e.email LIKE ? OR e.employee_code LIKE ?)`); const q = `%${search}%`; params.push(q, q, q, q) }
  if (source) { where.push(`e.source_app = ?`); params.push(source) }
  if (department) { where.push(`e.department = ?`); params.push(department) }
  if (is_active !== undefined) { where.push(`e.is_active = ?`); params.push(parseInt(is_active)) }

  const whereStr = where.join(' AND ')
  const total = await db.prepare(`SELECT COUNT(*) as cnt FROM employees e WHERE ${whereStr}`).bind(...params).first() as any
  const rows = await db.prepare(`
    SELECT e.*, 
      (SELECT COUNT(*) FROM contracts c WHERE c.employee_id = e.id AND c.status = 'active') as active_contracts,
      (SELECT MAX(c.end_date) FROM contracts c WHERE c.employee_id = e.id AND c.status = 'active') as latest_contract_end
    FROM employees e WHERE ${whereStr}
    ORDER BY e.source_app, e.full_name
    LIMIT ? OFFSET ?
  `).bind(...params, parseInt(limit), offset).all()

  return c.json({ data: rows.results, total: total?.cnt || 0, page: parseInt(page), limit: parseInt(limit) })
})

app.get('/api/employees/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const emp = await db.prepare(`SELECT * FROM employees WHERE id = ?`).bind(id).first()
  if (!emp) return c.json({ error: 'Không tìm thấy nhân viên' }, 404)
  const contracts = await db.prepare(`SELECT * FROM contracts WHERE employee_id = ? ORDER BY created_at DESC`).bind(id).all()
  const leaves = await db.prepare(`SELECT * FROM leave_records WHERE employee_id = ? ORDER BY start_date DESC LIMIT 20`).bind(id).all()
  const history = await db.prepare(`
    SELECT eh.*, hu.full_name as changed_by_name FROM employee_history eh
    LEFT JOIN hr_users hu ON eh.changed_by = hu.id
    WHERE eh.employee_id = ? ORDER BY eh.created_at DESC LIMIT 20
  `).bind(id).all()
  return c.json({ employee: emp, contracts: contracts.results, leaves: leaves.results, history: history.results })
})

app.put('/api/employees/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const user = c.get('user')
  const body = await c.req.json()

  const old = await db.prepare(`SELECT * FROM employees WHERE id = ?`).bind(id).first() as any
  if (!old) return c.json({ error: 'Không tìm thấy nhân viên' }, 404)

  const fields = ['employee_code','date_of_birth','gender','id_number','id_issue_date','id_issue_place','address','current_address','join_date','probation_start','probation_end','official_start','position','education','major','university','graduation_year','social_insurance','health_insurance','tax_code','bank_account','bank_name','bank_branch','notes','department','phone','email','salary_monthly']
  const sets: string[] = []
  const vals: any[] = []

  for (const f of fields) {
    if (body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(body[f]) }
  }
  if (sets.length === 0) return c.json({ error: 'Không có dữ liệu cập nhật' }, 400)

  sets.push('updated_at = CURRENT_TIMESTAMP')
  vals.push(id)
  await db.prepare(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run()

  // Ghi lịch sử
  for (const f of fields) {
    if (body[f] !== undefined && String(old[f]) !== String(body[f])) {
      await db.prepare(`INSERT INTO employee_history (employee_id, changed_by, field_changed, old_value, new_value) VALUES (?, ?, ?, ?, ?)`).bind(id, user.id, f, old[f], body[f]).run()
    }
  }

  const updated = await db.prepare(`SELECT * FROM employees WHERE id = ?`).bind(id).first()
  return c.json({ success: true, employee: updated })
})

// Thêm nhân viên thủ công
app.post('/api/employees', authMiddleware, async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { source_app = 'MANUAL', full_name, username, email, phone, department, position, join_date, notes } = body
  if (!full_name) return c.json({ error: 'Họ tên là bắt buộc' }, 400)

  // Lấy ID mới cho manual
  const maxId = await db.prepare(`SELECT MAX(source_id) as m FROM employees WHERE source_app = 'MANUAL'`).first() as any
  const newSourceId = (maxId?.m || 0) + 1

  const empCode = `MANUAL-${String(newSourceId).padStart(4, '0')}`
  const result = await db.prepare(`
    INSERT INTO employees (source_app, source_id, username, full_name, email, phone, department, position, join_date, notes, employee_code, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).bind(source_app, newSourceId, username || empCode, full_name, email, phone, department, position, join_date, notes, empCode).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

// ===== CONTRACTS =====
app.get('/api/contracts', authMiddleware, async (c) => {
  const db = c.env.DB
  const { employee_id, status, expiring_days } = c.req.query()

  let where = ['1=1']
  let params: any[] = []

  if (employee_id) { where.push('c.employee_id = ?'); params.push(employee_id) }
  if (status) { where.push('c.status = ?'); params.push(status) }
  if (expiring_days) {
    const futureDate = new Date(Date.now() + parseInt(expiring_days) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    where.push('c.end_date IS NOT NULL AND c.end_date BETWEEN ? AND ?')
    params.push(today, futureDate)
  }

  const rows = await db.prepare(`
    SELECT c.*, e.full_name, e.source_app, e.department, e.employee_code
    FROM contracts c JOIN employees e ON c.employee_id = e.id
    WHERE ${where.join(' AND ')} ORDER BY c.end_date ASC, c.created_at DESC
  `).bind(...params).all()

  return c.json({ data: rows.results })
})

app.post('/api/contracts', authMiddleware, async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const body = await c.req.json()
  const { employee_id, contract_number, contract_type, start_date, end_date, salary, position, department, signed_date, renewal_reminder_days = 30, notes } = body

  if (!employee_id || !contract_number || !contract_type || !start_date) return c.json({ error: 'Thiếu thông tin bắt buộc' }, 400)

  const result = await db.prepare(`
    INSERT INTO contracts (employee_id, contract_number, contract_type, start_date, end_date, salary, position, department, signed_date, renewal_reminder_days, notes, created_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).bind(employee_id, contract_number, contract_type, start_date, end_date, salary, position, department, signed_date, renewal_reminder_days, notes, user.id).run()

  // Tự tạo nhắc nhở nếu có end_date
  if (end_date) {
    const remindDate = new Date(new Date(end_date).getTime() - renewal_reminder_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const emp = await db.prepare(`SELECT full_name FROM employees WHERE id = ?`).bind(employee_id).first() as any
    await db.prepare(`
      INSERT INTO hr_reminders (employee_id, contract_id, reminder_type, title, description, remind_date, priority)
      VALUES (?, ?, 'contract_expiry', ?, ?, ?, 'high')
    `).bind(employee_id, result.meta.last_row_id, `HĐ sắp hết hạn: ${emp?.full_name}`, `Hợp đồng ${contract_number} hết hạn vào ${end_date}`, remindDate).run()
  }

  return c.json({ success: true, id: result.meta.last_row_id })
})

app.put('/api/contracts/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const fields = ['contract_type','start_date','end_date','salary','position','department','status','signed_date','renewal_reminder_days','notes','file_url']
  const sets: string[] = []
  const vals: any[] = []
  for (const f of fields) { if (body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(body[f]) } }
  if (sets.length === 0) return c.json({ error: 'Không có dữ liệu' }, 400)
  sets.push('updated_at = CURRENT_TIMESTAMP')
  vals.push(id)
  await db.prepare(`UPDATE contracts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run()
  return c.json({ success: true })
})

app.delete('/api/contracts/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare('DELETE FROM contracts WHERE id = ?').bind(id).run()
  await db.prepare('DELETE FROM hr_reminders WHERE contract_id = ?').bind(id).run()
  return c.json({ success: true })
})

// ===== LEAVE RECORDS =====
app.get('/api/leaves', authMiddleware, async (c) => {
  const db = c.env.DB
  const { employee_id, status } = c.req.query()
  let where = ['1=1']; let params: any[] = []
  if (employee_id) { where.push('l.employee_id = ?'); params.push(employee_id) }
  if (status) { where.push('l.status = ?'); params.push(status) }
  const rows = await db.prepare(`
    SELECT l.*, e.full_name, e.source_app, e.department
    FROM leave_records l JOIN employees e ON l.employee_id = e.id
    WHERE ${where.join(' AND ')} ORDER BY l.start_date DESC
  `).bind(...params).all()
  return c.json({ data: rows.results })
})

app.post('/api/leaves', authMiddleware, async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { employee_id, leave_type, start_date, end_date, days, reason, notes } = body
  if (!employee_id || !leave_type || !start_date || !end_date) return c.json({ error: 'Thiếu thông tin' }, 400)
  const result = await db.prepare(`
    INSERT INTO leave_records (employee_id, leave_type, start_date, end_date, days, reason, notes) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(employee_id, leave_type, start_date, end_date, days || 1, reason, notes).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

app.put('/api/leaves/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = c.req.param('id')
  const { status, notes } = await c.req.json()
  await db.prepare(`UPDATE leave_records SET status = ?, notes = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(status, notes, user.id, id).run()
  return c.json({ success: true })
})

// ===== REMINDERS =====
app.get('/api/reminders', authMiddleware, async (c) => {
  const db = c.env.DB
  const { days = '30', is_resolved = '0' } = c.req.query()
  const futureDate = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const rows = await db.prepare(`
    SELECT r.*, e.full_name, e.source_app, e.department, e.employee_code,
      CAST(julianday(r.remind_date) - julianday(?) AS INTEGER) as days_remaining
    FROM hr_reminders r LEFT JOIN employees e ON r.employee_id = e.id
    WHERE r.is_resolved = ? AND r.remind_date <= ?
    ORDER BY r.remind_date ASC, r.priority DESC
  `).bind(today, parseInt(is_resolved), futureDate).all()

  return c.json({ data: rows.results })
})

app.post('/api/reminders', authMiddleware, async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { employee_id, contract_id, reminder_type, title, description, remind_date, priority = 'medium' } = body
  if (!title || !remind_date) return c.json({ error: 'Thiếu thông tin' }, 400)
  const result = await db.prepare(`
    INSERT INTO hr_reminders (employee_id, contract_id, reminder_type, title, description, remind_date, priority) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(employee_id, contract_id, reminder_type || 'other', title, description, remind_date, priority).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

app.put('/api/reminders/:id/resolve', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`UPDATE hr_reminders SET is_resolved = 1 WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

app.delete('/api/reminders/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare('DELETE FROM hr_reminders WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ===== DATA SOURCES & SYNC (Cloudflare D1 HTTP API) =====
app.get('/api/data-sources', authMiddleware, async (c) => {
  const db = c.env.DB
  const rows = await db.prepare('SELECT id, app_name, cf_account_id, cf_database_id, last_sync, sync_status, sync_message, is_active, created_at FROM data_sources ORDER BY app_name').all()
  return c.json({ data: rows.results })
})

app.put('/api/data-sources/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { cf_account_id, cf_database_id, cf_api_token, is_active } = await c.req.json()
  // Nếu token để trống → giữ nguyên token cũ (không ghi đè bằng null)
  if (cf_api_token) {
    await db.prepare(
      'UPDATE data_sources SET cf_account_id = ?, cf_database_id = ?, cf_api_token = ?, is_active = ? WHERE id = ?'
    ).bind(cf_account_id, cf_database_id, cf_api_token, is_active ?? 1, id).run()
  } else {
    await db.prepare(
      'UPDATE data_sources SET cf_account_id = ?, cf_database_id = ?, is_active = ? WHERE id = ?'
    ).bind(cf_account_id, cf_database_id, is_active ?? 1, id).run()
  }
  return c.json({ success: true })
})

// Test kết nối D1 HTTP API
app.post('/api/sync/:appName/test', authMiddleware, async (c) => {
  const db = c.env.DB
  const appName = c.req.param('appName').toUpperCase()
  const source = await db.prepare('SELECT * FROM data_sources WHERE app_name = ?').bind(appName).first() as any
  if (!source) return c.json({ error: 'Không tìm thấy nguồn' }, 404)
  if (!source.cf_account_id || !source.cf_database_id || !source.cf_api_token) {
    return c.json({ error: 'Chưa nhập đủ Account ID, Database ID và API Token' }, 400)
  }
  try {
    const res = await queryD1(source.cf_account_id, source.cf_database_id, source.cf_api_token, 'SELECT COUNT(*) as cnt FROM users')
    const cnt = res?.[0]?.cnt ?? 0
    return c.json({ success: true, message: `Kết nối thành công! Tìm thấy ${cnt} nhân viên trong database ${appName}.` })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Hàm gọi Cloudflare D1 HTTP API
async function queryD1(accountId: string, databaseId: string, apiToken: string, sql: string, params: any[] = []): Promise<any[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`D1 API lỗi ${res.status}: ${errText.slice(0, 200)}`)
  }
  const data: any = await res.json()
  if (!data.success) {
    const errMsg = data.errors?.map((e: any) => e.message).join(', ') || 'Unknown D1 error'
    throw new Error(`D1 query thất bại: ${errMsg}`)
  }
  return data.result?.[0]?.results ?? []
}

// Sync nhân viên từ app nguồn qua Cloudflare D1 HTTP API
app.post('/api/sync/:appName', authMiddleware, async (c) => {
  const db = c.env.DB
  const appName = c.req.param('appName').toUpperCase()
  const source = await db.prepare('SELECT * FROM data_sources WHERE app_name = ? AND is_active = 1').bind(appName).first() as any
  if (!source) return c.json({ error: 'Nguồn dữ liệu không tồn tại hoặc chưa kích hoạt' }, 404)

  if (!source.cf_account_id || !source.cf_database_id || !source.cf_api_token) {
    return c.json({ error: 'Chưa cấu hình đủ thông tin Cloudflare (Account ID, Database ID, API Token)' }, 400)
  }

  try {
    // Query trực tiếp bảng users từ D1 database của app nguồn
    // Lấy đầy đủ các cột bao gồm thông tin cá nhân mở rộng (migration 0018-0020)
    // Dùng COALESCE để tương thích cả database cũ (chưa có các cột mở rộng)
    const users = await queryD1(
      source.cf_account_id,
      source.cf_database_id,
      source.cf_api_token,
      `SELECT
         id, username, full_name, email, phone, role, department, salary_monthly, is_active, avatar,
         COALESCE(cccd, '')            AS cccd,
         COALESCE(birthday, '')        AS birthday,
         COALESCE(address, '')         AS address,
         COALESCE(current_address, '') AS current_address,
         COALESCE(major, '')           AS major,
         COALESCE(university, '')      AS university,
         COALESCE(graduation_year, 0)  AS graduation_year,
         COALESCE(degree, '')          AS degree
       FROM users WHERE is_active = 1 ORDER BY id`
    )

    if (!users || users.length === 0) {
      await db.prepare(`UPDATE data_sources SET last_sync = CURRENT_TIMESTAMP, sync_status = 'success', sync_message = 'Không có nhân viên nào' WHERE app_name = ?`).bind(appName).run()
      return c.json({ success: true, added: 0, updated: 0, total: 0 })
    }

    let added = 0, updated = 0
    for (const u of users) {
      const existing = await db.prepare('SELECT id FROM employees WHERE source_app = ? AND source_id = ?').bind(appName, u.id).first() as any
      if (existing) {
        // Cập nhật thông tin từ app nguồn — CHỈ ghi đè các trường đến từ nguồn,
        // KHÔNG đụng vào các trường HCNS bổ sung (join_date, contracts, insurance, bank...)
        await db.prepare(
          `UPDATE employees SET
             username = ?, full_name = ?, email = ?, phone = ?, role = ?,
             department = ?, salary_monthly = ?, is_active = ?,
             id_number    = CASE WHEN ? != '' THEN ? ELSE id_number END,
             date_of_birth= CASE WHEN ? != '' THEN ? ELSE date_of_birth END,
             address      = CASE WHEN ? != '' THEN ? ELSE address END,
             current_address = CASE WHEN ? != '' THEN ? ELSE current_address END,
             major        = CASE WHEN ? != '' THEN ? ELSE major END,
             education    = CASE WHEN ? != '' THEN ? ELSE education END,
             university   = CASE WHEN ? != '' THEN ? ELSE university END,
             graduation_year = CASE WHEN ? != 0 THEN ? ELSE graduation_year END,
             synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE source_app = ? AND source_id = ?`
        ).bind(
          u.username, u.full_name, u.email, u.phone, u.role,
          u.department, u.salary_monthly ?? 0, u.is_active ?? 1,
          u.cccd, u.cccd,
          u.birthday, u.birthday,
          u.address, u.address,
          u.current_address, u.current_address,
          u.major, u.major,
          u.degree, u.degree,
          u.university, u.university,
          u.graduation_year ?? 0, u.graduation_year ?? 0,
          appName, u.id
        ).run()
        updated++
      } else {
        const empCode = `${appName}-${String(u.id).padStart(4, '0')}`
        await db.prepare(
          `INSERT INTO employees (
             source_app, source_id, username, full_name, email, phone, role,
             department, salary_monthly, is_active, employee_code,
             id_number, date_of_birth, address, current_address,
             major, education, university, graduation_year,
             synced_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(
          appName, u.id, u.username, u.full_name, u.email, u.phone, u.role,
          u.department, u.salary_monthly ?? 0, u.is_active ?? 1, empCode,
          u.cccd || null,
          u.birthday || null,
          u.address || null,
          u.current_address || null,
          u.major || null,
          u.degree || null,
          u.university || null,
          u.graduation_year || null
        ).run()
        added++
      }
    }

    await db.prepare(
      `UPDATE data_sources SET last_sync = CURRENT_TIMESTAMP, sync_status = 'success', sync_message = ? WHERE app_name = ?`
    ).bind(`Đồng bộ thành công: +${added} mới, ~${updated} cập nhật (tổng ${users.length})`, appName).run()

    return c.json({ success: true, added, updated, total: users.length })
  } catch (e: any) {
    await db.prepare(
      `UPDATE data_sources SET sync_status = 'error', sync_message = ? WHERE app_name = ?`
    ).bind(e.message, appName).run()
    return c.json({ error: e.message }, 500)
  }
})

// ===== HR USERS MANAGEMENT =====
app.get('/api/hr-users', authMiddleware, async (c) => {
  const db = c.env.DB
  const users = await db.prepare('SELECT id, username, full_name, email, role, is_active, created_at FROM hr_users ORDER BY role, full_name').all()
  return c.json({ data: users.results })
})

app.post('/api/hr-users', authMiddleware, async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  if (user.role !== 'hr_admin') return c.json({ error: 'Không có quyền' }, 403)
  const { username, password, full_name, email, role = 'hr_staff' } = await c.req.json()
  if (!username || !password || !full_name) return c.json({ error: 'Thiếu thông tin' }, 400)
  const hash = await hashPassword(password)
  const result = await db.prepare('INSERT INTO hr_users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)').bind(username, hash, full_name, email, role).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

// ===== REPORTS =====
app.get('/api/reports/employees', authMiddleware, async (c) => {
  const db = c.env.DB
  // Nhân viên chưa có HĐ chính thức
  const noContract = await db.prepare(`
    SELECT e.* FROM employees e 
    WHERE e.is_active = 1 AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.employee_id = e.id AND c.contract_type IN ('fixed_term','indefinite') AND c.status = 'active')
    ORDER BY e.source_app, e.full_name
  `).all()

  // Nhân viên sắp hết thử việc
  const endProbation = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]
  const probationEnding = await db.prepare(`
    SELECT * FROM employees WHERE probation_end BETWEEN ? AND ? AND is_active = 1 ORDER BY probation_end
  `).bind(today, endProbation).all()

  // Nhân viên thiếu thông tin HCNS
  const missingInfo = await db.prepare(`
    SELECT id, full_name, source_app, employee_code,
      CASE WHEN date_of_birth IS NULL THEN 1 ELSE 0 END as no_dob,
      CASE WHEN id_number IS NULL THEN 1 ELSE 0 END as no_id,
      CASE WHEN tax_code IS NULL THEN 1 ELSE 0 END as no_tax,
      CASE WHEN social_insurance IS NULL THEN 1 ELSE 0 END as no_si,
      CASE WHEN bank_account IS NULL THEN 1 ELSE 0 END as no_bank
    FROM employees WHERE is_active = 1 
    AND (date_of_birth IS NULL OR id_number IS NULL OR tax_code IS NULL OR social_insurance IS NULL OR bank_account IS NULL)
    ORDER BY source_app, full_name
  `).all()

  return c.json({
    no_formal_contract: noContract.results,
    probation_ending: probationEnding.results,
    missing_info: missingInfo.results
  })
})

// ===== STATIC FILES =====
app.use('/static/*', serveStatic({ root: './public' }))

// ===== FRONTEND =====
app.get('*', (c) => {
  return c.html(getHTML())
})

function getHTML(): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OneCad - Hệ thống Quản lý HCNS</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  /* ===== DESIGN SYSTEM - ONCAD HCNS ===== */
  :root {
    --primary: #00A651; --primary-dark: #008C44; --primary-light: #e8f8ef;
    --accent: #0066CC; --accent-light: #e8f1fb;
    --warning: #FF6B00; --danger: #EF4444; --danger-light: #fef2f2;
    --text-heading: #0f172a; --text-body: #334155; --text-muted: #64748b; --text-faint: #94a3b8;
    --border: #e2e8f0; --border-focus: #00A651;
    --bg-page: #f1f5f9; --bg-card: #ffffff; --bg-input: #ffffff; --bg-hover: #f8fafc;
    --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;
    --shadow-sm: 0 1px 4px rgba(0,0,0,0.06); --shadow-md: 0 2px 12px rgba(0,0,0,0.08); --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
    --font-size-xs: 11px; --font-size-sm: 12px; --font-size-base: 13px; --font-size-md: 14px; --font-size-lg: 15px; --font-size-xl: 16px;
  }

  /* ===== BASE ===== */
  * { font-family: 'Segoe UI', -apple-system, system-ui, sans-serif; box-sizing: border-box; }
  body { font-size: var(--font-size-base); color: var(--text-body); background: var(--bg-page); }

  /* ===== LAYOUT ===== */
  .sidebar { background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%); }
  .nav-item { transition: all 0.2s; border-radius: var(--radius-md); font-size: var(--font-size-base); }
  .nav-item:hover { background: rgba(0,166,81,0.15); color: #4ade80; }
  .nav-item.active { background: rgba(0,166,81,0.22); color: #00A651; border-left: 3px solid #00A651; }
  .card { background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); transition: box-shadow 0.2s; }
  .card:hover { box-shadow: var(--shadow-lg); }

  /* ===== BUTTONS ===== */
  .btn-primary {
    background: var(--primary); color: #fff; border-radius: var(--radius-md);
    padding: 8px 16px; font-size: var(--font-size-md); font-weight: 500;
    line-height: 1.4; transition: all 0.2s; cursor: pointer; border: none;
    display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
  }
  .btn-primary:hover { background: var(--primary-dark); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,166,81,0.3); }
  .btn-secondary {
    background: var(--accent); color: #fff; border-radius: var(--radius-md);
    padding: 8px 16px; font-size: var(--font-size-md); font-weight: 500;
    cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 6px;
  }
  .btn-secondary:hover { background: #0052a3; }
  .btn-danger {
    background: var(--danger); color: #fff; border-radius: var(--radius-md);
    padding: 8px 16px; font-size: var(--font-size-md); font-weight: 500;
    cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 6px;
  }
  .btn-ghost {
    background: transparent; color: var(--text-muted); border-radius: var(--radius-md);
    padding: 8px 16px; font-size: var(--font-size-md); font-weight: 500;
    cursor: pointer; border: 1.5px solid var(--border); display: inline-flex; align-items: center; gap: 6px;
  }
  .btn-ghost:hover { background: var(--bg-hover); color: var(--text-heading); }

  /* ===== BADGES ===== */
  .badge-bim    { background: #dbeafe; color: #1d4ed8; padding: 2px 10px; border-radius: 20px; font-size: var(--font-size-xs); font-weight: 700; letter-spacing: 0.04em; display: inline-block; }
  .badge-c3d    { background: #dcfce7; color: #15803d; padding: 2px 10px; border-radius: 20px; font-size: var(--font-size-xs); font-weight: 700; letter-spacing: 0.04em; display: inline-block; }
  .badge-manual { background: #fef3c7; color: #b45309; padding: 2px 10px; border-radius: 20px; font-size: var(--font-size-xs); font-weight: 700; letter-spacing: 0.04em; display: inline-block; }
  .badge-active   { background: #dcfce7; color: #15803d; padding: 2px 10px; border-radius: 20px; font-size: var(--font-size-xs); font-weight: 600; display: inline-block; }
  .badge-inactive { background: #fee2e2; color: #dc2626; padding: 2px 10px; border-radius: 20px; font-size: var(--font-size-xs); font-weight: 600; display: inline-block; }
  .badge-warning  { background: #fef3c7; color: #d97706; padding: 2px 10px; border-radius: 20px; font-size: var(--font-size-xs); font-weight: 600; display: inline-block; }

  /* ===== KPI CARDS ===== */
  .kpi-card { border-radius: var(--radius-lg); padding: 20px 24px; color: white; }

  /* ===== TABLE ===== */
  .table-row:hover { background: #f0f7ff; }
  table { font-size: var(--font-size-base); }
  thead th { font-size: var(--font-size-xs); font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 14px; }
  tbody td { padding: 11px 14px; color: var(--text-body); vertical-align: middle; }

  /* ===== MODAL ===== */
  .modal-overlay { background: rgba(15,23,42,0.55); backdrop-filter: blur(4px); }
  .modal-content { border-radius: var(--radius-xl); max-height: 92vh; overflow-y: auto; }
  .modal-header { padding: 18px 24px; border-bottom: 1px solid var(--border); }
  .modal-header h3 { font-size: var(--font-size-lg); font-weight: 700; color: var(--text-heading); }
  .modal-body { padding: 20px 24px; }
  .modal-footer { padding: 14px 24px; border-top: 1px solid var(--border); background: var(--bg-hover); }

  /* ===== FORM CONTROLS ===== */
  input, select, textarea {
    border: 1.5px solid var(--border); border-radius: var(--radius-md);
    padding: 8px 12px; width: 100%; font-size: var(--font-size-base); line-height: 1.5;
    color: var(--text-heading); background: var(--bg-input);
    transition: border-color 0.2s, box-shadow 0.2s;
    min-height: 38px;
  }
  input::placeholder, textarea::placeholder { color: var(--text-faint); font-size: var(--font-size-sm); }
  input:focus, select:focus, textarea:focus {
    outline: none; border-color: var(--border-focus); box-shadow: 0 0 0 3px rgba(0,166,81,0.12);
  }
  select { min-height: 38px; cursor: pointer; }
  textarea { resize: vertical; min-height: 68px; }

  /* Labels */
  label, .field-label {
    font-size: var(--font-size-sm); font-weight: 600; color: var(--text-muted);
    display: block; margin-bottom: 4px; line-height: 1.4;
  }

  /* Form sections */
  .form-section {
    font-size: var(--font-size-xs); font-weight: 700; color: var(--text-faint);
    text-transform: uppercase; letter-spacing: 0.07em;
    margin: 18px 0 10px; padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 6px;
  }
  .form-section::before { content: ''; width: 3px; height: 14px; background: var(--primary); border-radius: 2px; flex-shrink: 0; }

  /* ===== TABS ===== */
  .tab-btn {
    padding: 7px 14px; border-radius: var(--radius-md); cursor: pointer;
    font-size: var(--font-size-base); font-weight: 500; transition: all 0.18s;
    color: var(--text-muted); white-space: nowrap;
  }
  .tab-btn:hover { background: #f1f5f9; color: var(--text-heading); }
  .tab-btn.active { background: var(--primary); color: white; box-shadow: 0 2px 8px rgba(0,166,81,0.3); }

  /* ===== INFO CELLS (view mode) ===== */
  .info-cell { background: var(--bg-hover); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px 14px; }
  .info-cell .lbl { font-size: var(--font-size-xs); color: var(--text-faint); font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
  .info-cell .val { font-size: var(--font-size-base); color: var(--text-heading); font-weight: 500; line-height: 1.4; }

  /* ===== URGENCY INDICATORS ===== */
  .urgency-urgent { border-left: 4px solid var(--danger); }
  .urgency-high   { border-left: 4px solid var(--warning); }
  .urgency-medium { border-left: 4px solid #F59E0B; }
  .urgency-low    { border-left: 4px solid #9CA3AF; }

  /* ===== SCROLLBAR ===== */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #f1f5f9; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  /* ===== ANIMATIONS ===== */
  @keyframes slideIn { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  .toast { animation: slideIn 0.25s ease; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading { display: inline-block; width: 20px; height: 20px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 0.75s linear infinite; }

  /* ===== LOGIN SCREEN ===== */
  .login-card { box-shadow: 0 25px 60px rgba(0,0,0,0.35); }
  .login-input-wrap { position: relative; }
  .login-input-wrap i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 14px; pointer-events: none; }
  .login-input-wrap input { padding-left: 40px; font-size: var(--font-size-md); height: 46px; }

  /* ===== SECTION DIVIDERS ===== */
  .section-title {
    font-size: var(--font-size-xs); font-weight: 700; color: var(--text-faint);
    text-transform: uppercase; letter-spacing: 0.06em;
    display: flex; align-items: center; gap-8px; margin-bottom: 10px;
  }
</style>
</head>
<body class="bg-gray-50">

<!-- Login Screen -->
<div id="loginScreen" class="min-h-screen flex items-center justify-center" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f3460 100%);">
  <div class="bg-white rounded-2xl login-card p-8 w-full" style="max-width:420px">
    <!-- Logo & Title -->
    <div class="text-center mb-8">
      <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:linear-gradient(135deg,#00A651,#0066CC)">
        <i class="fas fa-users-cog text-white" style="font-size:26px"></i>
      </div>
      <h1 style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">OneCad HCNS</h1>
      <p style="font-size:13px;color:#64748b;margin-top:4px">Hệ thống Quản lý Hành chính Nhân sự</p>
    </div>

    <!-- Form -->
    <div style="display:flex;flex-direction:column;gap:16px">
      <div>
        <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:6px">Tên đăng nhập</label>
        <div class="login-input-wrap">
          <i class="fas fa-user"></i>
          <input id="loginUsername" type="text" placeholder="Nhập tên đăng nhập" onkeypress="if(event.key==='Enter')login()">
        </div>
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:6px">Mật khẩu</label>
        <div class="login-input-wrap">
          <i class="fas fa-lock"></i>
          <input id="loginPassword" type="password" placeholder="Nhập mật khẩu" onkeypress="if(event.key==='Enter')login()">
        </div>
      </div>
      <button onclick="login()" class="btn-primary" style="width:100%;justify-content:center;height:46px;font-size:15px;font-weight:600;margin-top:4px">
        <i class="fas fa-sign-in-alt"></i>Đăng nhập
      </button>
    </div>

    <!-- Demo credentials -->
    <div style="margin-top:20px;padding:12px 16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
      <p style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Tài khoản demo</p>
      <div style="display:flex;gap:16px;font-size:12px;color:#475569">
        <span><strong>Admin:</strong> admin / Admin@123</span>
        <span><strong>HCNS:</strong> hcns / Hcns@123</span>
      </div>
    </div>
  </div>
</div>

<!-- Main App -->
<div id="mainApp" class="hidden flex h-screen overflow-hidden">
  <!-- Sidebar -->
  <div class="sidebar w-60 flex-shrink-0 flex flex-col text-white" style="min-width:240px">
    <!-- Brand -->
    <div style="padding:18px 20px;border-bottom:1px solid rgba(255,255,255,0.08)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#00A651,#0066CC);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas fa-users-cog" style="font-size:15px;color:#fff"></i>
        </div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#fff;line-height:1.2">OneCad HCNS</div>
          <div style="font-size:11px;color:#64748b;margin-top:1px">Quản lý Nhân sự</div>
        </div>
      </div>
    </div>

    <!-- Nav -->
    <nav style="flex:1;padding:12px 10px;overflow-y:auto;display:flex;flex-direction:column;gap:1px">
      <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.07em;padding:8px 10px 4px">Tổng quan</div>
      <a href="#" class="nav-item" style="display:flex;align-items:center;gap:10px;padding:8px 10px;color:#94a3b8;text-decoration:none" onclick="showPage('dashboard')">
        <i class="fas fa-tachometer-alt" style="width:16px;text-align:center;font-size:13px"></i><span style="font-size:13px">Dashboard</span>
      </a>

      <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.07em;padding:12px 10px 4px">Nhân sự</div>
      <a href="#" class="nav-item" style="display:flex;align-items:center;gap:10px;padding:8px 10px;color:#94a3b8;text-decoration:none" onclick="showPage('employees')">
        <i class="fas fa-users" style="width:16px;text-align:center;font-size:13px"></i><span style="font-size:13px">Danh sách nhân viên</span>
      </a>
      <a href="#" class="nav-item" style="display:flex;align-items:center;gap:10px;padding:8px 10px;color:#94a3b8;text-decoration:none" onclick="showPage('contracts')">
        <i class="fas fa-file-contract" style="width:16px;text-align:center;font-size:13px"></i><span style="font-size:13px;flex:1">Hợp đồng lao động</span>
        <span id="contractBadge" style="background:#ef4444;color:#fff;font-size:10px;border-radius:10px;padding:1px 6px;display:none;font-weight:700">0</span>
      </a>
      <a href="#" class="nav-item" style="display:flex;align-items:center;gap:10px;padding:8px 10px;color:#94a3b8;text-decoration:none" onclick="showPage('leaves')">
        <i class="fas fa-calendar-minus" style="width:16px;text-align:center;font-size:13px"></i><span style="font-size:13px">Nghỉ phép</span>
      </a>

      <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.07em;padding:12px 10px 4px">Công cụ</div>
      <a href="#" class="nav-item" style="display:flex;align-items:center;gap:10px;padding:8px 10px;color:#94a3b8;text-decoration:none" onclick="showPage('reminders')">
        <i class="fas fa-bell" style="width:16px;text-align:center;font-size:13px"></i><span style="font-size:13px;flex:1">Nhắc nhở HCNS</span>
        <span id="reminderBadge" style="background:#f97316;color:#fff;font-size:10px;border-radius:10px;padding:1px 6px;display:none;font-weight:700">0</span>
      </a>
      <a href="#" class="nav-item" style="display:flex;align-items:center;gap:10px;padding:8px 10px;color:#94a3b8;text-decoration:none" onclick="showPage('reports')">
        <i class="fas fa-chart-bar" style="width:16px;text-align:center;font-size:13px"></i><span style="font-size:13px">Báo cáo HCNS</span>
      </a>

      <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.07em;padding:12px 10px 4px">Hệ thống</div>
      <a href="#" class="nav-item" style="display:flex;align-items:center;gap:10px;padding:8px 10px;color:#94a3b8;text-decoration:none" onclick="showPage('sync')">
        <i class="fas fa-sync-alt" style="width:16px;text-align:center;font-size:13px"></i><span style="font-size:13px">Đồng bộ dữ liệu</span>
      </a>
      <a href="#" class="nav-item" style="display:flex;align-items:center;gap:10px;padding:8px 10px;color:#94a3b8;text-decoration:none" onclick="showPage('settings')">
        <i class="fas fa-cog" style="width:16px;text-align:center;font-size:13px"></i><span style="font-size:13px">Cài đặt</span>
      </a>
    </nav>

    <!-- User footer -->
    <div style="padding:12px 14px;border-top:1px solid rgba(255,255,255,0.08)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div id="userAvatar" style="width:32px;height:32px;border-radius:50%;background:#00A651;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0">A</div>
        <div style="flex:1;min-width:0">
          <div id="userName" style="font-size:13px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Admin</div>
          <div id="userRole" style="font-size:11px;color:#64748b">hr_admin</div>
        </div>
      </div>
      <button onclick="logout()" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;color:#64748b;font-size:12px;background:none;border:none;cursor:pointer;padding:5px 6px;border-radius:6px;transition:color 0.2s" onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='#64748b'">
        <i class="fas fa-sign-out-alt"></i><span>Đăng xuất</span>
      </button>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Top Bar -->
    <div style="background:#fff;border-bottom:1px solid #e2e8f0;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <div>
        <h2 id="pageTitle" style="font-size:16px;font-weight:700;color:#0f172a;line-height:1.3">Dashboard</h2>
        <p id="pageSubtitle" style="font-size:12px;color:#64748b;margin-top:1px">Tổng quan hệ thống HCNS</p>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <div id="currentDateTime" style="font-size:12px;color:#64748b"></div>
        <div id="topUserAvatar" style="width:32px;height:32px;border-radius:50%;background:#00A651;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700">A</div>
      </div>
    </div>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto" style="padding:20px 24px" id="pageContent">
      <!-- Content loaded dynamically -->
    </div>
  </div>
</div>

<!-- Toast Container -->
<div id="toastContainer" class="fixed top-4 right-4 z-50 space-y-2"></div>

<!-- Modal Container -->
<div id="modalContainer"></div>

<script src="/static/app.js"></script>
</body>
</html>`
}

export default app
