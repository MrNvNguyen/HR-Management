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

    // Tạo bảng data_sources
    await db.prepare(`CREATE TABLE IF NOT EXISTS data_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT UNIQUE NOT NULL,
      api_url TEXT NOT NULL,
      api_token TEXT,
      last_sync DATETIME,
      sync_status TEXT DEFAULT 'pending',
      sync_message TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run()

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

    // Cấu hình nguồn dữ liệu
    await db.prepare(`INSERT OR IGNORE INTO data_sources (app_name, api_url) VALUES (?, ?)`).bind('BIM', 'https://bim-management.pages.dev').run()
    await db.prepare(`INSERT OR IGNORE INTO data_sources (app_name, api_url) VALUES (?, ?)`).bind('C3D', 'https://c3d-management.pages.dev').run()

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

  const fields = ['employee_code','date_of_birth','gender','id_number','id_issue_date','id_issue_place','address','current_address','join_date','probation_start','probation_end','official_start','position','education','major','social_insurance','health_insurance','tax_code','bank_account','bank_name','bank_branch','notes','department','phone','email','salary_monthly']
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

// ===== DATA SOURCES & SYNC =====
app.get('/api/data-sources', authMiddleware, async (c) => {
  const db = c.env.DB
  const rows = await db.prepare('SELECT * FROM data_sources ORDER BY app_name').all()
  return c.json({ data: rows.results })
})

app.put('/api/data-sources/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { api_url, api_token, is_active } = await c.req.json()
  await db.prepare('UPDATE data_sources SET api_url = ?, api_token = ?, is_active = ? WHERE id = ?').bind(api_url, api_token, is_active, id).run()
  return c.json({ success: true })
})

// Sync nhân viên từ app nguồn
app.post('/api/sync/:appName', authMiddleware, async (c) => {
  const db = c.env.DB
  const appName = c.req.param('appName').toUpperCase()
  const source = await db.prepare('SELECT * FROM data_sources WHERE app_name = ? AND is_active = 1').bind(appName).first() as any
  if (!source) return c.json({ error: 'Nguồn dữ liệu không tồn tại hoặc chưa kích hoạt' }, 404)

  try {
    // Gọi API app nguồn để lấy danh sách users
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (source.api_token) headers['Authorization'] = `Bearer ${source.api_token}`

    // Login để lấy token
    const loginRes = await fetch(`${source.api_url}/api/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
    })
    if (!loginRes.ok) throw new Error(`Không thể kết nối đến ${appName}: ${loginRes.status}`)

    const loginData: any = await loginRes.json()
    const token = loginData.token
    if (!token) throw new Error('Không lấy được token từ app nguồn')

    // Lấy danh sách users
    const usersRes = await fetch(`${source.api_url}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!usersRes.ok) throw new Error(`Lỗi lấy danh sách users: ${usersRes.status}`)
    const usersData: any = await usersRes.json()
    const users = usersData.users || usersData.data || []

    let added = 0, updated = 0
    for (const u of users) {
      const existing = await db.prepare('SELECT id FROM employees WHERE source_app = ? AND source_id = ?').bind(appName, u.id).first() as any
      if (existing) {
        // Cập nhật thông tin từ nguồn (chỉ các trường gốc)
        await db.prepare(`UPDATE employees SET username = ?, full_name = ?, email = ?, phone = ?, role = ?, department = ?, salary_monthly = ?, is_active = ?, synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE source_app = ? AND source_id = ?`
        ).bind(u.username, u.full_name, u.email, u.phone, u.role, u.department, u.salary_monthly, u.is_active, appName, u.id).run()
        updated++
      } else {
        // Thêm mới
        const empCode = `${appName}-${String(u.id).padStart(4, '0')}`
        await db.prepare(`INSERT INTO employees (source_app, source_id, username, full_name, email, phone, role, department, salary_monthly, is_active, employee_code, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(appName, u.id, u.username, u.full_name, u.email, u.phone, u.role, u.department, u.salary_monthly, u.is_active, empCode).run()
        added++
      }
    }

    // Cập nhật trạng thái sync
    await db.prepare(`UPDATE data_sources SET last_sync = CURRENT_TIMESTAMP, sync_status = 'success', sync_message = ? WHERE app_name = ?`).bind(`Đồng bộ thành công: +${added} mới, ~${updated} cập nhật`, appName).run()

    return c.json({ success: true, added, updated, total: users.length })
  } catch (e: any) {
    await db.prepare(`UPDATE data_sources SET sync_status = 'error', sync_message = ? WHERE app_name = ?`).bind(e.message, appName).run()
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
  :root { --primary: #00A651; --accent: #0066CC; --warning: #FF6B00; --danger: #EF4444; }
  * { font-family: 'Segoe UI', system-ui, sans-serif; }
  .sidebar { background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%); }
  .nav-item { transition: all 0.2s; border-radius: 8px; }
  .nav-item:hover, .nav-item.active { background: rgba(0,166,81,0.2); color: #00A651; }
  .nav-item.active { border-left: 3px solid #00A651; }
  .card { background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); transition: box-shadow 0.2s; }
  .card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
  .btn-primary { background: #00A651; color: white; border-radius: 8px; padding: 8px 16px; transition: all 0.2s; }
  .btn-primary:hover { background: #008C44; transform: translateY(-1px); }
  .btn-secondary { background: #0066CC; color: white; border-radius: 8px; padding: 8px 16px; }
  .btn-danger { background: #EF4444; color: white; border-radius: 8px; padding: 8px 16px; }
  .badge-bim { background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-c3d { background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-manual { background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-active { background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 20px; font-size: 11px; }
  .badge-inactive { background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 20px; font-size: 11px; }
  .badge-warning { background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 20px; font-size: 11px; }
  .kpi-card { border-radius: 12px; padding: 20px; color: white; }
  .table-row:hover { background: #f8fafc; }
  .modal-overlay { background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
  .modal-content { border-radius: 16px; max-height: 90vh; overflow-y: auto; }
  input, select, textarea { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; width: 100%; transition: border 0.2s; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #00A651; box-shadow: 0 0 0 3px rgba(0,166,81,0.1); }
  .tab-btn { padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
  .tab-btn.active { background: #00A651; color: white; }
  .urgency-urgent { border-left: 4px solid #EF4444; }
  .urgency-high { border-left: 4px solid #FF6B00; }
  .urgency-medium { border-left: 4px solid #F59E0B; }
  .urgency-low { border-left: 4px solid #6B7280; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #f1f5f9; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
  @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  .toast { animation: slideIn 0.3s ease; }
  .loading { display: inline-block; width: 20px; height: 20px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body class="bg-gray-50">

<!-- Login Screen -->
<div id="loginScreen" class="min-h-screen flex items-center justify-center" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);">
  <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
    <div class="text-center mb-8">
      <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:linear-gradient(135deg,#00A651,#0066CC)">
        <i class="fas fa-users-cog text-white text-2xl"></i>
      </div>
      <h1 class="text-2xl font-bold text-gray-800">OneCad HCNS</h1>
      <p class="text-gray-500 text-sm mt-1">Hệ thống Quản lý Hành chính Nhân sự</p>
    </div>
    <div class="space-y-4">
      <div>
        <label class="text-sm font-medium text-gray-700 block mb-1">Tên đăng nhập</label>
        <div class="relative">
          <i class="fas fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input id="loginUsername" type="text" placeholder="admin" class="pl-10" onkeypress="if(event.key==='Enter')login()">
        </div>
      </div>
      <div>
        <label class="text-sm font-medium text-gray-700 block mb-1">Mật khẩu</label>
        <div class="relative">
          <i class="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input id="loginPassword" type="password" placeholder="••••••••" class="pl-10" onkeypress="if(event.key==='Enter')login()">
        </div>
      </div>
      <button onclick="login()" class="btn-primary w-full py-3 font-semibold text-center block">
        <i class="fas fa-sign-in-alt mr-2"></i>Đăng nhập
      </button>
    </div>
    <div class="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
      <p><strong>Admin:</strong> admin / Admin@123</p>
      <p><strong>HCNS:</strong> hcns / Hcns@123</p>
    </div>
  </div>
</div>

<!-- Main App -->
<div id="mainApp" class="hidden flex h-screen overflow-hidden">
  <!-- Sidebar -->
  <div class="sidebar w-64 flex-shrink-0 flex flex-col text-white">
    <div class="p-5 border-b border-white border-opacity-10">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,#00A651,#0066CC)">
          <i class="fas fa-users-cog text-white"></i>
        </div>
        <div>
          <div class="font-bold text-sm">OneCad HCNS</div>
          <div class="text-xs text-gray-400">Quản lý Nhân sự</div>
        </div>
      </div>
    </div>
    <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
      <div class="text-xs text-gray-500 font-semibold uppercase mb-2 px-2">Tổng quan</div>
      <a href="#" class="nav-item flex items-center gap-3 px-3 py-2.5 text-gray-300 text-sm" onclick="showPage('dashboard')">
        <i class="fas fa-tachometer-alt w-5"></i><span>Dashboard</span>
      </a>
      <div class="text-xs text-gray-500 font-semibold uppercase mb-2 mt-4 px-2">Nhân sự</div>
      <a href="#" class="nav-item flex items-center gap-3 px-3 py-2.5 text-gray-300 text-sm" onclick="showPage('employees')">
        <i class="fas fa-users w-5"></i><span>Danh sách nhân viên</span>
      </a>
      <a href="#" class="nav-item flex items-center gap-3 px-3 py-2.5 text-gray-300 text-sm" onclick="showPage('contracts')">
        <i class="fas fa-file-contract w-5"></i><span>Hợp đồng lao động</span>
        <span id="contractBadge" class="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center hidden">0</span>
      </a>
      <a href="#" class="nav-item flex items-center gap-3 px-3 py-2.5 text-gray-300 text-sm" onclick="showPage('leaves')">
        <i class="fas fa-calendar-minus w-5"></i><span>Nghỉ phép</span>
      </a>
      <div class="text-xs text-gray-500 font-semibold uppercase mb-2 mt-4 px-2">Nhắc nhở</div>
      <a href="#" class="nav-item flex items-center gap-3 px-3 py-2.5 text-gray-300 text-sm" onclick="showPage('reminders')">
        <i class="fas fa-bell w-5"></i><span>Nhắc nhở HCNS</span>
        <span id="reminderBadge" class="ml-auto bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center hidden">0</span>
      </a>
      <a href="#" class="nav-item flex items-center gap-3 px-3 py-2.5 text-gray-300 text-sm" onclick="showPage('reports')">
        <i class="fas fa-chart-bar w-5"></i><span>Báo cáo HCNS</span>
      </a>
      <div class="text-xs text-gray-500 font-semibold uppercase mb-2 mt-4 px-2">Hệ thống</div>
      <a href="#" class="nav-item flex items-center gap-3 px-3 py-2.5 text-gray-300 text-sm" onclick="showPage('sync')">
        <i class="fas fa-sync-alt w-5"></i><span>Đồng bộ dữ liệu</span>
      </a>
      <a href="#" class="nav-item flex items-center gap-3 px-3 py-2.5 text-gray-300 text-sm" onclick="showPage('settings')">
        <i class="fas fa-cog w-5"></i><span>Cài đặt</span>
      </a>
    </nav>
    <div class="p-4 border-t border-white border-opacity-10">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-sm font-bold" id="userAvatar">A</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate" id="userName">Admin</div>
          <div class="text-xs text-gray-400" id="userRole">hr_admin</div>
        </div>
      </div>
      <button onclick="logout()" class="w-full text-left flex items-center gap-2 text-gray-400 text-sm hover:text-red-400 transition-colors px-2 py-1">
        <i class="fas fa-sign-out-alt"></i><span>Đăng xuất</span>
      </button>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Top Bar -->
    <div class="bg-white border-b px-6 py-3 flex items-center justify-between">
      <div>
        <h2 class="font-semibold text-gray-800" id="pageTitle">Dashboard</h2>
        <p class="text-xs text-gray-500" id="pageSubtitle">Tổng quan hệ thống HCNS</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-sm text-gray-500" id="currentDateTime"></div>
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style="background:#00A651" id="topUserAvatar">A</div>
      </div>
    </div>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-6" id="pageContent">
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
