// ===================================================
// HCNS - HR Management System Frontend
// OneCad Vietnam
// ===================================================

const API = axios.create({ baseURL: '/' })
let currentUser = null
let dashboardCharts = {}

// ===== AUTH =====
function getToken() { return localStorage.getItem('hcns_token') }
function setToken(t) { localStorage.setItem('hcns_token', t) }
function removeToken() { localStorage.removeItem('hcns_token') }

API.interceptors.request.use(cfg => {
  const t = getToken()
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
API.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) { removeToken(); showLogin() }
  return Promise.reject(err)
})

async function login() {
  const u = document.getElementById('loginUsername').value.trim()
  const p = document.getElementById('loginPassword').value
  if (!u || !p) { showToast('Vui lòng nhập đầy đủ thông tin', 'error'); return }
  try {
    const r = await API.post('/api/auth/login', { username: u, password: p })
    setToken(r.data.token)
    currentUser = r.data.user
    showApp()
  } catch (e) {
    showToast(e.response?.data?.error || 'Đăng nhập thất bại', 'error')
  }
}

function logout() {
  removeToken()
  currentUser = null
  showLogin()
}

function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden')
  document.getElementById('mainApp').classList.add('hidden')
}

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden')
  document.getElementById('mainApp').classList.remove('hidden')
  if (currentUser) {
    document.getElementById('userName').textContent = currentUser.full_name
    document.getElementById('userRole').textContent = currentUser.role === 'hr_admin' ? 'Quản trị HCNS' : 'Nhân viên HCNS'
    const initial = currentUser.full_name.charAt(0).toUpperCase()
    document.getElementById('userAvatar').textContent = initial
    document.getElementById('topUserAvatar').textContent = initial
  }
  updateDateTime()
  setInterval(updateDateTime, 1000)
  showPage('dashboard')
}

function updateDateTime() {
  const now = new Date()
  document.getElementById('currentDateTime').textContent = now.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ===== NAVIGATION =====
function showPage(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'))
  const clicked = document.querySelector(`[onclick="showPage('${page}')"]`)
  if (clicked) clicked.classList.add('active')

  const titles = {
    dashboard: ['Dashboard', 'Tổng quan hệ thống HCNS'],
    employees: ['Danh sách Nhân viên', 'Quản lý hồ sơ nhân viên từ BIM & C3D'],
    contracts: ['Hợp đồng Lao động', 'Quản lý hợp đồng & nhắc nhở hết hạn'],
    leaves: ['Quản lý Nghỉ phép', 'Theo dõi nghỉ phép nhân viên'],
    reminders: ['Nhắc nhở HCNS', 'Các nhắc nhở quan trọng cần xử lý'],
    reports: ['Báo cáo HCNS', 'Báo cáo tổng hợp nhân sự'],
    sync: ['Đồng bộ Dữ liệu', 'Kéo dữ liệu từ BIM & C3D về HCNS'],
    settings: ['Cài đặt', 'Cài đặt hệ thống HCNS']
  }
  const [title, sub] = titles[page] || ['', '']
  document.getElementById('pageTitle').textContent = title
  document.getElementById('pageSubtitle').textContent = sub

  const pages = { dashboard: renderDashboard, employees: renderEmployees, contracts: renderContracts, leaves: renderLeaves, reminders: renderReminders, reports: renderReports, sync: renderSync, settings: renderSettings }
  if (pages[page]) pages[page]()
}

// ===== TOAST =====
function showToast(msg, type = 'success', duration = 4000) {
  const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-orange-500', info: 'bg-blue-500' }
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' }
  const toast = document.createElement('div')
  toast.className = `toast ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-72 max-w-sm`
  toast.innerHTML = `<i class="fas ${icons[type]}"></i><span class="flex-1 text-sm">${msg}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-70 hover:opacity-100"><i class="fas fa-times"></i></button>`
  document.getElementById('toastContainer').appendChild(toast)
  setTimeout(() => toast.remove(), duration)
}

// ===== MODAL =====
function showModal(title, content, footer = '') {
  const html = `<div class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" id="modalOverlay" onclick="if(event.target===this)closeModal()">
    <div class="modal-content bg-white w-full shadow-2xl" style="max-width:680px">
      <div class="modal-header sticky top-0 bg-white z-10 flex items-center justify-between" style="padding:16px 24px;border-bottom:1px solid #e2e8f0">
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.3">${title}</h3>
        <button onclick="closeModal()" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:none;border:none;cursor:pointer;color:#64748b;font-size:14px" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'"><i class="fas fa-times"></i></button>
      </div>
      <div style="padding:20px 24px">${content}</div>
      ${footer ? `<div style="padding:12px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:10px">${footer}</div>` : ''}
    </div>
  </div>`
  document.getElementById('modalContainer').innerHTML = html
}

function closeModal() { document.getElementById('modalContainer').innerHTML = '' }

// ===== HELPERS =====
function fmt(v) { if (!v) return '<span class="text-gray-300">—</span>'; return v }
function fmtDate(d) { if (!d) return '<span class="text-gray-300">—</span>'; return dayjs(d).format('DD/MM/YYYY') }
function fmtMoney(v) { if (!v) return '—'; return new Intl.NumberFormat('vi-VN').format(v) + ' ₫' }
function daysDiff(d) { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000) }
function srcBadge(src) {
  const map = { BIM: 'badge-bim', C3D: 'badge-c3d', MANUAL: 'badge-manual' }
  return `<span class="${map[src] || 'badge-manual'}">${src}</span>`
}
function fmtGender(g) {
  if (!g) return '—'
  const v = g.toLowerCase().trim()
  if (v === 'male' || v === 'nam') return 'Nam'
  if (v === 'female' || v === 'nữ' || v === 'nu') return 'Nữ'
  if (v === 'other' || v === 'khác' || v === 'khac') return 'Khác'
  return g
}

function contractTypeName(t) {
  const map = { trial: 'Thử việc', fixed_term: 'Có thời hạn', indefinite: 'Vô thời hạn', seasonal: 'Thời vụ' }
  return map[t] || t
}
function priorityBadge(p) {
  const map = { urgent: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-gray-100 text-gray-600' }
  const labels = { urgent: 'Khẩn', high: 'Cao', medium: 'TB', low: 'Thấp' }
  return `<span class="${map[p] || ''} text-xs px-2 py-0.5 rounded-full font-medium">${labels[p] || p}</span>`
}

// ===== DASHBOARD =====
async function renderDashboard() {
  document.getElementById('pageContent').innerHTML = `<div class="flex items-center justify-center h-40"><div class="loading" style="border-color:#00A651;border-top-color:transparent"></div></div>`
  try {
    const r = await API.get('/api/dashboard/stats')
    const d = r.data
    const s = d.stats

    // Update badges
    if (s.expiring_contracts > 0) { document.getElementById('contractBadge').textContent = s.expiring_contracts; document.getElementById('contractBadge').style.display = 'inline-block' }
    if (s.urgent_reminders > 0) { document.getElementById('reminderBadge').textContent = s.urgent_reminders; document.getElementById('reminderBadge').style.display = 'inline-block' }

    document.getElementById('pageContent').innerHTML = `
    <div class="space-y-6">
      <!-- KPI Cards -->
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
        <div class="kpi-card" style="background:linear-gradient(135deg,#00A651,#00c460)">
          <div class="flex items-center justify-between mb-2">
            <i class="fas fa-users text-xl opacity-80"></i>
            <span style="font-size:10px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:20px">Tổng nhân sự</span>
          </div>
          <div style="font-size:28px;font-weight:700;line-height:1">${s.total_employees}</div>
          <div style="font-size:11px;opacity:0.85;margin-top:4px">
            <span class="mr-2"><i class="fas fa-building mr-1"></i>BIM: ${s.bim_employees}</span>
            <span><i class="fas fa-drafting-compass mr-1"></i>C3D: ${s.c3d_employees}</span>
          </div>
        </div>
        <div class="kpi-card" style="background:linear-gradient(135deg,#0066CC,#4d94ff)">
          <div class="flex items-center justify-between mb-2">
            <i class="fas fa-file-contract text-xl opacity-80"></i>
            <span style="font-size:10px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:20px">Hợp đồng</span>
          </div>
          <div style="font-size:28px;font-weight:700;line-height:1">${s.active_contracts}</div>
          <div style="font-size:11px;opacity:0.85;margin-top:4px"><i class="fas fa-exclamation-triangle mr-1"></i>${s.expiring_contracts} sắp hết hạn</div>
        </div>
        <div class="kpi-card" style="background:linear-gradient(135deg,#FF6B00,#ff9640)">
          <div class="flex items-center justify-between mb-2">
            <i class="fas fa-bell text-xl opacity-80"></i>
            <span style="font-size:10px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:20px">Nhắc nhở</span>
          </div>
          <div style="font-size:28px;font-weight:700;line-height:1">${s.urgent_reminders}</div>
          <div style="font-size:11px;opacity:0.85;margin-top:4px">Cần xử lý trong 7 ngày</div>
        </div>
        <div class="kpi-card" style="background:linear-gradient(135deg,#7C3AED,#a855f7)">
          <div class="flex items-center justify-between mb-2">
            <i class="fas fa-calendar-minus text-xl opacity-80"></i>
            <span style="font-size:10px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:20px">Nghỉ phép</span>
          </div>
          <div style="font-size:28px;font-weight:700;line-height:1">${s.pending_leave}</div>
          <div style="font-size:11px;opacity:0.85;margin-top:4px">Đơn chờ phê duyệt</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:16px">
        <div style="display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;align-items:start">
        <!-- Hợp đồng sắp hết hạn -->
        <div class="card p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-gray-800" style="font-size:13px"><i class="fas fa-clock text-orange-500 mr-2"></i>Hợp đồng sắp hết hạn (30 ngày)</h3>
            <button onclick="showPage('contracts')" class="text-blue-600 hover:underline" style="font-size:12px">Xem tất cả</button>
          </div>
          ${d.expiring_contracts.length === 0 ? '<div class="text-center text-gray-400 py-6"><i class="fas fa-check-circle text-3xl mb-2 text-green-400"></i><p style="font-size:13px">Không có HĐ nào sắp hết hạn</p></div>' :
          `<div class="space-y-2">
            ${d.expiring_contracts.map(c => {
              const days = daysDiff(c.end_date)
              const urgency = days <= 7 ? 'urgency-urgent' : days <= 14 ? 'urgency-high' : 'urgency-medium'
              return `<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg ${urgency}">
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate" style="font-size:12px">${c.full_name} ${srcBadge(c.source_app)}</div>
                  <div class="text-gray-500" style="font-size:11px">${c.contract_number} · ${contractTypeName(c.contract_type)} · ${c.department || '—'}</div>
                </div>
                <div class="text-right flex-shrink-0">
                  <div class="font-bold" style="font-size:11px;color:${days <= 7 ? '#dc2626' : days <= 14 ? '#d97706' : '#ca8a04'}">${days} ngày</div>
                  <div class="text-gray-500" style="font-size:11px">${fmtDate(c.end_date)}</div>
                </div>
              </div>`
            }).join('')}
          </div>`}
        </div>

        <!-- Biểu đồ phân bổ -->
        <div class="card p-5">
          <h3 class="font-semibold text-gray-800 mb-3" style="font-size:13px"><i class="fas fa-chart-pie text-blue-500 mr-2"></i>Nhân sự theo nguồn</h3>
          <div style="position:relative;width:100%;height:160px">
            <canvas id="sourceChart"></canvas>
          </div>
          <div class="mt-3 space-y-2">
            ${d.by_department.slice(0,5).map(dept => `
            <div class="flex items-center gap-2">
              <div class="text-gray-600 flex-1 truncate" style="font-size:11px">${dept.department || 'Chưa phân bổ'}</div>
              <div class="flex-1 bg-gray-100 rounded-full" style="height:6px"><div class="rounded-full" style="height:6px;width:${Math.min(100, dept.cnt / s.total_employees * 100)}%;background:#00A651"></div></div>
              <div class="font-medium text-gray-700" style="font-size:11px;min-width:16px;text-align:right">${dept.cnt}</div>
            </div>`).join('')}
          </div>
        </div>
        </div>
      </div>

      <!-- Nhắc nhở khẩn -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-800"><i class="fas fa-bell text-red-500 mr-2"></i>Nhắc nhở cần xử lý</h3>
          <button onclick="showPage('reminders')" class="text-sm text-blue-600 hover:underline">Xem tất cả</button>
        </div>
        ${d.reminders.length === 0 ? '<div class="text-center text-gray-400 py-6"><i class="fas fa-bell-slash text-3xl mb-2"></i><p>Không có nhắc nhở nào</p></div>' :
        `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${d.reminders.map(r => `
          <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg urgency-${r.priority}">
            <div class="mt-1">${priorityBadge(r.priority)}</div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm">${r.title}</div>
              <div class="text-xs text-gray-500">${r.full_name ? r.full_name + ' · ' : ''}${fmtDate(r.remind_date)}</div>
            </div>
            <button onclick="resolveReminder(${r.id})" class="text-green-600 hover:text-green-800 text-xs flex-shrink-0" title="Đánh dấu đã xử lý"><i class="fas fa-check"></i></button>
          </div>`).join('')}
        </div>`}
      </div>
    </div>`

    // Chart
    if (d.by_source.length > 0) {
      const ctx = document.getElementById('sourceChart')?.getContext('2d')
      if (ctx) {
        if (dashboardCharts.source) dashboardCharts.source.destroy()
        dashboardCharts.source = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: d.by_source.map(x => x.source_app),
            datasets: [{ data: d.by_source.map(x => x.cnt), backgroundColor: ['#0066CC', '#00A651', '#FF6B00', '#7C3AED'], borderWidth: 0 }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 }, boxWidth: 12 } }
            },
            cutout: '60%'
          }
        })
      }
    }
  } catch (e) {
    if (e.response?.status === 500 && e.response?.data?.error?.includes('no such table')) {
      document.getElementById('pageContent').innerHTML = `<div class="card p-8 text-center">
        <i class="fas fa-database text-5xl text-gray-300 mb-4"></i>
        <h3 class="text-lg font-semibold text-gray-700 mb-2">Chưa khởi tạo hệ thống</h3>
        <p class="text-gray-500 mb-4">Database chưa được tạo. Nhấn nút bên dưới để khởi tạo lần đầu.</p>
        <button onclick="initSystem()" class="btn-primary"><i class="fas fa-play mr-2"></i>Khởi tạo hệ thống</button>
      </div>`
    } else {
      showToast('Lỗi tải dashboard: ' + (e.response?.data?.error || e.message), 'error')
    }
  }
}

async function initSystem() {
  try {
    showToast('Đang khởi tạo...', 'info')
    await API.post('/api/system/init')
    showToast('Khởi tạo thành công!', 'success')
    renderDashboard()
  } catch (e) { showToast('Lỗi: ' + e.message, 'error') }
}

async function resolveReminder(id) {
  try {
    await API.put(`/api/reminders/${id}/resolve`)
    showToast('Đã đánh dấu xử lý', 'success')
    renderDashboard()
  } catch(e) { showToast('Lỗi', 'error') }
}

// ===== EMPLOYEES =====
let empPage = 1, empSearch = '', empSource = '', empDept = '', empActive = '1'
async function renderEmployees() {
  document.getElementById('pageContent').innerHTML = `
  <div class="space-y-4">
    <div class="card p-4">
      <div class="flex flex-wrap gap-3 items-center">
        <div class="flex-1 min-w-48 relative">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input id="empSearch" type="text" placeholder="Tìm kiếm tên, mã NV, email..." class="pl-9" value="${empSearch}" oninput="empSearch=this.value;empPage=1;loadEmployees()">
        </div>
        <select id="empSource" class="w-36" onchange="empSource=this.value;empPage=1;loadEmployees()">
          <option value="">Tất cả nguồn</option>
          <option value="BIM" ${empSource==='BIM'?'selected':''}>BIM</option>
          <option value="C3D" ${empSource==='C3D'?'selected':''}>C3D</option>
          <option value="MANUAL" ${empSource==='MANUAL'?'selected':''}>Thủ công</option>
        </select>
        <select id="empActive" class="w-36" onchange="empActive=this.value;empPage=1;loadEmployees()">
          <option value="1" ${empActive==='1'?'selected':''}>Đang làm việc</option>
          <option value="0" ${empActive==='0'?'selected':''}>Đã nghỉ việc</option>
          <option value="">Tất cả</option>
        </select>
        <button onclick="showAddEmployeeModal()" class="btn-primary flex items-center gap-2 whitespace-nowrap">
          <i class="fas fa-plus"></i>Thêm thủ công
        </button>
      </div>
    </div>
    <div id="employeeTable"></div>
    <div id="empPagination" class="flex justify-center gap-2 mt-4"></div>
  </div>`
  loadEmployees()
}

async function loadEmployees() {
  document.getElementById('employeeTable').innerHTML = `<div class="flex justify-center py-10"><div class="loading" style="border-color:#00A651;border-top-color:transparent"></div></div>`
  try {
    const params = { page: empPage, limit: 25, search: empSearch, source: empSource, is_active: empActive }
    const r = await API.get('/api/employees', { params })
    const { data, total, page, limit } = r.data
    const totalPages = Math.ceil(total / limit)

    document.getElementById('employeeTable').innerHTML = `
    <div class="card overflow-hidden">
      <div class="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <span class="text-sm text-gray-600">Tổng: <strong>${total}</strong> nhân viên</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="bg-gray-50 border-b">
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Mã NV</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Họ tên</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nguồn</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phòng ban</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Chức danh</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ngày vào</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">HĐ hiện tại</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Thao tác</th>
          </tr></thead>
          <tbody>
            ${data.length === 0 ? '<tr><td colspan="9" class="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>' :
            data.map(e => {
              const days = e.latest_contract_end ? daysDiff(e.latest_contract_end) : null
              const contractInfo = e.active_contracts > 0
                ? (days !== null ? (days <= 30 ? `<span class="text-orange-600 font-medium">${days} ngày</span>` : `<span class="text-green-600">Còn ${days} ngày</span>`) : `<span class="text-blue-600">Vô thời hạn</span>`)
                : `<span class="text-red-400">Chưa có HĐ</span>`
              return `<tr class="table-row border-b hover:bg-blue-50 cursor-pointer" onclick="showEmployeeDetail(${e.id})">
                <td class="px-4 py-3 font-mono text-xs text-gray-600">${e.employee_code || '—'}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style="background:${e.source_app==='BIM'?'#0066CC':e.source_app==='C3D'?'#00A651':'#FF6B00'}">${e.full_name.charAt(0)}</div>
                    <div>
                      <div class="font-medium text-gray-800">${e.full_name}</div>
                      <div class="text-xs text-gray-400">${e.email || e.username}</div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">${srcBadge(e.source_app)}</td>
                <td class="px-4 py-3 text-gray-600">${e.department || '—'}</td>
                <td class="px-4 py-3 text-gray-600">${e.position || '—'}</td>
                <td class="px-4 py-3 text-gray-600">${fmtDate(e.join_date)}</td>
                <td class="px-4 py-3">${contractInfo}</td>
                <td class="px-4 py-3"><span class="${e.is_active ? 'badge-active' : 'badge-inactive'}">${e.is_active ? 'Đang làm' : 'Đã nghỉ'}</span></td>
                <td class="px-4 py-3 text-center">
                  <button onclick="event.stopPropagation();showEmployeeDetail(${e.id})" class="text-blue-500 hover:text-blue-700 mx-1" title="Chi tiết"><i class="fas fa-eye"></i></button>
                  <button onclick="event.stopPropagation();showEditEmployee(${e.id})" class="text-green-500 hover:text-green-700 mx-1" title="Chỉnh sửa"><i class="fas fa-edit"></i></button>
                  <button onclick="event.stopPropagation();showAddContractModal(${e.id},'${e.full_name}')" class="text-purple-500 hover:text-purple-700 mx-1" title="Thêm HĐ"><i class="fas fa-file-contract"></i></button>
                  ${e.source_app === 'MANUAL' ? `
                  <button onclick="event.stopPropagation();toggleEmployeeActive(${e.id},'${e.full_name.replace(/'/g,"\\'")}',${e.is_active})" class="${e.is_active ? 'text-orange-500 hover:text-orange-700' : 'text-teal-500 hover:text-teal-700'} mx-1" title="${e.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}"><i class="fas fa-${e.is_active ? 'user-slash' : 'user-check'}"></i></button>
                  <button onclick="event.stopPropagation();confirmDeleteEmployee(${e.id},'${e.full_name.replace(/'/g,"\\'")}' )" class="text-red-500 hover:text-red-700 mx-1" title="Xóa nhân viên"><i class="fas fa-trash"></i></button>
                  ` : ''}
                </td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`

    // Pagination
    if (totalPages > 1) {
      let pages = ''
      for (let i = 1; i <= totalPages; i++) {
        pages += `<button onclick="empPage=${i};loadEmployees()" class="px-3 py-1 rounded text-sm ${i===page?'btn-primary':'bg-white border hover:bg-gray-50'}">${i}</button>`
      }
      document.getElementById('empPagination').innerHTML = pages
    }
  } catch(e) { showToast('Lỗi tải danh sách', 'error') }
}

async function toggleEmployeeActive(id, name, currentActive) {
  const action = currentActive ? 'vô hiệu hóa' : 'kích hoạt lại'
  if (!confirm(`Bạn có chắc muốn ${action} nhân viên "${name}"?`)) return
  try {
    const r = await API.patch(`/api/employees/${id}/toggle-active`)
    const newState = r.data.is_active ? 'Đang làm' : 'Đã nghỉ'
    showToast(`Đã ${action} nhân viên ${name} → ${newState}`, 'success')
    loadEmployees()
  } catch(err) {
    const msg = err.response?.data?.error || 'Lỗi khi thay đổi trạng thái'
    showToast(msg, 'error')
  }
}

async function confirmDeleteEmployee(id, name) {
  if (!confirm(`⚠️ Xóa nhân viên "${name}"?\n\nHành động này sẽ xóa toàn bộ dữ liệu liên quan (hợp đồng, lịch sử). Không thể hoàn tác!`)) return
  try {
    await API.delete(`/api/employees/${id}`)
    showToast(`Đã xóa nhân viên ${name}`, 'success')
    loadEmployees()
  } catch(err) {
    const msg = err.response?.data?.error || 'Lỗi khi xóa nhân viên'
    showToast(msg, 'error')
  }
}

async function showEmployeeDetail(id) {
  try {
    const r = await API.get(`/api/employees/${id}`)
    const { employee: e, contracts, leaves, history } = r.data
    showModal(`Chi tiết nhân viên: ${e.full_name}`, `
    <div>
      <!-- Tabs -->
      <div style="display:flex;gap:4px;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:16px;flex-wrap:wrap">
        <button class="tab-btn active" onclick="switchTab('tab-info')"><i class="fas fa-id-card" style="margin-right:5px"></i>Cơ bản</button>
        <button class="tab-btn" onclick="switchTab('tab-hcns')"><i class="fas fa-file-alt" style="margin-right:5px"></i>Hồ sơ HCNS</button>
        <button class="tab-btn" onclick="switchTab('tab-contracts')"><i class="fas fa-file-contract" style="margin-right:5px"></i>Hợp đồng (${contracts.length})</button>
        <button class="tab-btn" onclick="switchTab('tab-history')"><i class="fas fa-history" style="margin-right:5px"></i>Lịch sử</button>
      </div>

      <!-- Tab: Thông tin cơ bản -->
      <div id="tab-info">
        <!-- Header info strip -->
        <div style="background:linear-gradient(135deg,#f0f7ff,#e8f8ef);border-radius:10px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:14px">
          <div style="width:48px;height:48px;border-radius:50%;background:${e.source_app==='BIM'?'#0066CC':e.source_app==='C3D'?'#00A651':'#FF6B00'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;flex-shrink:0">${e.full_name.charAt(0)}</div>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:700;color:#0f172a">${e.full_name}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">${e.position||''} ${e.department?'· '+e.department:''}</div>
          </div>
          <div style="text-align:right">
            ${srcBadge(e.source_app)}
            <div style="margin-top:4px"><span class="${e.is_active ? 'badge-active' : 'badge-inactive'}">${e.is_active ? 'Đang làm việc' : 'Đã nghỉ việc'}</span></div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="info-cell"><div class="lbl">Mã nhân viên</div><div class="val" style="font-family:monospace">${e.employee_code || '—'}</div></div>
          <div class="info-cell"><div class="lbl">Username</div><div class="val">${e.username}</div></div>
          <div class="info-cell"><div class="lbl">Email</div><div class="val">${e.email || '—'}</div></div>
          <div class="info-cell"><div class="lbl">Điện thoại</div><div class="val">${e.phone || '—'}</div></div>
          <div class="info-cell"><div class="lbl">Phòng ban</div><div class="val">${e.department || '—'}</div></div>
          <div class="info-cell"><div class="lbl">Chức danh</div><div class="val">${e.position || '—'}</div></div>
          <div class="info-cell" style="grid-column:span 2"><div class="lbl">Lương tháng</div><div class="val" style="color:#00A651;font-weight:700;font-size:15px">${fmtMoney(e.salary_monthly)}</div></div>
        </div>
      </div>

      <!-- Tab: HCNS -->
      <div id="tab-hcns" class="hidden">
        <!-- Thông tin cá nhân -->
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;padding:4px 0 8px;border-bottom:1px solid #e2e8f0;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <span style="width:3px;height:14px;background:#0066CC;border-radius:2px;display:inline-block"></span>Thông tin cá nhân
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div class="info-cell"><div class="lbl">Ngày sinh</div><div class="val">${fmtDate(e.date_of_birth)}</div></div>
          <div class="info-cell"><div class="lbl">Giới tính</div><div class="val">${fmtGender(e.gender)}</div></div>
          <div class="info-cell"><div class="lbl">CMND / CCCD</div><div class="val" style="font-family:monospace">${e.id_number || '—'}</div></div>
          <div class="info-cell"><div class="lbl">Ngày cấp · Nơi cấp</div><div class="val">${e.id_issue_date ? fmtDate(e.id_issue_date)+(e.id_issue_place?' · '+e.id_issue_place:'') : '—'}</div></div>
          <div class="info-cell" style="grid-column:span 2"><div class="lbl">Địa chỉ thường trú</div><div class="val">${e.address || '—'}</div></div>
          <div class="info-cell" style="grid-column:span 2"><div class="lbl">Nơi ở hiện tại</div><div class="val">${e.current_address || '—'}</div></div>
        </div>

        <!-- Công việc -->
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;padding:4px 0 8px;border-bottom:1px solid #e2e8f0;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <span style="width:3px;height:14px;background:#00A651;border-radius:2px;display:inline-block"></span>Thông tin công việc
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div class="info-cell"><div class="lbl">Ngày vào công ty</div><div class="val">${fmtDate(e.join_date)}</div></div>
          <div class="info-cell"><div class="lbl">Ký HĐ chính thức</div><div class="val">${fmtDate(e.official_start)}</div></div>
          <div class="info-cell"><div class="lbl">Thử việc từ</div><div class="val">${fmtDate(e.probation_start)}</div></div>
          <div class="info-cell"><div class="lbl">Thử việc đến</div><div class="val">${fmtDate(e.probation_end)}</div></div>
        </div>

        <!-- Học vấn -->
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;padding:4px 0 8px;border-bottom:1px solid #e2e8f0;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <span style="width:3px;height:14px;background:#7c3aed;border-radius:2px;display:inline-block"></span>Học vấn
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div class="info-cell"><div class="lbl">Trình độ</div><div class="val">${e.education || '—'}</div></div>
          <div class="info-cell"><div class="lbl">Năm tốt nghiệp</div><div class="val">${e.graduation_year || '—'}</div></div>
          <div class="info-cell" style="grid-column:span 2"><div class="lbl">Chuyên ngành</div><div class="val">${e.major || '—'}</div></div>
          <div class="info-cell" style="grid-column:span 2"><div class="lbl">Trường đại học / học viện</div><div class="val">${e.university || '—'}</div></div>
        </div>

        <!-- Bảo hiểm & Ngân hàng -->
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;padding:4px 0 8px;border-bottom:1px solid #e2e8f0;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <span style="width:3px;height:14px;background:#FF6B00;border-radius:2px;display:inline-block"></span>Bảo hiểm & Ngân hàng
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div class="info-cell"><div class="lbl">Số BHXH</div><div class="val">${e.social_insurance || '—'}</div></div>
          <div class="info-cell"><div class="lbl">Số BHYT</div><div class="val">${e.health_insurance || '—'}</div></div>
          <div class="info-cell"><div class="lbl">Mã số thuế</div><div class="val">${e.tax_code || '—'}</div></div>
          <div class="info-cell"><div class="lbl">Tài khoản NH</div><div class="val">${e.bank_account ? e.bank_account+(e.bank_name?' · '+e.bank_name:'')+(e.bank_branch?' · '+e.bank_branch:'') : '—'}</div></div>
        </div>
        ${e.notes ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:13px;color:#92400e"><i class="fas fa-sticky-note" style="margin-right:6px;color:#d97706"></i>${e.notes}</div>` : ''}
      </div>

      <!-- Tab: Contracts -->
      <div id="tab-contracts" class="hidden">
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button onclick="closeModal();showAddContractModal(${e.id},'${e.full_name}')" class="btn-secondary" style="font-size:13px;padding:7px 14px"><i class="fas fa-plus"></i>Thêm HĐ</button>
        </div>
        ${contracts.length === 0 ? '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px"><i class="fas fa-file-contract" style="font-size:28px;margin-bottom:8px;display:block;opacity:0.4"></i>Chưa có hợp đồng nào</div>' :
        contracts.map(c => {
          const days = c.end_date ? daysDiff(c.end_date) : null
          const borderColor = c.status === 'active' ? '#00A651' : '#9ca3af'
          return `<div style="border-left:4px solid ${borderColor};padding:12px 14px;border-radius:0 8px 8px 0;margin-bottom:10px;background:${c.status==='active'?'#f0fdf4':'#f9fafb'}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <div style="font-size:14px;font-weight:700;color:#0f172a">${c.contract_number}</div>
                <div style="font-size:12px;color:#64748b;margin-top:3px">${contractTypeName(c.contract_type)} · ${fmtMoney(c.salary)}</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:4px"><i class="fas fa-calendar-alt" style="margin-right:4px"></i>${fmtDate(c.start_date)} → ${c.end_date ? fmtDate(c.end_date) : 'Vô thời hạn'}</div>
              </div>
              <div style="text-align:right">
                <span class="badge-${c.status==='active'?'active':'inactive'}">${c.status==='active'?'Hiệu lực':'Hết hiệu lực'}</span>
                ${days !== null ? `<div style="font-size:11px;margin-top:5px;${days<=30?'color:#ea580c;font-weight:700':'color:#64748b'}">${days > 0 ? 'Còn '+days+' ngày' : 'Đã hết hạn'}</div>` : ''}
              </div>
            </div>
          </div>`}).join('')}
      </div>

      <!-- Tab: History -->
      <div id="tab-history" class="hidden">
        ${history.length === 0 ? '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px"><i class="fas fa-history" style="font-size:28px;margin-bottom:8px;display:block;opacity:0.4"></i>Chưa có lịch sử thay đổi</div>' :
        history.map(h => `<div style="display:flex;gap:12px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #f1f5f9">
          <div style="width:32px;height:32px;background:#eff6ff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-edit" style="font-size:12px;color:#3b82f6"></i></div>
          <div style="flex:1">
            <div style="font-size:13px;color:#334155"><strong style="color:#0f172a">${h.field_changed}</strong>: <span style="color:#ef4444;text-decoration:line-through">${h.old_value||'—'}</span> → <span style="color:#00A651">${h.new_value||'—'}</span></div>
            <div style="font-size:11px;color:#94a3b8;margin-top:3px">bởi ${h.changed_by_name} · ${dayjs(h.created_at).format('DD/MM/YYYY HH:mm')}</div>
          </div>
        </div>`).join('')}
      </div>
    </div>`,
    `<button onclick="closeModal();showEditEmployee(${e.id})" class="btn-primary"><i class="fas fa-edit"></i>Chỉnh sửa HCNS</button>
     ${e.source_app === 'MANUAL' ? `
     <button onclick="closeModal();toggleEmployeeActive(${e.id},'${e.full_name.replace(/'/g,"\\'")}',${e.is_active})" class="btn-secondary" style="background:${e.is_active?'#f97316':'#14b8a6'};border-color:${e.is_active?'#f97316':'#14b8a6'};color:#fff"><i class="fas fa-${e.is_active?'user-slash':'user-check'}"></i>${e.is_active?'Vô hiệu hóa':'Kích hoạt'}</button>
     <button onclick="closeModal();confirmDeleteEmployee(${e.id},'${e.full_name.replace(/'/g,"\\'")}' )" style="background:#ef4444;border:none;color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px"><i class="fas fa-trash" style="margin-right:5px"></i>Xóa</button>
     ` : ''}
     <button onclick="closeModal()" class="btn-ghost">Đóng</button>`)
  } catch(e) { showToast('Lỗi tải chi tiết', 'error') }
}

function switchTab(tabId) {
  document.querySelectorAll('[id^="tab-"]').forEach(t => t.classList.add('hidden'))
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  document.getElementById(tabId).classList.remove('hidden')
  event.currentTarget.classList.add('active')
}

async function showEditEmployee(id) {
  try {
    const r = await API.get(`/api/employees/${id}`)
    const e = r.data.employee
    const lbl = (text) => `<label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">${text}</label>`
    showModal(`Chỉnh sửa thông tin HCNS: ${e.full_name}`, `
    <form id="editEmpForm">
      <!-- Section: Công việc -->
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;padding:0 0 8px;border-bottom:1px solid #e2e8f0;margin-bottom:12px;display:flex;align-items:center;gap:6px">
        <span style="width:3px;height:14px;background:#00A651;border-radius:2px;display:inline-block"></span>Thông tin công việc
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>${lbl('Mã nhân viên HCNS')}<input name="employee_code" value="${e.employee_code||''}"></div>
        <div>${lbl('Chức danh')}<input name="position" value="${e.position||''}"></div>
        <div>${lbl('Ngày vào công ty')}<input type="date" name="join_date" value="${e.join_date||''}"></div>
        <div>${lbl('Bắt đầu thử việc')}<input type="date" name="probation_start" value="${e.probation_start||''}"></div>
        <div>${lbl('Kết thúc thử việc')}<input type="date" name="probation_end" value="${e.probation_end||''}"></div>
        <div>${lbl('Ngày ký HĐ chính thức')}<input type="date" name="official_start" value="${e.official_start||''}"></div>
        <div>${lbl('Số điện thoại')}<input name="phone" value="${e.phone||''}"></div>
        <div>${lbl('Giới tính')}
          <select name="gender"><option value="">— Chọn —</option><option value="Nam" ${e.gender==='Nam'||e.gender==='male'?'selected':''}>Nam</option><option value="Nữ" ${e.gender==='Nữ'||e.gender==='female'?'selected':''}>Nữ</option><option value="Khác" ${e.gender==='Khác'||e.gender==='other'?'selected':''}>Khác</option></select></div>
      </div>

      <!-- Section: Cá nhân -->
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;padding:0 0 8px;border-bottom:1px solid #e2e8f0;margin-bottom:12px;display:flex;align-items:center;gap:6px">
        <span style="width:3px;height:14px;background:#0066CC;border-radius:2px;display:inline-block"></span>Thông tin cá nhân
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>${lbl('Ngày sinh')}<input type="date" name="date_of_birth" value="${e.date_of_birth||''}"></div>
        <div>${lbl('CMND / CCCD')}<input name="id_number" value="${e.id_number||''}"></div>
        <div>${lbl('Ngày cấp CMND')}<input name="id_issue_date" type="date" value="${e.id_issue_date||''}"></div>
        <div>${lbl('Nơi cấp')}<input name="id_issue_place" value="${e.id_issue_place||''}" placeholder="VD: Hà Nội"></div>
        <div style="grid-column:span 2">${lbl('Địa chỉ thường trú')}<input name="address" value="${e.address||''}"></div>
        <div style="grid-column:span 2">${lbl('Nơi ở hiện tại')}<input name="current_address" value="${e.current_address||''}"></div>
      </div>

      <!-- Section: Học vấn -->
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;padding:0 0 8px;border-bottom:1px solid #e2e8f0;margin-bottom:12px;display:flex;align-items:center;gap:6px">
        <span style="width:3px;height:14px;background:#7c3aed;border-radius:2px;display:inline-block"></span>Học vấn
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>${lbl('Trình độ học vấn')}
          <select name="education"><option value="">— Chọn —</option><option ${e.education==='Trung học'?'selected':''}>Trung học</option><option ${e.education==='Trung cấp'?'selected':''}>Trung cấp</option><option ${e.education==='Cao đẳng'?'selected':''}>Cao đẳng</option><option ${e.education==='Đại học'?'selected':''}>Đại học</option><option ${e.education==='Thạc sĩ'?'selected':''}>Thạc sĩ</option><option ${e.education==='Tiến sĩ'?'selected':''}>Tiến sĩ</option></select></div>
        <div>${lbl('Năm tốt nghiệp')}<input type="number" name="graduation_year" value="${e.graduation_year||''}" placeholder="VD: 2015" min="1970" max="2099"></div>
        <div style="grid-column:span 2">${lbl('Chuyên ngành')}<input name="major" value="${e.major||''}" placeholder="VD: Kỹ thuật xây dựng"></div>
        <div style="grid-column:span 2">${lbl('Trường đại học / học viện')}<input name="university" value="${e.university||''}" placeholder="VD: ĐH Bách Khoa Hà Nội"></div>
      </div>

      <!-- Section: Bảo hiểm & Thuế -->
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;padding:0 0 8px;border-bottom:1px solid #e2e8f0;margin-bottom:12px;display:flex;align-items:center;gap:6px">
        <span style="width:3px;height:14px;background:#FF6B00;border-radius:2px;display:inline-block"></span>Bảo hiểm & Thuế
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>${lbl('Số BHXH')}<input name="social_insurance" value="${e.social_insurance||''}"></div>
        <div>${lbl('Số BHYT')}<input name="health_insurance" value="${e.health_insurance||''}"></div>
        <div style="grid-column:span 2">${lbl('Mã số thuế')}<input name="tax_code" value="${e.tax_code||''}"></div>
      </div>

      <!-- Section: Ngân hàng -->
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;padding:0 0 8px;border-bottom:1px solid #e2e8f0;margin-bottom:12px;display:flex;align-items:center;gap:6px">
        <span style="width:3px;height:14px;background:#0891b2;border-radius:2px;display:inline-block"></span>Tài khoản ngân hàng
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
        <div>${lbl('Số tài khoản')}<input name="bank_account" value="${e.bank_account||''}"></div>
        <div>${lbl('Tên ngân hàng')}<input name="bank_name" value="${e.bank_name||''}"></div>
        <div>${lbl('Chi nhánh')}<input name="bank_branch" value="${e.bank_branch||''}"></div>
      </div>

      <!-- Ghi chú -->
      <div>${lbl('Ghi chú HCNS')}
        <textarea name="notes" rows="2" placeholder="Ghi chú nội bộ...">${e.notes||''}</textarea></div>
    </form>`,
    `<button onclick="saveEmployee(${e.id})" class="btn-primary"><i class="fas fa-save"></i>Lưu thay đổi</button>
     <button onclick="closeModal()" class="btn-ghost">Hủy</button>`)
  } catch(err) { showToast('Lỗi', 'error') }
}

async function saveEmployee(id) {
  const form = document.getElementById('editEmpForm')
  const data = {}
  new FormData(form).forEach((v, k) => { data[k] = v || null })
  try {
    await API.put(`/api/employees/${id}`, data)
    showToast('Cập nhật thành công!', 'success')
    closeModal()
    loadEmployees()
  } catch(e) { showToast('Lỗi lưu: ' + (e.response?.data?.error || e.message), 'error') }
}

function showAddEmployeeModal() {
  const lbl = (text, req='') => `<label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">${text}${req?'<span style="color:#ef4444;margin-left:2px">*</span>':''}</label>`
  showModal('Thêm nhân viên thủ công', `
  <form id="addEmpForm">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div style="grid-column:span 2">${lbl('Họ và tên',true)}<input name="full_name" required placeholder="Nguyễn Văn A"></div>
      <div>${lbl('Email')}<input name="email" type="email" placeholder="email@company.com"></div>
      <div>${lbl('Điện thoại')}<input name="phone" placeholder="0912 345 678"></div>
      <div>${lbl('Phòng ban')}<input name="department" placeholder="VD: Kết cấu, MEP..."></div>
      <div>${lbl('Chức danh')}<input name="position" placeholder="VD: Kỹ sư xây dựng"></div>
      <div>${lbl('Ngày vào công ty')}<input name="join_date" type="date"></div>
      <div>${lbl('Lương tháng (₫)')}<input name="salary_monthly" type="number" placeholder="0"></div>
    </div>
    <div>${lbl('Ghi chú')}<textarea name="notes" rows="2" placeholder="Ghi chú về nhân viên..."></textarea></div>
  </form>`,
  `<button onclick="addEmployee()" class="btn-primary"><i class="fas fa-plus"></i>Thêm nhân viên</button>
   <button onclick="closeModal()" class="btn-ghost">Hủy</button>`)
}

async function addEmployee() {
  const form = document.getElementById('addEmpForm')
  const data = { source_app: 'MANUAL' }
  new FormData(form).forEach((v, k) => { data[k] = v || null })
  if (!data.full_name) { showToast('Họ tên là bắt buộc', 'error'); return }
  try {
    await API.post('/api/employees', data)
    showToast('Thêm nhân viên thành công!', 'success')
    closeModal()
    loadEmployees()
  } catch(e) { showToast('Lỗi: ' + (e.response?.data?.error || e.message), 'error') }
}

// ===== CONTRACTS =====
async function renderContracts() {
  document.getElementById('pageContent').innerHTML = `
  <div class="space-y-4">
    <div class="card p-4 flex flex-wrap gap-3 items-center">
      <select id="contractFilter" class="w-40" onchange="loadContracts()">
        <option value="">Tất cả HĐ</option>
        <option value="active">Đang hiệu lực</option>
        <option value="expired">Đã hết hạn</option>
      </select>
      <select id="expiringFilter" class="w-48" onchange="loadContracts()">
        <option value="">Tất cả thời hạn</option>
        <option value="7">Hết hạn trong 7 ngày</option>
        <option value="30">Hết hạn trong 30 ngày</option>
        <option value="60">Hết hạn trong 60 ngày</option>
        <option value="90">Hết hạn trong 90 ngày</option>
      </select>
    </div>
    <div id="contractTable"></div>
  </div>`
  loadContracts()
}

async function loadContracts() {
  const status = document.getElementById('contractFilter')?.value
  const expiringDays = document.getElementById('expiringFilter')?.value
  document.getElementById('contractTable').innerHTML = `<div class="flex justify-center py-10"><div class="loading" style="border-color:#00A651;border-top-color:transparent"></div></div>`
  try {
    const params = {}
    if (status) params.status = status
    if (expiringDays) params.expiring_days = expiringDays
    const r = await API.get('/api/contracts', { params })
    const contracts = r.data.data
    document.getElementById('contractTable').innerHTML = `
    <div class="card overflow-hidden">
      <div class="px-4 py-3 border-b bg-gray-50"><span class="text-sm text-gray-600">Tổng: <strong>${contracts.length}</strong> hợp đồng</span></div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="bg-gray-50 border-b">
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Số HĐ</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nhân viên</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Loại HĐ</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ngày bắt đầu</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ngày kết thúc</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Còn lại</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lương HĐ</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Thao tác</th>
          </tr></thead>
          <tbody>
            ${contracts.length === 0 ? '<tr><td colspan="9" class="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>' :
            contracts.map(c => {
              const days = c.end_date ? daysDiff(c.end_date) : null
              const daysHtml = days === null ? '<span class="text-blue-600 text-xs">Vô thời hạn</span>'
                : days < 0 ? `<span class="text-red-600 font-bold text-xs">Quá hạn ${Math.abs(days)} ngày</span>`
                : days <= 7 ? `<span class="text-red-600 font-bold text-xs">⚠ ${days} ngày</span>`
                : days <= 30 ? `<span class="text-orange-600 font-medium text-xs">${days} ngày</span>`
                : `<span class="text-green-600 text-xs">${days} ngày</span>`
              return `<tr class="table-row border-b">
                <td class="px-4 py-3 font-mono text-xs">${c.contract_number}</td>
                <td class="px-4 py-3">
                  <div class="font-medium">${c.full_name}</div>
                  <div class="text-xs text-gray-500">${c.department||'—'} ${srcBadge(c.source_app)}</div>
                </td>
                <td class="px-4 py-3"><span class="badge-warning">${contractTypeName(c.contract_type)}</span></td>
                <td class="px-4 py-3 text-gray-600">${fmtDate(c.start_date)}</td>
                <td class="px-4 py-3 text-gray-600">${c.end_date ? fmtDate(c.end_date) : '—'}</td>
                <td class="px-4 py-3">${daysHtml}</td>
                <td class="px-4 py-3 text-gray-700">${fmtMoney(c.salary)}</td>
                <td class="px-4 py-3"><span class="${c.status==='active'?'badge-active':'badge-inactive'}">${c.status==='active'?'Hiệu lực':'Hết hiệu lực'}</span></td>
                <td class="px-4 py-3 text-center">
                  <button onclick="showEditContractModal(${c.id})" class="text-green-500 hover:text-green-700 mx-1" title="Sửa"><i class="fas fa-edit"></i></button>
                  <button onclick="deleteContract(${c.id})" class="text-red-500 hover:text-red-700 mx-1" title="Xóa"><i class="fas fa-trash"></i></button>
                </td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`
  } catch(e) { showToast('Lỗi tải HĐ', 'error') }
}

function showAddContractModal(empId, empName) {
  const lbl = (text, req='') => `<label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">${text}${req?'<span style="color:#ef4444;margin-left:2px">*</span>':''}</label>`
  showModal(`Thêm hợp đồng: ${empName}`, `
  <form id="addContractForm">
    <input type="hidden" name="employee_id" value="${empId}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>${lbl('Số hợp đồng',true)}<input name="contract_number" required placeholder="HĐ-2024-001"></div>
      <div>${lbl('Loại hợp đồng',true)}
        <select name="contract_type">
          <option value="trial">Thử việc</option>
          <option value="fixed_term" selected>Có thời hạn</option>
          <option value="indefinite">Vô thời hạn</option>
          <option value="seasonal">Thời vụ</option>
        </select></div>
      <div>${lbl('Ngày bắt đầu',true)}<input type="date" name="start_date" required></div>
      <div>${lbl('Ngày kết thúc')}<input type="date" name="end_date"></div>
      <div>${lbl('Mức lương (VNĐ)')}<input type="number" name="salary" placeholder="0" min="0"></div>
      <div>${lbl('Ngày ký')}<input type="date" name="signed_date"></div>
      <div>${lbl('Chức vụ trong HĐ')}<input name="position" placeholder="VD: Kỹ sư"></div>
      <div>${lbl('Nhắc trước (ngày)')}<input type="number" name="renewal_reminder_days" value="30" min="1" max="365"></div>
    </div>
    <div>${lbl('Ghi chú')}
      <textarea name="notes" rows="2" placeholder="Ghi chú hợp đồng..."></textarea></div>
  </form>`,
  `<button onclick="saveNewContract()" class="btn-primary"><i class="fas fa-save"></i>Lưu hợp đồng</button>
   <button onclick="closeModal()" class="btn-ghost">Hủy</button>`)
}

async function saveNewContract() {
  const form = document.getElementById('addContractForm')
  const data = {}
  new FormData(form).forEach((v, k) => { data[k] = v || null })
  if (!data.contract_number || !data.contract_type || !data.start_date) { showToast('Thiếu thông tin bắt buộc', 'error'); return }
  try {
    await API.post('/api/contracts', data)
    showToast('Thêm hợp đồng thành công!', 'success')
    closeModal()
    if (document.getElementById('contractTable')) loadContracts()
  } catch(e) { showToast('Lỗi: ' + (e.response?.data?.error || e.message), 'error') }
}

async function showEditContractModal(id) {
  try {
    const r = await API.get('/api/contracts')
    const c = r.data.data.find(x => x.id === id)
    if (!c) return showToast('Không tìm thấy HĐ', 'error')
    const lbl2 = (t) => `<label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">${t}</label>`
    showModal(`Chỉnh sửa hợp đồng: ${c.contract_number}`, `
    <form id="editContractForm">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>${lbl2('Loại HĐ')}<select name="contract_type"><option value="trial" ${c.contract_type==='trial'?'selected':''}>Thử việc</option><option value="fixed_term" ${c.contract_type==='fixed_term'?'selected':''}>Có thời hạn</option><option value="indefinite" ${c.contract_type==='indefinite'?'selected':''}>Vô thời hạn</option></select></div>
        <div>${lbl2('Trạng thái')}<select name="status"><option value="active" ${c.status==='active'?'selected':''}>Hiệu lực</option><option value="expired" ${c.status==='expired'?'selected':''}>Hết hiệu lực</option><option value="terminated" ${c.status==='terminated'?'selected':''}>Chấm dứt</option><option value="renewed" ${c.status==='renewed'?'selected':''}>Đã gia hạn</option></select></div>
        <div>${lbl2('Ngày bắt đầu')}<input type="date" name="start_date" value="${c.start_date||''}"></div>
        <div>${lbl2('Ngày kết thúc')}<input type="date" name="end_date" value="${c.end_date||''}"></div>
        <div>${lbl2('Lương (VNĐ)')}<input type="number" name="salary" value="${c.salary||0}"></div>
        <div>${lbl2('Nhắc trước (ngày)')}<input type="number" name="renewal_reminder_days" value="${c.renewal_reminder_days||30}"></div>
      </div>
      <div>${lbl2('Ghi chú')}<textarea name="notes" rows="2">${c.notes||''}</textarea></div>
    </form>`,
    `<button onclick="updateContract(${c.id})" class="btn-primary"><i class="fas fa-save"></i>Lưu</button>
     <button onclick="closeModal()" class="btn-ghost">Hủy</button>`)
  } catch(err) { showToast('Lỗi', 'error') }
}

async function updateContract(id) {
  const form = document.getElementById('editContractForm')
  const data = {}
  new FormData(form).forEach((v, k) => { data[k] = v || null })
  try {
    await API.put(`/api/contracts/${id}`, data)
    showToast('Cập nhật thành công!', 'success')
    closeModal()
    loadContracts()
  } catch(e) { showToast('Lỗi', 'error') }
}

async function deleteContract(id) {
  if (!confirm('Xác nhận xóa hợp đồng này?')) return
  try {
    await API.delete(`/api/contracts/${id}`)
    showToast('Đã xóa hợp đồng', 'success')
    loadContracts()
  } catch(e) { showToast('Lỗi xóa', 'error') }
}

// ===== LEAVES =====
async function renderLeaves() {
  document.getElementById('pageContent').innerHTML = `
  <div class="space-y-4">
    <div class="card p-4 flex gap-3 items-center">
      <select id="leaveFilter" class="w-40" onchange="loadLeaves()">
        <option value="">Tất cả</option>
        <option value="pending">Chờ duyệt</option>
        <option value="approved">Đã duyệt</option>
        <option value="rejected">Từ chối</option>
      </select>
      <button onclick="showAddLeaveModal()" class="btn-primary flex items-center gap-2">
        <i class="fas fa-plus"></i>Thêm đơn nghỉ
      </button>
    </div>
    <div id="leaveTable"></div>
  </div>`
  loadLeaves()
}

async function loadLeaves() {
  const status = document.getElementById('leaveFilter')?.value
  document.getElementById('leaveTable').innerHTML = `<div class="flex justify-center py-10"><div class="loading" style="border-color:#00A651;border-top-color:transparent"></div></div>`
  try {
    const params = status ? { status } : {}
    const r = await API.get('/api/leaves', { params })
    const leaves = r.data.data
    const typeNames = { annual: 'Nghỉ phép năm', sick: 'Nghỉ ốm đau', unpaid: 'Nghỉ không lương', maternity: 'Thai sản', other: 'Khác' }
    const statusBadge = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' }
    const statusLabel = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' }
    document.getElementById('leaveTable').innerHTML = `
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="bg-gray-50 border-b">
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nhân viên</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Loại nghỉ</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Từ ngày</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Đến ngày</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Số ngày</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lý do</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
            <th class="px-4 py-3 text-center">Thao tác</th>
          </tr></thead>
          <tbody>
            ${leaves.length === 0 ? '<tr><td colspan="8" class="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>' :
            leaves.map(l => `<tr class="table-row border-b">
              <td class="px-4 py-3"><div class="font-medium">${l.full_name}</div><div class="text-xs text-gray-500">${l.department||'—'} ${srcBadge(l.source_app)}</div></td>
              <td class="px-4 py-3"><span class="badge-warning">${typeNames[l.leave_type]||l.leave_type}</span></td>
              <td class="px-4 py-3">${fmtDate(l.start_date)}</td>
              <td class="px-4 py-3">${fmtDate(l.end_date)}</td>
              <td class="px-4 py-3 font-medium">${l.days} ngày</td>
              <td class="px-4 py-3 text-gray-600 text-xs">${l.reason||'—'}</td>
              <td class="px-4 py-3"><span class="${statusBadge[l.status]||''} text-xs px-2 py-1 rounded-full">${statusLabel[l.status]||l.status}</span></td>
              <td class="px-4 py-3 text-center">
                ${l.status==='pending'?`<button onclick="approveLeave(${l.id},'approved')" class="text-green-500 hover:text-green-700 mr-2" title="Duyệt"><i class="fas fa-check"></i></button>
                <button onclick="approveLeave(${l.id},'rejected')" class="text-red-500 hover:text-red-700" title="Từ chối"><i class="fas fa-times"></i></button>`:'—'}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`
  } catch(e) { showToast('Lỗi', 'error') }
}

function showAddLeaveModal() {
  const lbl = (t, req='') => `<label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">${t}${req?'<span style="color:#ef4444;margin-left:2px">*</span>':''}</label>`
  showModal('Thêm đơn nghỉ phép', `
  <form id="addLeaveForm">
    <div style="margin-bottom:12px">${lbl('ID Nhân viên',true)}<input name="employee_id" type="number" required placeholder="Nhập ID nhân viên"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>${lbl('Loại nghỉ')}<select name="leave_type"><option value="annual">Nghỉ phép năm</option><option value="sick">Nghỉ ốm đau</option><option value="unpaid">Không lương</option><option value="maternity">Thai sản</option><option value="other">Khác</option></select></div>
      <div>${lbl('Số ngày')}<input name="days" type="number" step="0.5" value="1" min="0.5"></div>
      <div>${lbl('Từ ngày',true)}<input name="start_date" type="date" required></div>
      <div>${lbl('Đến ngày',true)}<input name="end_date" type="date" required></div>
    </div>
    <div>${lbl('Lý do')}<textarea name="reason" rows="2" placeholder="Lý do nghỉ phép..."></textarea></div>
  </form>`,
  `<button onclick="addLeave()" class="btn-primary"><i class="fas fa-save"></i>Lưu đơn nghỉ</button>
   <button onclick="closeModal()" class="btn-ghost">Hủy</button>`)
}

async function addLeave() {
  const form = document.getElementById('addLeaveForm')
  const data = {}
  new FormData(form).forEach((v, k) => { data[k] = v || null })
  try {
    await API.post('/api/leaves', data)
    showToast('Thêm đơn nghỉ thành công!', 'success')
    closeModal()
    loadLeaves()
  } catch(e) { showToast('Lỗi: ' + (e.response?.data?.error || e.message), 'error') }
}

async function approveLeave(id, status) {
  try {
    await API.put(`/api/leaves/${id}`, { status })
    showToast(status === 'approved' ? 'Đã phê duyệt' : 'Đã từ chối', 'success')
    loadLeaves()
  } catch(e) { showToast('Lỗi', 'error') }
}

// ===== REMINDERS =====
async function renderReminders() {
  document.getElementById('pageContent').innerHTML = `
  <div class="space-y-4">
    <div class="card p-4 flex gap-3 items-center">
      <select id="reminderDays" class="w-48" onchange="loadReminders()">
        <option value="7">7 ngày tới</option>
        <option value="30" selected>30 ngày tới</option>
        <option value="60">60 ngày tới</option>
        <option value="90">90 ngày tới</option>
        <option value="365">Tất cả</option>
      </select>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" id="showResolved" onchange="loadReminders()">
        <span>Hiện đã xử lý</span>
      </label>
      <button onclick="showAddReminderModal()" class="btn-primary flex items-center gap-2 ml-auto">
        <i class="fas fa-plus"></i>Thêm nhắc nhở
      </button>
    </div>
    <div id="reminderList"></div>
  </div>`
  loadReminders()
}

async function loadReminders() {
  const days = document.getElementById('reminderDays')?.value || '30'
  const isResolved = document.getElementById('showResolved')?.checked ? '1' : '0'
  document.getElementById('reminderList').innerHTML = `<div class="flex justify-center py-10"><div class="loading" style="border-color:#00A651;border-top-color:transparent"></div></div>`
  try {
    const r = await API.get('/api/reminders', { params: { days, is_resolved: isResolved } })
    const reminders = r.data.data
    const typeIcons = { contract_expiry: 'fa-file-contract text-orange-500', probation_end: 'fa-user-clock text-blue-500', birthday: 'fa-birthday-cake text-pink-500', insurance: 'fa-shield-alt text-green-500', other: 'fa-bell text-gray-500' }
    const typeNames = { contract_expiry: 'HĐ hết hạn', probation_end: 'Hết thử việc', birthday: 'Sinh nhật', insurance: 'Bảo hiểm', other: 'Khác' }
    document.getElementById('reminderList').innerHTML = reminders.length === 0
      ? '<div class="card p-10 text-center text-gray-400"><i class="fas fa-bell-slash text-4xl mb-3"></i><p>Không có nhắc nhở nào</p></div>'
      : `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${reminders.map(r => `
        <div class="card p-4 urgency-${r.priority} ${r.is_resolved ? 'opacity-60' : ''}">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <i class="fas ${typeIcons[r.reminder_type]||'fa-bell text-gray-500'}"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                ${priorityBadge(r.priority)}
                <span class="text-xs text-gray-400">${typeNames[r.reminder_type]||r.reminder_type}</span>
              </div>
              <div class="font-medium text-gray-800 text-sm">${r.title}</div>
              <div class="text-xs text-gray-500 mt-1">${r.description||''}</div>
              <div class="flex items-center gap-3 mt-2">
                <span class="text-xs text-gray-600"><i class="far fa-calendar mr-1"></i>${fmtDate(r.remind_date)}</span>
                ${r.days_remaining !== null ? `<span class="text-xs font-medium ${r.days_remaining < 0 ? 'text-red-600' : r.days_remaining <= 7 ? 'text-orange-600' : 'text-gray-600'}">${r.days_remaining < 0 ? 'Trễ ' + Math.abs(r.days_remaining) + ' ngày' : r.days_remaining === 0 ? 'Hôm nay' : 'Còn ' + r.days_remaining + ' ngày'}</span>` : ''}
                ${r.full_name ? `<span class="text-xs text-gray-500">${srcBadge(r.source_app)} ${r.full_name}</span>` : ''}
              </div>
            </div>
            <div class="flex flex-col gap-2">
              ${!r.is_resolved ? `<button onclick="resolveReminder(${r.id});renderReminders()" class="text-green-600 hover:text-green-800 text-sm" title="Đánh dấu xử lý"><i class="fas fa-check-circle"></i></button>` : '<i class="fas fa-check-circle text-green-400"></i>'}
              <button onclick="deleteReminder(${r.id})" class="text-red-400 hover:text-red-600 text-sm" title="Xóa"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>`).join('')}
      </div>`
  } catch(e) { showToast('Lỗi tải nhắc nhở', 'error') }
}

function showAddReminderModal() {
  const lbl = (t, req='') => `<label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">${t}${req?'<span style="color:#ef4444;margin-left:2px">*</span>':''}</label>`
  showModal('Thêm nhắc nhở HCNS', `
  <form id="addReminderForm">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div style="grid-column:span 2">${lbl('Tiêu đề',true)}<input name="title" required placeholder="VD: HĐ ông Nguyễn Văn A hết hạn"></div>
      <div>${lbl('Loại nhắc nhở')}<select name="reminder_type"><option value="contract_expiry">HĐ hết hạn</option><option value="probation_end">Hết thử việc</option><option value="birthday">Sinh nhật</option><option value="insurance">Bảo hiểm</option><option value="other" selected>Khác</option></select></div>
      <div>${lbl('Mức độ')}<select name="priority"><option value="low">Thấp</option><option value="medium" selected>Trung bình</option><option value="high">Cao</option><option value="urgent">Khẩn</option></select></div>
      <div>${lbl('Ngày nhắc',true)}<input type="date" name="remind_date" required></div>
      <div>${lbl('ID Nhân viên (nếu có)')}<input name="employee_id" type="number" placeholder="Để trống nếu chung"></div>
    </div>
    <div>${lbl('Mô tả chi tiết')}<textarea name="description" rows="3" placeholder="Ghi chú thêm..."></textarea></div>
  </form>`,
  `<button onclick="addReminder()" class="btn-primary"><i class="fas fa-save"></i>Lưu nhắc nhở</button>
   <button onclick="closeModal()" class="btn-ghost">Hủy</button>`)
}

async function addReminder() {
  const form = document.getElementById('addReminderForm')
  const data = {}
  new FormData(form).forEach((v, k) => { data[k] = v || null })
  try {
    await API.post('/api/reminders', data)
    showToast('Thêm nhắc nhở thành công!', 'success')
    closeModal()
    loadReminders()
  } catch(e) { showToast('Lỗi: ' + (e.response?.data?.error || e.message), 'error') }
}

async function deleteReminder(id) {
  if (!confirm('Xóa nhắc nhở này?')) return
  try {
    await API.delete(`/api/reminders/${id}`)
    showToast('Đã xóa', 'success')
    loadReminders()
  } catch(e) { showToast('Lỗi', 'error') }
}

// ===== REPORTS =====
async function renderReports() {
  document.getElementById('pageContent').innerHTML = `<div class="flex justify-center py-10"><div class="loading" style="border-color:#00A651;border-top-color:transparent"></div></div>`
  try {
    const r = await API.get('/api/reports/employees')
    const { no_formal_contract, probation_ending, missing_info } = r.data
    document.getElementById('pageContent').innerHTML = `
    <div class="space-y-6">
      <!-- Nhân viên chưa có HĐ chính thức -->
      <div class="card p-5">
        <h3 class="font-semibold text-gray-800 mb-4"><i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>Nhân viên chưa có HĐ chính thức (${no_formal_contract.length})</h3>
        ${no_formal_contract.length === 0 ? '<p class="text-center text-green-600 py-4"><i class="fas fa-check-circle mr-2"></i>Tất cả đều có HĐ chính thức</p>' :
        `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-gray-50 border-b">
          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Nhân viên</th>
          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Nguồn</th>
          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Phòng ban</th>
          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Ngày vào</th>
          <th class="px-4 py-2 text-center text-xs font-semibold text-gray-500">Thao tác</th>
        </tr></thead><tbody>
          ${no_formal_contract.map(e => `<tr class="border-b table-row">
            <td class="px-4 py-2 font-medium">${e.full_name}</td>
            <td class="px-4 py-2">${srcBadge(e.source_app)}</td>
            <td class="px-4 py-2 text-gray-600">${e.department||'—'}</td>
            <td class="px-4 py-2 text-gray-600">${fmtDate(e.join_date)}</td>
            <td class="px-4 py-2 text-center"><button onclick="showAddContractModal(${e.id},'${e.full_name}')" class="text-blue-600 text-xs hover:underline">Thêm HĐ</button></td>
          </tr>`).join('')}
        </tbody></table></div>`}
      </div>

      <!-- Sắp hết thử việc -->
      <div class="card p-5">
        <h3 class="font-semibold text-gray-800 mb-4"><i class="fas fa-user-clock text-orange-500 mr-2"></i>Sắp kết thúc thử việc (14 ngày tới) (${probation_ending.length})</h3>
        ${probation_ending.length === 0 ? '<p class="text-center text-gray-400 py-4">Không có</p>' :
        `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${probation_ending.map(e => `<div class="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div class="w-10 h-10 bg-orange-200 rounded-full flex items-center justify-center text-orange-700 font-bold">${e.full_name.charAt(0)}</div>
            <div class="flex-1">
              <div class="font-medium text-sm">${e.full_name} ${srcBadge(e.source_app)}</div>
              <div class="text-xs text-gray-600">Hết TV: ${fmtDate(e.probation_end)} · <strong class="text-orange-700">Còn ${daysDiff(e.probation_end)} ngày</strong></div>
            </div>
            <button onclick="showAddContractModal(${e.id},'${e.full_name}')" class="btn-primary text-xs py-1 px-2">Ký HĐ</button>
          </div>`).join('')}
        </div>`}
      </div>

      <!-- Thiếu thông tin -->
      <div class="card p-5">
        <h3 class="font-semibold text-gray-800 mb-4"><i class="fas fa-clipboard-list text-blue-500 mr-2"></i>Nhân viên thiếu thông tin HCNS (${missing_info.length})</h3>
        ${missing_info.length === 0 ? '<p class="text-center text-green-600 py-4"><i class="fas fa-check-circle mr-2"></i>Tất cả đã có đủ thông tin</p>' :
        `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-gray-50 border-b">
          <th class="px-4 py-2 text-left text-xs text-gray-500">Nhân viên</th>
          <th class="px-4 py-2 text-left text-xs text-gray-500">Nguồn</th>
          <th class="px-4 py-2 text-center text-xs text-gray-500">Ngày sinh</th>
          <th class="px-4 py-2 text-center text-xs text-gray-500">CMND</th>
          <th class="px-4 py-2 text-center text-xs text-gray-500">MST</th>
          <th class="px-4 py-2 text-center text-xs text-gray-500">BHXH</th>
          <th class="px-4 py-2 text-center text-xs text-gray-500">Ngân hàng</th>
          <th class="px-4 py-2 text-center text-xs text-gray-500">Thao tác</th>
        </tr></thead><tbody>
          ${missing_info.map(e => {
            const miss = v => v ? '<i class="fas fa-check text-green-500"></i>' : '<i class="fas fa-times text-red-400"></i>'
            return `<tr class="border-b table-row">
              <td class="px-4 py-2 font-medium">${e.full_name}</td>
              <td class="px-4 py-2">${srcBadge(e.source_app)}</td>
              <td class="px-4 py-2 text-center">${miss(!e.no_dob)}</td>
              <td class="px-4 py-2 text-center">${miss(!e.no_id)}</td>
              <td class="px-4 py-2 text-center">${miss(!e.no_tax)}</td>
              <td class="px-4 py-2 text-center">${miss(!e.no_si)}</td>
              <td class="px-4 py-2 text-center">${miss(!e.no_bank)}</td>
              <td class="px-4 py-2 text-center"><button onclick="showEditEmployee(${e.id})" class="text-blue-600 text-xs hover:underline">Bổ sung</button></td>
            </tr>`}).join('')}
        </tbody></table></div>`}
      </div>
    </div>`
  } catch(e) { showToast('Lỗi tải báo cáo', 'error') }
}

// ===== SYNC =====
async function renderSync() {
  document.getElementById('pageContent').innerHTML = `<div class="flex justify-center py-10"><div class="loading" style="border-color:#00A651;border-top-color:transparent"></div></div>`
  try {
    const r = await API.get('/api/data-sources')
    const sources = r.data.data
    document.getElementById('pageContent').innerHTML = `
    <div class="space-y-6">

      <!-- HƯỚNG DẪN CHI TIẾT -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-800 text-base"><i class="fas fa-book-open text-blue-500 mr-2"></i>Cách lấy thông tin kết nối Cloudflare D1</h3>
          <button onclick="document.getElementById('guidePanel').classList.toggle('hidden')" class="text-xs text-blue-600 hover:underline">
            <i class="fas fa-chevron-down mr-1"></i>Ẩn/Hiện hướng dẫn
          </button>
        </div>
        <div id="guidePanel">
          <!-- 3 bước chính -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

            <!-- Bước 1: Account ID -->
            <div class="border border-blue-200 rounded-xl overflow-hidden">
              <div class="bg-blue-600 text-white px-4 py-2 flex items-center gap-2">
                <span class="w-6 h-6 bg-white text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <span class="font-semibold text-sm">Lấy Account ID</span>
              </div>
              <div class="p-4 bg-blue-50 space-y-2">
                <p class="text-xs text-gray-700">Đăng nhập Cloudflare Dashboard, sau đó nhìn vào <strong>thanh địa chỉ trình duyệt</strong>:</p>
                <div class="bg-white border border-blue-200 rounded-lg p-2 font-mono text-xs text-gray-600 break-all">
                  dash.cloudflare.com/<span class="bg-yellow-200 text-yellow-900 px-1 rounded font-bold">a1b2c3d4e5f6...</span>/workers-and-pages
                </div>
                <p class="text-xs text-blue-700"><i class="fas fa-arrow-right mr-1"></i>Đoạn chữ dài sau dấu <code>/</code> đầu tiên là <strong>Account ID</strong></p>
                <a href="https://dash.cloudflare.com" target="_blank" class="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors mt-1">
                  <i class="fas fa-external-link-alt"></i>Mở Cloudflare Dashboard
                </a>
              </div>
            </div>

            <!-- Bước 2: Database ID -->
            <div class="border border-green-200 rounded-xl overflow-hidden">
              <div class="bg-green-600 text-white px-4 py-2 flex items-center gap-2">
                <span class="w-6 h-6 bg-white text-green-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <span class="font-semibold text-sm">Lấy Database ID</span>
              </div>
              <div class="p-4 bg-green-50 space-y-2">
                <p class="text-xs text-gray-700">Trong Cloudflare Dashboard, theo đường dẫn:</p>
                <div class="bg-white border border-green-200 rounded-lg p-2 text-xs text-gray-700 space-y-1">
                  <div class="flex items-center gap-1"><i class="fas fa-layer-group text-green-500"></i><span><strong>Workers &amp; Pages</strong></span></div>
                  <div class="flex items-center gap-1 pl-3"><i class="fas fa-angle-right text-gray-400"></i><span><strong>D1 SQL Database</strong></span></div>
                  <div class="flex items-center gap-1 pl-6"><i class="fas fa-angle-right text-gray-400"></i><span>Click vào tên database BIM hoặc C3D</span></div>
                  <div class="flex items-center gap-1 pl-9"><i class="fas fa-angle-right text-gray-400"></i><span class="text-green-700 font-semibold">Copy "Database ID"</span></div>
                </div>
                <p class="text-xs text-green-700"><i class="fas fa-info-circle mr-1"></i>Database ID có dạng UUID: <code>xxxxxxxx-xxxx-xxxx-...</code></p>
              </div>
            </div>

            <!-- Bước 3: API Token -->
            <div class="border border-purple-200 rounded-xl overflow-hidden">
              <div class="bg-purple-600 text-white px-4 py-2 flex items-center gap-2">
                <span class="w-6 h-6 bg-white text-purple-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <span class="font-semibold text-sm">Tạo API Token</span>
              </div>
              <div class="p-4 bg-purple-50 space-y-2">
                <p class="text-xs text-gray-700">Tạo token để app HCNS đọc dữ liệu D1:</p>
                <div class="bg-white border border-purple-200 rounded-lg p-2 text-xs text-gray-700 space-y-1">
                  <div class="flex items-center gap-1"><i class="fas fa-user-circle text-purple-500"></i><span><strong>My Profile</strong> (icon góc trên phải)</span></div>
                  <div class="flex items-center gap-1 pl-3"><i class="fas fa-angle-right text-gray-400"></i><span><strong>API Tokens → Create Token</strong></span></div>
                  <div class="flex items-center gap-1 pl-3"><i class="fas fa-angle-right text-gray-400"></i><span>Chọn template <strong>"Read all resources"</strong></span></div>
                  <div class="flex items-center gap-1 pl-3"><i class="fas fa-angle-right text-gray-400"></i><span>Hoặc tự tạo với quyền <strong class="text-purple-700">D1 : Read</strong></span></div>
                </div>
                <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" class="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-lg transition-colors mt-1">
                  <i class="fas fa-external-link-alt"></i>Tạo API Token ngay
                </a>
              </div>
            </div>
          </div>

          <!-- Lưu ý bảo mật + sơ đồ luồng dữ liệu -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div class="font-semibold text-amber-800 text-xs mb-2"><i class="fas fa-shield-alt mr-1 text-amber-600"></i>Lưu ý bảo mật</div>
              <ul class="text-xs text-amber-800 space-y-1 list-disc list-inside">
                <li>Token chỉ cần quyền <strong>D1 : Read</strong> (không cần Write)</li>
                <li>Token được mã hóa lưu trong database HR, không hiển thị lại</li>
                <li>Có thể tạo token riêng cho từng app BIM / C3D</li>
                <li>Nếu lộ token → xóa ngay tại Cloudflare và tạo token mới</li>
              </ul>
            </div>
            <div class="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div class="font-semibold text-gray-700 text-xs mb-2"><i class="fas fa-project-diagram mr-1 text-gray-500"></i>Luồng dữ liệu đồng bộ</div>
              <div class="flex items-center gap-2 text-xs">
                <div class="text-center">
                  <div class="w-16 h-10 bg-blue-100 border border-blue-300 rounded-lg flex items-center justify-center text-blue-700 font-bold text-sm">BIM<br><span class="text-xs font-normal">D1 DB</span></div>
                </div>
                <div class="flex flex-col items-center gap-1 flex-1">
                  <div class="text-gray-400 text-xs">Cloudflare</div>
                  <div class="w-full border-t-2 border-dashed border-gray-300 relative">
                    <i class="fas fa-arrow-right absolute right-0 -top-2 text-gray-400 text-xs"></i>
                  </div>
                  <div class="text-gray-400 text-xs">D1 HTTP API</div>
                </div>
                <div class="text-center">
                  <div class="w-16 h-10 bg-green-100 border border-green-300 rounded-lg flex items-center justify-center text-green-700 font-bold text-sm">HR<br><span class="text-xs font-normal">D1 DB</span></div>
                </div>
                <div class="flex flex-col items-center gap-1 flex-1">
                  <div class="text-gray-400 text-xs">Cloudflare</div>
                  <div class="w-full border-t-2 border-dashed border-gray-300 relative">
                    <i class="fas fa-arrow-right absolute right-0 -top-2 text-gray-400 text-xs"></i>
                  </div>
                  <div class="text-gray-400 text-xs">D1 HTTP API</div>
                </div>
                <div class="text-center">
                  <div class="w-16 h-10 bg-emerald-100 border border-emerald-300 rounded-lg flex items-center justify-center text-emerald-700 font-bold text-sm">C3D<br><span class="text-xs font-normal">D1 DB</span></div>
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-2">App HCNS đọc trực tiếp từ D1 database của BIM và C3D qua Cloudflare REST API, không cần qua app trung gian.</p>
            </div>
          </div>
        </div>
      </div>

      ${sources.map(s => `
      <div class="card p-6" id="sourceCard_${s.app_name}">
        <div class="flex items-start justify-between mb-5">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg ${s.app_name==='BIM'?'bg-gradient-to-br from-blue-500 to-blue-700':'bg-gradient-to-br from-green-500 to-green-700'}">${s.app_name}</div>
            <div>
              <div class="font-bold text-gray-800 text-lg">${s.app_name} Project Management</div>
              <div class="flex items-center gap-3 mt-1">
                <span class="sync-status-badge text-xs px-3 py-1 rounded-full font-medium ${s.sync_status==='success'?'bg-green-100 text-green-700':s.sync_status==='error'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-500'}">
                  ${s.sync_status==='success'?'<i class="fas fa-check-circle mr-1"></i>Đồng bộ thành công':s.sync_status==='error'?'<i class="fas fa-times-circle mr-1"></i>Lỗi kết nối':'<i class="fas fa-clock mr-1"></i>Chưa đồng bộ'}
                </span>
                ${s.last_sync ? `<span class="sync-time text-xs text-gray-400"><i class="far fa-clock mr-1"></i>${dayjs(s.last_sync).format('DD/MM/YYYY HH:mm')}</span>` : '<span class="sync-time text-xs text-gray-400 hidden"></span>'}
              </div>
              <div class="sync-message text-xs mt-1 ${s.sync_status==='error'?'text-red-600':'text-gray-500'}">${s.sync_message || ''}</div>
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="testConnection('${s.app_name}',${s.id})" id="testBtn_${s.app_name}" class="border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
              <i class="fas fa-plug" id="testIcon_${s.app_name}"></i>Test kết nối
            </button>
            <button onclick="syncSource('${s.app_name}',${s.id})" id="syncBtn_${s.app_name}" class="${s.app_name==='BIM'?'bg-blue-600 hover:bg-blue-700':'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
              <i class="fas fa-sync-alt" id="syncIcon_${s.app_name}"></i>Đồng bộ ngay
            </button>
          </div>
        </div>

        <!-- Form cấu hình -->
        <div class="bg-gray-50 rounded-xl p-4 space-y-4">
          <div class="flex items-center gap-2 mb-1">
            <i class="fas fa-cog text-gray-400"></i>
            <span class="text-sm font-semibold text-gray-700">Cấu hình kết nối Cloudflare D1</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="text-xs font-medium text-gray-600 block mb-1">
                <i class="fas fa-id-card mr-1 text-blue-400"></i>Account ID *
              </label>
              <input id="accId_${s.id}" type="text" value="${s.cf_account_id||''}" 
                placeholder="a1b2c3d4e5f6..." class="font-mono text-sm"
                oninput="markDirty(${s.id})">
              <p class="text-xs text-gray-400 mt-1">Từ URL: dash.cloudflare.com/<strong>ACCOUNT_ID</strong>/</p>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-600 block mb-1">
                <i class="fas fa-database mr-1 text-green-400"></i>Database ID *
              </label>
              <input id="dbId_${s.id}" type="text" value="${s.cf_database_id||''}" 
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" class="font-mono text-sm"
                oninput="markDirty(${s.id})">
              <p class="text-xs text-gray-400 mt-1">Workers & Pages → D1 → Tên DB → Database ID</p>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-600 block mb-1">
                <i class="fas fa-key mr-1 text-purple-400"></i>API Token *
              </label>
              <div class="relative">
                <input id="apiToken_${s.id}" type="password" 
                  placeholder="${s.cf_api_token ? '••••••••••••••••' : 'Token với quyền D1:Read'}" 
                  class="font-mono text-sm pr-10"
                  oninput="markDirty(${s.id})">
                <button onclick="toggleTokenVis(${s.id})" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <i class="fas fa-eye" id="eyeIcon_${s.id}"></i>
                </button>
              </div>
              <p class="text-xs text-gray-400 mt-1">My Profile → API Tokens → Create Token</p>
            </div>
          </div>
          <div class="flex items-center justify-between pt-2">
            <div class="flex items-center gap-3">
              <button onclick="saveSource(${s.id},'${s.app_name}')" id="saveBtn_${s.id}" class="btn-primary text-sm py-1.5 px-4">
                <i class="fas fa-save mr-1"></i>Lưu cấu hình
              </button>
              <span id="dirtyHint_${s.id}" class="text-xs text-orange-500 hidden"><i class="fas fa-circle mr-1" style="font-size:6px"></i>Có thay đổi chưa lưu</span>
            </div>
            <a href="https://dash.cloudflare.com" target="_blank" class="text-xs text-blue-500 hover:underline">
              <i class="fas fa-external-link-alt mr-1"></i>Mở Cloudflare Dashboard
            </a>
          </div>
        </div>

        <!-- Trạng thái kết nối -->
        <div id="testResult_${s.app_name}" class="mt-4 hidden"></div>
      </div>`).join('')}
    </div>`
  } catch(e) { showToast('Lỗi tải cấu hình', 'error') }
}

function markDirty(id) {
  document.getElementById(`dirtyHint_${id}`)?.classList.remove('hidden')
}

function toggleTokenVis(id) {
  const inp = document.getElementById(`apiToken_${id}`)
  const icon = document.getElementById(`eyeIcon_${id}`)
  if (inp.type === 'password') { inp.type = 'text'; icon.classList.replace('fa-eye','fa-eye-slash') }
  else { inp.type = 'password'; icon.classList.replace('fa-eye-slash','fa-eye') }
}

// Lưu cấu hình — silent=true: không toast, chỉ trả false nếu thiếu bắt buộc
async function saveSource(id, appName, silent = false) {
  const accId = document.getElementById(`accId_${id}`)?.value?.trim()
  const dbId = document.getElementById(`dbId_${id}`)?.value?.trim()
  const token = document.getElementById(`apiToken_${id}`)?.value?.trim()
  // Thiếu accId / dbId → báo lỗi ngay cả khi silent
  if (!accId || !dbId) {
    if (!silent) showToast('Vui lòng nhập Account ID và Database ID', 'error')
    return false
  }
  try {
    await API.put(`/api/data-sources/${id}`, {
      cf_account_id: accId,
      cf_database_id: dbId,
      // Chỉ gửi token nếu người dùng vừa nhập; nếu để trống = giữ nguyên token cũ
      ...(token ? { cf_api_token: token } : {}),
      is_active: 1
    })
    document.getElementById(`dirtyHint_${id}`)?.classList.add('hidden')
    if (!silent) showToast(`Đã lưu cấu hình ${appName}`, 'success')
    return true
  } catch(e) {
    if (!silent) showToast('Lỗi lưu cấu hình: ' + (e.response?.data?.error || e.message), 'error')
    return false
  }
}

async function testConnection(appName, sourceId) {
  // Kiểm tra accId / dbId trước
  const accId = document.getElementById(`accId_${sourceId}`)?.value?.trim()
  const dbId = document.getElementById(`dbId_${sourceId}`)?.value?.trim()
  if (!accId || !dbId) { showToast('Vui lòng nhập đủ Account ID và Database ID trước', 'error'); return }
  // Lưu cấu hình im lặng (bảo toàn token cũ nếu không nhập mới)
  await saveSource(sourceId, appName, true)
  const btn = document.getElementById(`testBtn_${appName}`)
  const icon = document.getElementById(`testIcon_${appName}`)
  const resultDiv = document.getElementById(`testResult_${appName}`)
  btn.disabled = true
  icon.classList.add('fa-spin')
  resultDiv.className = 'mt-4'
  resultDiv.innerHTML = `<div class="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg"><div class="loading" style="border-color:#0066CC;border-top-color:transparent;width:16px;height:16px;border-width:2px"></div>Đang kiểm tra kết nối...</div>`
  try {
    const r = await API.post(`/api/sync/${appName}/test`)
    resultDiv.innerHTML = `<div class="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg"><i class="fas fa-check-circle text-green-500"></i>${r.data.message}</div>`
  } catch(e) {
    const msg = e.response?.data?.error || e.message
    resultDiv.innerHTML = `<div class="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg"><i class="fas fa-times-circle text-red-500 mr-2"></i><strong>Kết nối thất bại:</strong> ${msg}</div>`
  } finally {
    btn.disabled = false
    icon.classList.remove('fa-spin')
  }
}

async function syncSource(appName, sourceId) {
  // Kiểm tra accId / dbId trong form trước
  const accId = document.getElementById(`accId_${sourceId}`)?.value?.trim()
  const dbId = document.getElementById(`dbId_${sourceId}`)?.value?.trim()
  if (!accId || !dbId) {
    showToast('Vui lòng nhập đủ Account ID và Database ID trước', 'error')
    return
  }
  // Lưu cấu hình im lặng (chỉ update nếu có thay đổi)
  await saveSource(sourceId, appName, true)
  const btn = document.getElementById(`syncBtn_${appName}`)
  const icon = document.getElementById(`syncIcon_${appName}`)
  btn.disabled = true
  icon.classList.add('fa-spin')
  try {
    const r = await API.post(`/api/sync/${appName}`)
    showToast(`✓ Đồng bộ ${appName} thành công: +${r.data.added} mới, ~${r.data.updated} cập nhật (tổng ${r.data.total})`, 'success', 6000)
    // Chỉ cập nhật badge trạng thái, không re-render toàn bộ để tránh reset form
    refreshSyncStatus(appName, 'success', r.data)
  } catch(e) {
    const errMsg = e.response?.data?.error || e.message
    showToast('Lỗi đồng bộ: ' + errMsg, 'error', 8000)
    refreshSyncStatus(appName, 'error', null, errMsg)
  } finally {
    btn.disabled = false
    icon.classList.remove('fa-spin')
  }
}

// Cập nhật trạng thái sync trên card mà không re-render toàn bộ
function refreshSyncStatus(appName, status, data, errMsg) {
  const card = document.getElementById(`sourceCard_${appName}`)
  if (!card) return
  const badge = card.querySelector('.sync-status-badge')
  const timeEl = card.querySelector('.sync-time')
  const msgEl = card.querySelector('.sync-message')
  const now = dayjs().format('DD/MM/YYYY HH:mm')
  if (badge) {
    if (status === 'success') {
      badge.className = 'sync-status-badge text-xs px-3 py-1 rounded-full font-medium bg-green-100 text-green-700'
      badge.innerHTML = '<i class="fas fa-check-circle mr-1"></i>Đồng bộ thành công'
    } else {
      badge.className = 'sync-status-badge text-xs px-3 py-1 rounded-full font-medium bg-red-100 text-red-700'
      badge.innerHTML = '<i class="fas fa-times-circle mr-1"></i>Lỗi kết nối'
    }
  }
  if (timeEl) timeEl.innerHTML = `<i class="far fa-clock mr-1"></i>${now}`
  if (msgEl) {
    msgEl.className = `sync-message text-xs mt-1 ${status === 'error' ? 'text-red-600' : 'text-gray-500'}`
    msgEl.textContent = status === 'success' && data
      ? `Đồng bộ: +${data.added} mới, ~${data.updated} cập nhật (tổng ${data.total})`
      : (errMsg || '')
  }
}

// ===== SETTINGS =====
async function renderSettings() {
  document.getElementById('pageContent').innerHTML = `
  <div style="max-width:640px;display:flex;flex-direction:column;gap:20px">
    <div class="card" style="padding:24px">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-key" style="color:#0066CC"></i>Đổi mật khẩu
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Mật khẩu hiện tại</label><input type="password" id="oldPass" placeholder="Nhập mật khẩu hiện tại"></div>
        <div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Mật khẩu mới</label><input type="password" id="newPass" placeholder="Tối thiểu 6 ký tự"></div>
        <div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Xác nhận mật khẩu mới</label><input type="password" id="confirmPass" placeholder="Nhập lại mật khẩu mới"></div>
        <div><button onclick="changePassword()" class="btn-primary"><i class="fas fa-save"></i>Đổi mật khẩu</button></div>
      </div>
    </div>
    ${currentUser?.role === 'hr_admin' ? `
    <div class="card" style="padding:24px">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-users-cog" style="color:#7c3aed"></i>Quản lý tài khoản HCNS
      </div>
      <div id="hrUsersList"></div>
      <div style="margin-top:14px"><button onclick="showAddHRUserModal()" class="btn-primary"><i class="fas fa-plus"></i>Thêm tài khoản</button></div>
    </div>
    <div class="card" style="padding:24px">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:8px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-database" style="color:#ef4444"></i>Khởi tạo lại hệ thống
      </div>
      <p style="font-size:13px;color:#64748b;margin-bottom:14px">Tạo lại toàn bộ cấu trúc database và tài khoản mặc định. Dữ liệu hiện tại sẽ KHÔNG bị xóa.</p>
      <button onclick="initSystem()" class="btn-danger"><i class="fas fa-sync"></i>Khởi tạo hệ thống</button>
    </div>` : ''}
  </div>`

  if (currentUser?.role === 'hr_admin') loadHRUsers()
}

async function changePassword() {
  const oldPass = document.getElementById('oldPass').value
  const newPass = document.getElementById('newPass').value
  const confirmPass = document.getElementById('confirmPass').value
  if (!oldPass || !newPass) { showToast('Vui lòng nhập đầy đủ', 'error'); return }
  if (newPass !== confirmPass) { showToast('Mật khẩu xác nhận không khớp', 'error'); return }
  if (newPass.length < 6) { showToast('Mật khẩu mới ít nhất 6 ký tự', 'error'); return }
  try {
    await API.post('/api/auth/change-password', { old_password: oldPass, new_password: newPass })
    showToast('Đổi mật khẩu thành công!', 'success')
    document.getElementById('oldPass').value = ''
    document.getElementById('newPass').value = ''
    document.getElementById('confirmPass').value = ''
  } catch(e) { showToast(e.response?.data?.error || 'Lỗi đổi mật khẩu', 'error') }
}

async function loadHRUsers() {
  try {
    const r = await API.get('/api/hr-users')
    document.getElementById('hrUsersList').innerHTML = `
    <div class="space-y-2">
      ${r.data.data.map(u => `<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <div class="w-8 h-8 rounded-full ${u.role==='hr_admin'?'bg-purple-500':'bg-blue-500'} flex items-center justify-center text-white text-sm font-bold">${u.full_name.charAt(0)}</div>
        <div class="flex-1">
          <div class="font-medium text-sm">${u.full_name}</div>
          <div class="text-xs text-gray-500">${u.username} · ${u.role==='hr_admin'?'Quản trị HCNS':'Nhân viên HCNS'}</div>
        </div>
        <span class="${u.is_active?'badge-active':'badge-inactive'}">${u.is_active?'Hoạt động':'Tạm khóa'}</span>
      </div>`).join('')}
    </div>`
  } catch(e) {}
}

function showAddHRUserModal() {
  const lbl = (t, req='') => `<label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">${t}${req?'<span style="color:#ef4444;margin-left:2px">*</span>':''}</label>`
  showModal('Thêm tài khoản HCNS', `
  <form id="addHRForm">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>${lbl('Tên đăng nhập',true)}<input name="username" required placeholder="VD: nguyen.van.a"></div>
      <div>${lbl('Mật khẩu',true)}<input name="password" type="password" required placeholder="Tối thiểu 6 ký tự"></div>
      <div>${lbl('Họ và tên',true)}<input name="full_name" required placeholder="Nguyễn Văn A"></div>
      <div>${lbl('Email')}<input name="email" type="email" placeholder="email@company.com"></div>
      <div style="grid-column:span 2">${lbl('Phân quyền')}
        <select name="role"><option value="hr_staff">Nhân viên HCNS</option><option value="hr_admin">Quản trị HCNS</option></select></div>
    </div>
  </form>`,
  `<button onclick="addHRUser()" class="btn-primary"><i class="fas fa-save"></i>Tạo tài khoản</button>
   <button onclick="closeModal()" class="btn-ghost">Hủy</button>`)
}

async function addHRUser() {
  const form = document.getElementById('addHRForm')
  const data = {}
  new FormData(form).forEach((v, k) => { data[k] = v || null })
  try {
    await API.post('/api/hr-users', data)
    showToast('Tạo tài khoản thành công!', 'success')
    closeModal()
    loadHRUsers()
  } catch(e) { showToast('Lỗi: ' + (e.response?.data?.error || e.message), 'error') }
}

// ===== INIT =====
async function init() {
  const token = getToken()
  if (token) {
    try {
      const r = await API.get('/api/auth/me')
      currentUser = r.data.user
      showApp()
    } catch { showLogin() }
  } else { showLogin() }
}

init()
