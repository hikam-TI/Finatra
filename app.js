/**
 * FINATRA TRACKER v2.1 - Production Architecture
 * ===============================================
 * FIX LOG v2.1:
 * - Auth: Nama sekarang diambil dari database saat login (bukan dari input)
 * - Register & Login dipisah logikanya agar nama tidak tertimpa
 * - Validasi nama wajib diisi saat mode register
 */

// ==========================================
// 1. DATABASE SERVICE
// ==========================================
class DatabaseService {
  constructor(mode = 'dev') {
    this.mode = mode;
    this.PREFIX = 'FINATRA_';
    if (mode === 'prod') {
      console.info('[DB] Production Mode: Ganti dengan Supabase/Firebase SDK.');
    }
  }

  _getStore(key) {
    if (this.mode === 'prod') throw new Error('Use production client');
    const data = localStorage.getItem(this.PREFIX + key);
    return data ? JSON.parse(data) : null;
  }
  _setStore(key, value) {
    if (this.mode === 'prod') throw new Error('Use production client');
    localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
  }

  async login(phone, pin) {
    if (this.mode === 'dev') {
      const users = this._getStore('users') || {};
      // Cari user berdasarkan phone & pin
      const user = Object.values(users).find(u => u.phone === phone && u.pin === pin);
      if (!user) return { success: false, error: 'Nomor atau PIN salah.' };
      
      const token = btoa(JSON.stringify({ phone, ts: Date.now() }));
      const session = { token, user };
      this._setStore('session', session);
      
      // ✅ RETURN data user LENGKAP dari database (termasuk nama asli)
      return { success: true, data: user };
    }
    return { success: true, data: { name: 'User Prod' } };
  }

  async register(name, phone, pin) {
  if (this.mode === 'dev') {
    let users = this._getStore('users') || {};
    if (Object.values(users).find(u => u.phone === phone)) {
      return { success: false, error: 'Nomor sudah terdaftar.' };
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // ✅ Generate dan simpan avatar URL
    const avatarUrl = this._generateAvatarUrl(name, id);
    
    users[id] = { 
      id, 
      name: name, 
      phone, 
      pin, 
      avatarUrl,  // ✅ Simpan avatar URL
      createdAt: now,
      applications: [],
      loans: []
    };
    this._setStore('users', users);
    return { success: true };
  }
  return { success: true };
}

/**
 * Generate avatar URL untuk disimpan di database
 * Menggunakan inisial nama yang sama dengan getAvatarUrl()
 */
_generateAvatarUrl(name, id) {
  const nameStr = name || id || 'User';
  const seed = nameStr.toLowerCase().trim();
  
  // Ambil inisial
  const words = nameStr.trim().split(/\s+/);
  let initials = '';
  if (words.length >= 2) {
    initials = words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase();
  } else {
    initials = words[0].charAt(0).toUpperCase();
  }
  
  // Warna background
  const colors = [
    { bg: '#FF7B00', text: '#FFFFFF' },
    { bg: '#FF9644', text: '#FFFFFF' },
    { bg: '#800000', text: '#FFFFFF' },
    { bg: '#562F00', text: '#FFFFFF' },
    { bg: '#FFCE99', text: '#562F00' },
    { bg: '#E67E22', text: '#FFFFFF' },
    { bg: '#D35400', text: '#FFFFFF' },
    { bg: '#F39C12', text: '#FFFFFF' }
  ];
  
  const colorIdx = Math.abs(this._hashCode(seed)) % colors.length;
  const color = colors[colorIdx];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="bg_${seed.replace(/[^a-z0-9]/g, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color.bg};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${this._lightenColor(color.bg, 15)};stop-opacity:1" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#bg_${seed.replace(/[^a-z0-9]/g, '')})" />
    <text x="50" y="50" font-size="${initials.length === 1 ? '50' : '40'}" font-family="Arial, sans-serif" font-weight="bold" fill="${color.text}" text-anchor="middle" dominant-baseline="central">${initials}</text>
  </svg>`;
  
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Hash function untuk DatabaseService
 */
_hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Lighten color untuk gradient
 */
_lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1);
}

/**
 * Hash function untuk DatabaseService
 */
_hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

  getSession() { return this._getStore('session'); }
  clearSession() { localStorage.removeItem(this.PREFIX + 'session'); }

  async getTransactions() {
    if (this.mode === 'dev') return this._getStore('transactions') || this._seedTransactions();
    return [];
  }

  async savePreferences(prefs) {
    if (this.mode === 'dev') this._setStore('preferences', prefs);
  }

  _seedTransactions() {
    const txs = [
      { id: 'KW-88421', date: '2026-06-15', amount: 2500000, method: 'AstraPay', status: 'Success' },
      { id: 'KW-88390', date: '2026-05-15', amount: 2500000, method: 'Transfer Bank', status: 'Success' },
      { id: 'KW-88201', date: '2026-04-15', amount: 2500000, method: 'Virtual Account', status: 'Pending' },
      { id: 'KW-87992', date: '2026-03-15', amount: 2500000, method: 'AstraPay', status: 'Success' },
      { id: 'KW-87801', date: '2026-02-15', amount: 2500000, method: 'AstraPay', status: 'Success' },
    ];
    this._setStore('transactions', txs);
    return txs;
  }
}

const DB = new DatabaseService('dev');

// ==========================================
// 2. APP CONTROLLER
// ==========================================
const App = {
  state: { user: null, view: 'dashboard', autopay: false, frequency: 'weekly' },

  init() {
    this.setupEventListeners();
    this.checkSession();
    this.setupScrollAnimations();
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 60000);
  },

  setupEventListeners() {
    // ===== AUTH TOGGLE (Register <-> Login) =====
    document.getElementById('auth-toggle').addEventListener('click', (e) => {
      const title = document.getElementById('auth-title');
      const btnText = document.querySelector('.btn-text');
      const nameField = document.getElementById('register-name-field');
      const isReg = title.textContent.includes('Daftar');
      
      if (isReg) {
        title.textContent = 'Selamat Datang Kembali';
        btnText.textContent = 'Masuk ke Dashboard';
        e.target.textContent = 'Belum punya akun? Daftar Sekarang';
        nameField.classList.add('hidden');
      } else {
        title.textContent = 'Daftar Akun Baru';
        btnText.textContent = 'Buat Akun Sekarang';
        e.target.textContent = 'Sudah punya akun? Masuk';
        nameField.classList.remove('hidden');
      }
    });

    // ===== AUTH SUBMIT (FIXED: nama dari DB saat login) =====
    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('phone').value.trim();
      const pin = document.getElementById('pin').value.trim();
      const isReg = document.getElementById('auth-title').textContent.includes('Daftar');
      
      // Ambil nama dari input HANYA saat register
      const nameInput = document.getElementById('name');
      const name = isReg ? (nameInput?.value?.trim() || '') : '';

      // Validasi
      if (!/^[0-9]{10,13}$/.test(phone)) return this.toast('Nomor HP tidak valid (10-13 digit).', 'error');
      if (!/^\d{6}$/.test(pin)) return this.toast('PIN harus 6 digit angka.', 'error');
      if (isReg && !name) return this.toast('Nama lengkap wajib diisi saat mendaftar.', 'error');

      const btn = document.getElementById('auth-submit');
      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Memproses...`;

      try {
        // STEP 1: Jika mode register, simpan user dulu
        if (isReg) {
          const regRes = await DB.register(name, phone, pin);
          if (!regRes.success) {
            this.toast(regRes.error, 'error');
            return;
          }
        }
        
        // STEP 2: Login untuk mendapatkan data user LENGKAP dari database
        const loginRes = await DB.login(phone, pin);
        
        if (loginRes.success) {
          // ✅ FIX: Gunakan data user dari database (termasuk nama asli "Budi")
          // JANGAN ambil dari input, karena saat login field name kosong/hidden
          this.state.user = loginRes.data;
          this._enterApp();
          this.toast(`Selamat datang, ${loginRes.data.name}!`);
        } else {
          this.toast(loginRes.error, 'error');
        }
      } catch (err) {
        console.error(err);
        this.toast('Gagal terhubung ke server.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    });

    // ===== ROUTING =====
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.route));
    });

    // ===== SIDEBAR TOGGLE =====
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('-translate-x-full');
    });

    // ===== ASTRAPAY AUTO-DEBIT =====
    document.getElementById('autopay-toggle').addEventListener('change', (e) => {
      this.state.autopay = e.target.checked;
      this.toast(this.state.autopay ? `Auto-Debit AKTIF (${this.state.frequency})` : 'Auto-Debit dinonaktifkan');
    });
    document.querySelectorAll('input[name="frequency"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.state.frequency = e.target.value;
        document.querySelectorAll('input[name="frequency"]').forEach(r => {
          r.parentElement.classList.toggle('border-finOrange', r.checked);
          r.parentElement.classList.toggle('bg-finPeach/10', r.checked);
          r.parentElement.classList.toggle('border-gray-200', !r.checked);
        });
        if (this.state.autopay) this.toast(`Frekuensi diubah ke ${this.state.frequency}`);
      });
    });

    // ===== CHATBOT =====
    document.getElementById('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      if (!input.value.trim()) return;
      this.chatBot.sendMessage(input.value);
      input.value = '';
    });

    // ===== AI MATCHING =====
    document.getElementById('ai-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.aiEngine.evaluate();
    });

    // ===== TABLE FILTER =====
    document.getElementById('search-tx').addEventListener('input', (e) => this.renderTransactions(null, e.target.value));
    document.getElementById('filter-date').addEventListener('change', (e) => this.renderTransactions(e.target.value));

    // ===== LOGOUT =====
    document.getElementById('logout-btn').addEventListener('click', () => { 
      if (confirm('Yakin ingin keluar?')) {
        DB.clearSession(); 
        location.reload(); 
      }
    });

    // ===== TESTIMONIAL FORM =====
    document.getElementById('testimonial-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.toast('Terima kasih! Testimoni Anda akan direview.');
      e.target.reset();
    });

    // ===== STAR RATING =====
    document.querySelectorAll('#testimonial-form .fa-star').forEach(star => {
      star.addEventListener('click', () => {
        const rate = parseInt(star.dataset.rate);
        document.querySelectorAll('#testimonial-form .fa-star').forEach((s, i) => {
          s.classList.toggle('text-gray-300', i >= rate);
          s.classList.toggle('text-finOrange', i < rate);
        });
      });
    });

    // ===== BACK TO TOP =====
    window.addEventListener('scroll', () => {
      const btn = document.getElementById('back-to-top');
      if (window.scrollY > 300) { btn.classList.remove('hidden'); btn.classList.add('flex'); }
      else { btn.classList.add('hidden'); btn.classList.remove('flex'); }
      btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ===== FAQ ACCORDION =====
    document.querySelectorAll('.faq-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const content = btn.querySelector('div:last-child');
        const icon = btn.querySelector('.fa-chevron-down');
        content.classList.toggle('hidden');
        icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    });

    // ===== OCR UPLOAD =====
    document.querySelectorAll('.ocr-upload-area').forEach(area => {
      area.addEventListener('click', () => area.querySelector('.ocr-input').click());
      area.querySelector('.ocr-input').addEventListener('change', (e) => this.ocrService.process(e, area));
    });
  },

  checkSession() {
    const session = DB.getSession();
    if (session?.user) { 
      this.state.user = session.user; 
      this._enterApp(); 
    }
  },

    _enterApp() {
  document.getElementById('view-auth').classList.add('opacity-0', 'pointer-events-none');
  setTimeout(() => document.getElementById('view-auth').classList.add('hidden'), 500);
  document.getElementById('app-shell').classList.remove('hidden');
  
  const user = this.state.user;
  const userName = user.name || 'Mitra';
  
  // ✅ Update nama
  document.getElementById('user-display').textContent = userName;
  document.getElementById('profile-name').textContent = userName;
  
  // ✅ Update avatar dengan fallback
  const avatarUrl = user.avatarUrl || this.getAvatarUrl(user);
  const fallbackUrl = this.getFallbackAvatar(user);
  
  const profileAvatar = document.getElementById('profile-avatar');
  const topbarAvatar = document.getElementById('topbar-avatar');
  
  if (profileAvatar) {
    profileAvatar.src = avatarUrl;
    profileAvatar.onerror = () => { 
      console.log('Avatar API gagal, menggunakan fallback');
      profileAvatar.src = fallbackUrl; 
    };
  }
  
  if (topbarAvatar) {
    topbarAvatar.src = avatarUrl;
    topbarAvatar.onerror = () => { 
      topbarAvatar.src = fallbackUrl; 
    };
  }
  
  // ✅ Update tanggal bergabung
  const joinDateEl = document.getElementById('join-date');
  if (joinDateEl) {
    joinDateEl.textContent = `Bergabung sejak ${this.formatJoinDate(user.createdAt)}`;
  }
  
  // ✅ Update ID user
  const profileId = document.getElementById('profile-id');
  if (profileId && user.id) {
    const shortId = user.id.replace(/-/g, '').substring(0, 5).toUpperCase();
    profileId.textContent = `FIN-2026-${shortId}`;
  }
  
  this.loadDashboard();
  this.navigate('dashboard');
},

  navigate(viewName) {
    this.state.view = viewName;
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.route === viewName);
      n.classList.toggle('text-gray-600', n.dataset.route !== viewName);
      n.classList.toggle('text-finOrange', n.dataset.route === viewName);
      n.classList.toggle('bg-finPeach/10', n.dataset.route === viewName);
    });
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.toggle('hidden', sec.id !== `view-${viewName}`);
    });
    const titles = {
      dashboard: 'Dashboard Tracker',
      matching: 'AI Matching',
      ews: 'AI Warning System',
      chatbot: 'AI Chatbot 24/7',
      testimonial: 'Testimoni Nasabah'
    };
    document.getElementById('page-title').textContent = titles[viewName] || 'Dashboard';
    document.getElementById('content-area').scrollTop = 0;
    document.getElementById('sidebar').classList.add('-translate-x-full');
  },

  async loadDashboard() {
  const txs = await DB.getTransactions();
  this.renderTransactions(null, null, txs);
  
  // ✅ Cek apakah user punya data
  const userLoans = this.state.user.loans || [];
  const hasActiveLoan = userLoans.length > 0;
  
  // ✅ Update statistik berdasarkan data user
  this.updateDashboardStats(hasActiveLoan);
  
  // ✅ Cek pengajuan
  const userApps = this.state.user.applications || [];
  if (userApps.length > 0) {
    this.renderApplicationProgress(userApps[0]);
  } else {
    this.renderNoApplication();
  }
  
  // ✅ Render payment progress
  if (hasActiveLoan) {
    this.renderPaymentProgress(userLoans[0]);
  } else {
    this.renderEmptyPaymentProgress();
  }
  
  this.renderCalendar();
  this.renderEWSTimeline();
  this.renderNotifications();
},

/**
 * Update statistik dashboard berdasarkan data user
 */
updateDashboardStats(hasActiveLoan) {
  const limitEl = document.querySelector('#view-dashboard .card-skeu:nth-child(3) h3');
  const loanEl = document.querySelector('#view-dashboard .card-skeu:nth-child(3) .card-skeu:nth-child(2) h3');
  const paidEl = document.querySelector('#view-dashboard .card-skeu:nth-child(3) .card-skeu:nth-child(3) h3');
  
  if (hasActiveLoan) {
    // Jika ada pinjaman aktif, tampilkan data
    const loan = this.state.user.loans[0];
    if (limitEl) limitEl.textContent = this.formatRupiah(loan.remainingLimit || 45000000);
    if (loanEl) loanEl.textContent = this.formatRupiah(loan.activeLoan || 25000000);
    if (paidEl) paidEl.textContent = this.formatRupiah(loan.paidAmount || 0);
  } else {
    // ✅ Akun baru: tampilkan 0
    if (limitEl) limitEl.textContent = 'Rp 0';
    if (loanEl) loanEl.textContent = 'Rp 0';
    if (paidEl) paidEl.textContent = 'Rp 0';
    
    // Update progress bar jadi 0%
    const progressBar = document.querySelector('#view-dashboard .card-skeu:nth-child(3) .bg-finOrange');
    if (progressBar) progressBar.style.width = '0%';
  }
},

  /**
 * Render ketika belum ada pengajuan pembiayaan
 */
renderNoApplication() {
  const container = document.querySelector('.card-skeu:nth-child(2)'); // Card kedua adalah application progress
  if (!container) return;
  
  container.innerHTML = `
    <div class="p-8 text-center">
      <div class="w-20 h-20 bg-finPeach/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-file-signature text-4xl text-finOrange"></i>
      </div>
      <h4 class="font-semibold text-finDeep text-lg mb-2">Belum Ada Pengajuan Pembiayaan</h4>
      <p class="text-sm text-gray-500 mb-6">Mulai ajukan pembiayaan untuk mengembangkan usaha Anda. Proses cepat dengan AI Matching.</p>
      <button onclick="App.navigate('matching')" class="btn-primary px-6 py-2.5 rounded-lg font-medium shadow-md inline-flex items-center gap-2">
        <i class="fas fa-brain"></i>
        <span>Cek Kemampuan & Ajukan</span>
      </button>
    </div>
  `;
},

/**
 * Render progress pengajuan (jika sudah ada)
 */
renderApplicationProgress(application) {
  const container = document.querySelector('.card-skeu:nth-child(2)');
  if (!container) return;
  
  const steps = [
    { label: 'Ajukan', icon: 'fa-file', status: application.step >= 1 ? 'done' : '' },
    { label: 'Verifikasi', icon: 'fa-check-double', status: application.step >= 2 ? 'done' : '' },
    { label: 'OCR', icon: 'fa-camera', status: application.step >= 3 ? 'done' : '' },
    { label: 'Approval', icon: 'fa-stamp', status: application.step >= 4 ? 'done' : '' },
    { label: 'Pencairan', icon: 'fa-money-bill-wave', status: application.step >= 5 ? 'done' : 'current' }
  ];
  
  const progressWidth = ((application.step - 1) / 4) * 100;
  const statusText = application.step === 5 ? 'Disetujui' : 
                     application.step === 4 ? 'Dalam Approval' :
                     application.step === 3 ? 'Verifikasi Dokumen' :
                     application.step === 2 ? 'Verifikasi Data' : 'Menunggu Verifikasi';
  
  const statusColor = application.step === 5 ? 'green' : 
                      application.step === 4 ? 'finOrange' : 'gray';
  
  container.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <h4 class="font-semibold text-finDeep flex items-center gap-2">
        <i class="fas fa-file-signature text-finOrange"></i> Progres Pengajuan Pembiayaan
      </h4>
      <span class="text-xs bg-${statusColor}-100 text-${statusColor}-700 px-3 py-1 rounded-full font-semibold">
        ${statusText}
      </span>
    </div>
    <div class="relative">
      <div class="flex justify-between mb-2 text-xs text-gray-500">
        <span>Ajukan</span><span>Verifikasi</span><span>OCR</span><span>Approval</span><span>Pencairan</span>
      </div>
      <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
        <div class="bg-gradient-to-r from-finBright to-finOrange h-2 rounded-full transition-all" style="width: ${progressWidth}%"></div>
      </div>
      <div class="flex justify-between mt-2">
        ${steps.map((step, idx) => `
          <div class="flex flex-col items-center">
            <div class="w-8 h-8 rounded-full ${step.status === 'done' ? 'bg-finOrange text-white' : step.status === 'current' ? 'bg-finOrange text-white animate-pulse' : 'bg-gray-200 text-gray-400'} flex items-center justify-center text-xs transition-all">
              <i class="fas ${step.status === 'done' ? 'fa-check' : step.icon}"></i>
            </div>
            ${idx < 4 ? '<div class="w-12 h-0.5 bg-gray-200 mt-4 absolute" style="margin-left: 60px;"></div>' : ''}
          </div>
        `).join('')}
      </div>
    </div>
    ${application.amount ? `
      <p class="text-xs text-gray-500 mt-4">
        Pengajuan dana sebesar <span class="font-semibold text-finDeep">${this.formatRupiah(application.amount)}</span> 
        ${application.step === 5 ? `telah disetujui pada ${this.formatDate(application.updatedAt)}` : ''}
      </p>
    ` : ''}
  `;
},

/**
 * Render payment progress kosong untuk user baru
 */
renderEmptyPaymentProgress() {
  const grid = document.getElementById('payment-progress-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  grid.className = 'grid grid-cols-12 gap-2';
  
  for (let i = 1; i <= 12; i++) {
    const block = document.createElement('div');
    block.className = 'payment-block upcoming cursor-pointer hover:scale-110 transition-transform';
    block.innerHTML = `<span class="text-[10px]">${i}</span>`;
    block.title = `Angsuran ke-${i} - Belum Tersedia`;
    block.onclick = () => this.showInstallmentDetail(i, null);
    grid.appendChild(block);
  }
  
  // Tambahkan info text
  const infoDiv = document.createElement('div');
  infoDiv.className = 'col-span-12 text-center mt-3 text-xs text-gray-500';
  infoDiv.innerHTML = '<i class="fas fa-info-circle mr-1"></i>Klik nomor angsuran untuk melihat detail. Angsuran akan tersedia setelah pencairan pinjaman.';
  grid.appendChild(infoDiv);
},

/**
 * Render payment progress dengan data
 */
renderPaymentProgress(loan) {
  const grid = document.getElementById('payment-progress-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  grid.className = 'grid grid-cols-12 gap-2';
  
  const currentInstallment = loan.currentInstallment || 1;
  const paidInstallments = loan.paidInstallments || [];
  
  for (let i = 1; i <= 12; i++) {
    const block = document.createElement('div');
    const isPaid = paidInstallments.includes(i);
    const isCurrent = i === currentInstallment && !isPaid;
    
    let cls = 'upcoming cursor-pointer hover:scale-110';
    let icon = `<span class="text-[10px]">${i}</span>`;
    let title = `Angsuran ke-${i}`;
    
    if (isPaid) {
      cls = 'paid cursor-pointer hover:scale-110';
      icon = '<i class="fas fa-check text-xs"></i>';
      title += ' - Lunas';
    } else if (isCurrent) {
      cls = 'current cursor-pointer animate-pulse hover:scale-110';
      icon = `<span class="text-[10px]">${i}</span>`;
      title += ' - Berjalan';
    } else {
      title += ' - Belum Tersedia';
    }
    
    block.className = `payment-block ${cls}`;
    block.innerHTML = icon;
    block.title = title;
    block.onclick = () => this.showInstallmentDetail(i, loan);
    grid.appendChild(block);
  }
},

/**
 * Tampilkan detail angsuran
 */
showInstallmentDetail(installmentNum, loan) {
  const isPaid = loan && loan.paidInstallments?.includes(installmentNum);
  const isCurrent = loan && installmentNum === loan.currentInstallment && !isPaid;
  const isUpcoming = !loan || installmentNum > loan.currentInstallment;
  
  const amount = loan ? this.formatRupiah(loan.installmentAmount || 2500000) : '-';
  const dueDate = loan ? this.formatDate(new Date(loan.startDate).setMonth(new Date(loan.startDate).getMonth() + installmentNum - 1)) : '-';
  const paidDate = isPaid ? this.formatDate(new Date()) : '-';
  
  const statusHtml = isPaid 
    ? '<span class="inline-flex items-center gap-1 text-green-600 font-semibold"><i class="fas fa-check-circle"></i> Lunas</span>'
    : isCurrent 
    ? '<span class="inline-flex items-center gap-1 text-finOrange font-semibold"><i class="fas fa-clock"></i> Berjalan</span>'
    : '<span class="inline-flex items-center gap-1 text-gray-400"><i class="fas fa-lock"></i> Belum Tersedia</span>';
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in';
  modal.innerHTML = `
    <div class="card-skeu w-full max-w-md mx-4 p-6 rounded-2xl animate-slide-down">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold text-finDeep">Detail Angsuran ke-${installmentNum}</h3>
        <button onclick="this.closest('.fixed').remove()" class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="space-y-4">
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <span class="text-sm text-gray-600">Status</span>
          ${statusHtml}
        </div>
        
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <span class="text-sm text-gray-600">Nominal</span>
          <span class="font-bold text-finDeep">${amount}</span>
        </div>
        
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <span class="text-sm text-gray-600">Jatuh Tempo</span>
          <span class="font-semibold text-finDeep">${dueDate}</span>
        </div>
        
        ${isPaid ? `
          <div class="flex justify-between items-center p-3 bg-green-50 rounded-lg">
            <span class="text-sm text-green-700">Tanggal Bayar</span>
            <span class="font-semibold text-green-700">${paidDate}</span>
          </div>
        ` : ''}
        
        ${isCurrent ? `
          <button class="btn-primary w-full py-3 rounded-lg font-semibold shadow-md mt-4">
            <i class="fas fa-wallet mr-2"></i>Bayar Sekarang
          </button>
        ` : ''}
        
        ${isUpcoming ? `
          <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
            <i class="fas fa-info-circle mr-1"></i>Angsuran ini akan tersedia setelah angsuran sebelumnya lunas.
          </div>
        ` : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
},

/**
 * Format rupiah
 */
formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
},

/**
 * Format date
 */
formatDate(dateInput) {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
},

  renderTransactions(dateFilter = null, textFilter = null, data = []) {
    const tbody = document.getElementById('tx-table-body');
    tbody.innerHTML = '';
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">Tidak ada data.</td></tr>';
      return;
    }
    let filtered = data;
    if (dateFilter) filtered = filtered.filter(tx => tx.date === dateFilter);
    if (textFilter) {
      const q = textFilter.toLowerCase();
      filtered = filtered.filter(tx => tx.id.toLowerCase().includes(q) || tx.method.toLowerCase().includes(q));
    }
    filtered.forEach(tx => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-3 font-mono text-xs text-gray-600">${tx.id}</td>
        <td class="px-4 py-3 text-sm">${tx.date}</td>
        <td class="px-4 py-3 font-medium text-finDeep">${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(tx.amount)}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${tx.method}</td>
        <td class="px-4 py-3"><span class="status-badge status-${tx.status.toLowerCase()}">${tx.status}</span></td>
      `;
      tbody.appendChild(tr);
    });
  },

  renderPaymentProgress() {
    const grid = document.getElementById('payment-progress-grid');
    grid.innerHTML = '';
    const current = 4;
    for (let i = 1; i <= 12; i++) {
      const block = document.createElement('div');
      let cls = 'upcoming';
      let icon = i;
      if (i < current) { cls = 'paid'; icon = '<i class="fas fa-check"></i>'; }
      else if (i === current) cls = 'current';
      block.className = `payment-block ${cls}`;
      block.innerHTML = icon;
      block.title = `Angsuran ke-${i}`;
      grid.appendChild(block);
    }
  },

  renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    const now = new Date(2026, 5, 20);
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const dueDate = 25;
    const paidDates = [5, 15];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = document.createElement('div');
      d.className = 'cal-day other-month';
      d.textContent = daysInPrev - i;
      grid.appendChild(d);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = document.createElement('div');
      let cls = 'cal-day';
      if (i === now.getDate()) cls += ' today';
      if (i === dueDate) cls += ' due';
      if (paidDates.includes(i)) cls += ' paid';
      d.className = cls;
      d.textContent = i;
      grid.appendChild(d);
    }
    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = document.createElement('div');
      d.className = 'cal-day other-month';
      d.textContent = i;
      grid.appendChild(d);
    }
  },

  renderEWSTimeline() {
    const timeline = document.getElementById('ews-timeline');
    const stages = [
      { label: 'H-14 Sebelum Jatuh Tempo', desc: 'Pengingat awal: cicilan akan jatuh tempo dalam 2 minggu.', status: 'done', date: '11 Juni 2026' },
      { label: 'H-7 Sebelum Jatuh Tempo', desc: 'Pengingat mingguan: pastikan saldo AstraPay mencukupi.', status: 'done', date: '18 Juni 2026' },
      { label: 'H-3 Sebelum Jatuh Tempo', desc: 'Perhatian: cicilan akan jatuh tempo dalam 3 hari.', status: 'done', date: '22 Juni 2026' },
      { label: 'H-1 Sebelum Jatuh Tempo', desc: 'Besok adalah hari jatuh tempo. Segera lakukan pembayaran.', status: 'active', date: '24 Juni 2026' },
      { label: 'Hari H - Jatuh Tempo', desc: 'Hari ini adalah tanggal jatuh tempo cicilan Anda.', status: '', date: '25 Juni 2026' },
      { label: 'H+1 - Pengingat Denda', desc: 'Jika belum bayar, denda Rp 50.000 akan dikenakan.', status: '', date: '26 Juni 2026' },
      { label: 'H+3 - Peringatan Terakhir', desc: 'Denda Rp 150.000. Risiko penurunan skor kredit.', status: 'danger', date: '28 Juni 2026' }
    ];

    timeline.innerHTML = '';
    stages.forEach(s => {
      const div = document.createElement('div');
      div.className = `ews-item ${s.status}`;
      div.innerHTML = `
        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div class="flex justify-between items-start mb-1">
            <h5 class="font-semibold text-sm text-finDeep">${s.label}</h5>
            <span class="text-[10px] text-gray-400">${s.date}</span>
          </div>
          <p class="text-xs text-gray-600">${s.desc}</p>
          ${s.status === 'active' ? '<span class="inline-block mt-2 text-[10px] bg-finOrange/10 text-finOrange px-2 py-0.5 rounded-full">AKTIF SEKARANG</span>' : ''}
          ${s.status === 'done' ? '<span class="inline-block mt-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Terkirim</span>' : ''}
          ${s.status === 'danger' ? '<span class="inline-block mt-2 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Kritis</span>' : ''}
        </div>
      `;
      timeline.appendChild(div);
    });
  },

  renderNotifications() {
    const dropdown = document.getElementById('notif-dropdown');
    const notifs = [
      { icon: 'bell', color: 'finOrange', msg: 'H-1: Cicilan jatuh tempo besok' },
      { icon: 'check-circle', color: 'green-500', msg: 'Pembayaran H-14 berhasil dikirim' },
      { icon: 'check-circle', color: 'green-500', msg: 'Pembayaran H-7 berhasil dikirim' },
      { icon: 'wallet', color: 'finOrange', msg: 'AstraPay Auto-Debit aktif' }
    ];
    dropdown.innerHTML = notifs.map(n => `
      <div class="p-2 bg-gray-50 rounded-lg border-l-2 border-${n.color} text-xs flex items-start gap-2">
        <i class="fas fa-${n.icon} text-${n.color} mt-0.5"></i>
        <span>${n.msg}</span>
      </div>
    `).join('');
  },

  updateDateTime() {
    const now = new Date();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('greeting-text').textContent = now.toLocaleDateString('id-ID', opts);
  },

  setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('active'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  },

  toast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle text-red-500' : 'check-circle text-green-500'}"></i><span class="text-sm font-medium text-gray-700">${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  },
  /**
 * Generate avatar SVG dengan inisial nama
 * - Profesional dan clean
 * - Setiap nama menghasilkan inisial & warna unik
 * - Contoh: "Budi Santoso" → "BS", "Ahmad" → "A"
 */
getAvatarUrl(user) {
  const name = user.name || user.phone || 'User';
  const seed = name.toLowerCase().trim();
  
  // Ambil inisial (maksimal 2 huruf)
  const initials = this._getInitials(name);
  
  // Warna background unik berdasarkan hash nama
  const colors = [
    { bg: '#FF7B00', text: '#FFFFFF' },  // Orange FINATRA
    { bg: '#FF9644', text: '#FFFFFF' },  // Bright orange
    { bg: '#800000', text: '#FFFFFF' },  // Maroon
    { bg: '#562F00', text: '#FFFFFF' },  // Deep brown
    { bg: '#FFCE99', text: '#562F00' },  // Peach dengan text gelap
    { bg: '#E67E22', text: '#FFFFFF' },  // Dark orange
    { bg: '#D35400', text: '#FFFFFF' },  // Pumpkin
    { bg: '#F39C12', text: '#FFFFFF' }   // Golden
  ];
  
  const colorIdx = Math.abs(this._hashCode(seed)) % colors.length;
  const color = colors[colorIdx];
  
  // Generate SVG dengan inisial
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="bg_${seed.replace(/[^a-z0-9]/g, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color.bg};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${this._lightenColor(color.bg, 15)};stop-opacity:1" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#bg_${seed.replace(/[^a-z0-9]/g, '')})" />
    <text x="50" y="50" font-size="${initials.length === 1 ? '50' : '40'}" font-family="Arial, sans-serif" font-weight="bold" fill="${color.text}" text-anchor="middle" dominant-baseline="central">${initials}</text>
  </svg>`;
  
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
},

/**
 * Ambil inisial dari nama (maksimal 2 huruf)
 * - "Budi Santoso" → "BS"
 * - "Ahmad" → "A"
 * - "Siti Rahayu Dewi" → "SR"
 */
_getInitials(name) {
  if (!name) return 'U';
  
  const words = name.trim().split(/\s+/);
  let initials = '';
  
  if (words.length >= 2) {
    // Ambil huruf pertama dari 2 kata pertama
    initials = words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase();
  } else {
    // Hanya 1 kata, ambil 1 huruf pertama
    initials = words[0].charAt(0).toUpperCase();
  }
  
  return initials;
},

/**
 * Hash function untuk menghasilkan angka konsisten dari string
 */
_hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
},

/**
 * Lighten color untuk gradient effect
 */
_lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1);
},

  /**
   * Format tanggal bergabung ke format Indonesia yang mudah dibaca
   * Contoh: "20 Juni 2026"
   */
  formatJoinDate(isoString) {
    if (!isoString) return 'Baru saja bergabung';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return 'Baru saja bergabung';
    }
  },
};

// ==========================================
// 3. AI MATCHING ENGINE
// ==========================================
const AIEngine = {
  locationFactor: {
    jakarta: 1.0, bandung: 0.95, surabaya: 0.98, semarang: 0.92,
    yogyakarta: 0.90, medan: 0.88, makassar: 0.85, denpasar: 0.93, lainnya: 0.80
  },
  collateralFactor: {
    bpb_mobil: 1.2, sertifikat: 1.5, bpb_motor: 0.8
  },

  evaluate() {
    const revenue = parseFloat(document.getElementById('revenue').value) || 0;
    const capability = parseFloat(document.getElementById('capability').value) || 0;
    const location = document.getElementById('location').value;
    const collateral = document.getElementById('collateral').value;
    const assetYear = parseInt(document.getElementById('asset-year').value) || 2020;
    const resultsContainer = document.getElementById('ai-results');

    if (revenue === 0 || capability === 0) return App.toast('Lengkapi pendapatan & kemampuan bayar.', 'error');

    const dti = capability / revenue;
    const locFactor = this.locationFactor[location] || 0.8;
    const colFactor = this.collateralFactor[collateral] || 1.0;
    const ageFactor = Math.max(0.5, 1 - ((2026 - assetYear) * 0.05));

    const baseLimit = capability * 12;
    const adjustedLimit = baseLimit * locFactor * colFactor * ageFactor;
    
    const tenors = [
      { label: '6 Bulan', value: 6, interest: 1.2 },
      { label: '12 Bulan', value: 12, interest: 1.0 },
      { label: '24 Bulan', value: 24, interest: 0.95 },
      { label: '36 Bulan', value: 36, interest: 0.90 }
    ];

    const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    resultsContainer.innerHTML = `
      <div class="card-skeu p-5 rounded-2xl reveal active">
        <h4 class="font-semibold text-finDeep mb-3">Ringkasan Analisis</h4>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="p-2 bg-finPeach/20 rounded-lg">
            <p class="text-gray-500">DTI Ratio</p>
            <p class="font-bold text-finDeep">${(dti * 100).toFixed(1)}%</p>
          </div>
          <div class="p-2 bg-finPeach/20 rounded-lg">
            <p class="text-gray-500">Skor Lokasi</p>
            <p class="font-bold text-finDeep">${(locFactor * 100).toFixed(0)}%</p>
          </div>
          <div class="p-2 bg-finPeach/20 rounded-lg">
            <p class="text-gray-500">Nilai Agunan</p>
            <p class="font-bold text-finDeep">${(colFactor * 100).toFixed(0)}%</p>
          </div>
          <div class="p-2 bg-finPeach/20 rounded-lg">
            <p class="text-gray-500">Kondisi Aset</p>
            <p class="font-bold text-finDeep">${(ageFactor * 100).toFixed(0)}%</p>
          </div>
        </div>
        <div class="mt-4 p-3 bg-gradient-to-r from-finOrange/10 to-finPeach/20 rounded-lg">
          <p class="text-xs text-gray-600">Jumlah Pinjaman Ideal</p>
          <p class="text-2xl font-bold text-finOrange">${fmt(adjustedLimit)}</p>
        </div>
      </div>

      <div class="card-skeu p-5 rounded-2xl reveal active">
        <h4 class="font-semibold text-finDeep mb-3">Rekomendasi Tenor</h4>
        <div class="space-y-2">
          ${tenors.map(t => {
            const monthly = (adjustedLimit / t.value) * (1 + t.interest / 100);
            const feasible = monthly <= capability;
            return `
              <div class="p-3 rounded-lg border-2 ${feasible ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'}">
                <div class="flex justify-between items-center">
                  <div>
                    <p class="font-semibold text-sm">${t.label}</p>
                    <p class="text-[10px] text-gray-500">Bunga ${t.interest}%/bulan</p>
                  </div>
                  <div class="text-right">
                    <p class="font-bold text-sm ${feasible ? 'text-green-700' : 'text-gray-500'}">${fmt(monthly)}/bln</p>
                    <p class="text-[10px] ${feasible ? 'text-green-600' : 'text-red-500'}">${feasible ? '✓ Direkomendasikan' : '✗ Melebihi kemampuan'}</p>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="card-skeu p-5 rounded-2xl reveal active">
        <h4 class="font-semibold text-finDeep mb-3">Kategori Risiko</h4>
        ${this.renderRiskCards(dti, adjustedLimit)}
      </div>
    `;

    App.toast('Analisis AI selesai. Lihat rekomendasi di panel kanan.');
  },

  renderRiskCards(dti, limit) {
    const cards = [
      { label: 'Sangat Aman', desc: 'DTI < 25%. Limit maksimal dengan bunga preferensial.', color: 'green', active: dti < 0.25 },
      { label: 'Aman', desc: 'DTI 25-50%. Pengajuan moderat dengan tenor fleksibel.', color: 'yellow', active: dti >= 0.25 && dti < 0.5 },
      { label: 'Berisiko', desc: 'DTI > 50%. Disarankan tenor pendek atau penjamin.', color: 'red', active: dti >= 0.5 }
    ];
    return cards.map(c => `
      <div class="p-3 rounded-lg border-2 ${c.active ? (c.color === 'red' ? 'border-red-300 bg-red-50' : c.color === 'yellow' ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50 ring-2 ring-offset-2 ring-finOrange') : 'border-gray-200 opacity-50'} mb-2">
        <div class="flex justify-between items-center">
          <span class="font-bold text-sm ${c.color === 'red' ? 'text-red-600' : c.color === 'yellow' ? 'text-yellow-600' : 'text-green-600'}">${c.label}</span>
          ${c.active ? '<i class="fas fa-check-circle text-finOrange"></i>' : ''}
        </div>
        <p class="text-xs text-gray-600 mt-1">${c.desc}</p>
      </div>
    `).join('');
  }
};

// ==========================================
// 4. AI CHATBOT
// ==========================================
const Chatbot = {
  matrix: {
    'bayar': 'Anda dapat membayar melalui Dashboard > Riwayat Transaksi, atau aktifkan AstraPay Auto-Debit untuk potongan otomatis.',
    'bunga': 'Suku bunga FINATRA mulai 0.89%/bulan flat, tergantung profil risiko dan tenor yang dipilih.',
    'telat': 'Denda H+1: Rp 50.000, H+3: Rp 150.000. Aktifkan auto-debit untuk menghindari denda.',
    'limit': 'Limit ditentukan berdasarkan DTI, jenis agunan, lokasi, dan riwayat kredit (SLIK OJK).',
    'kontak': 'Hubungi CS 24/7: 0800-123-4567 atau email support@finatra.id',
    'ocr': 'OCR (Optical Character Recognition) memverifikasi KTP/KK/BPKB otomatis untuk mempercepat pengajuan.',
    'astrapay': 'AstraPay Auto-Debit memotong cicilan otomatis (harian/mingguan/bulanan) dari saldo AstraPay Anda.',
    'ews': 'AI Warning System mengirim pengingat H-14, H-7, H-3, H-1, Hari H, H+1, dan H+3 via WA/SMS/Email.',
    'matching': 'AI Matching menganalisis pendapatan, kemampuan bayar, lokasi, dan agunan untuk rekomendasi limit ideal.',
    'testimoni': 'Lihat testimoni nasabah di menu Testimoni. Anda juga bisa membagikan pengalaman Anda di sana.',
    'default': 'Maaf, saya belum memahami. Coba tanya tentang: bayar, bunga, telat, limit, ocr, astrapay, ews, matching, testimoni.'
  },

  sendMessage(text) {
    const container = document.getElementById('chat-history');
    this.appendBubble(text, 'user');
    const typingEl = this.appendBubble('<i class="fas fa-circle-notch fa-spin"></i> Menganalisis database...', 'ai');
    container.scrollTop = container.scrollHeight;

    setTimeout(() => {
      container.removeChild(typingEl);
      const response = this.process(text.toLowerCase());
      this.appendBubble(response, 'ai');
      container.scrollTop = container.scrollHeight;
    }, 900);
  },

  appendBubble(html, sender) {
    const container = document.getElementById('chat-history');
    const div = document.createElement('div');
    div.className = 'flex gap-3 items-start animate-fade-in';
    div.innerHTML = sender === 'user'
      ? `<div class="ml-auto bg-finOrange text-white p-3 rounded-tl-xl rounded-bl-xl rounded-br-xl shadow-sm text-xs max-w-[80%]">${html}</div>`
      : `<div class="w-6 h-6 rounded-full bg-finOrange/20 flex-shrink-0 flex items-center justify-center text-[10px] text-finOrange"><i class="fas fa-robot"></i></div>
         <div class="bg-white p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl shadow-sm text-xs text-gray-700 max-w-[80%]">${html}</div>`;
    container.appendChild(div);
    return div;
  },

  process(text) {
    const matches = [];
    for (const [key, val] of Object.entries(this.matrix)) {
      if (key !== 'default' && text.includes(key)) matches.push(val);
    }
    if (matches.length > 0) return matches[0];
    return this.matrix.default;
  }
};

// ==========================================
// 5. OCR SERVICE (Mock)
// ==========================================
const OCRService = {
  process(event, area) {
    const file = event.target.files[0];
    if (!file) return;
    
    area.classList.add('opacity-50');
    area.innerHTML = `<i class="fas fa-circle-notch fa-spin text-2xl text-finOrange mb-1"></i><p class="text-xs">Memproses OCR...</p>`;

    setTimeout(() => {
      area.classList.remove('opacity-50');
      area.classList.add('uploaded');
      area.innerHTML = `
        <i class="fas fa-check-circle text-3xl text-green-500 mb-2"></i>
        <p class="text-sm font-semibold text-green-700">Terverifikasi</p>
        <p class="text-[10px] text-gray-500 mt-1">${file.name.substring(0, 20)}...</p>
      `;
      
      const resultEl = document.getElementById('ocr-result');
      const resultText = document.getElementById('ocr-result-text');
      if (resultEl && resultText) {
        resultEl.classList.remove('hidden');
        resultText.textContent = `Dokumen "${file.name}" berhasil diverifikasi via OCR. Data terekstrak: Nama, NIK, Alamat.`;
      }
      
      App.toast('OCR berhasil memverifikasi dokumen.');
    }, 1500);
  }
};

// ==========================================
// 6. TESTIMONIAL MANAGER
// ==========================================
const TestimonialManager = {
  data: [
    { name: 'Budi Santoso', role: 'Pemilik Warung Makan', location: 'Jakarta', rating: 5, text: 'FINATRA membantu saya mengembangkan usaha warung. Proses cepat, AI Matching sangat akurat menentukan limit yang pas.', avatar: 'budi' },
    { name: 'Siti Rahayu', role: 'Pengusaha Konveksi', location: 'Bandung', rating: 5, text: 'AstraPay Auto-Debit sangat memudahkan. Tidak pernah telat bayar, denda nol. Recommended untuk UMKM!', avatar: 'siti' },
    { name: 'Ahmad Wijaya', role: 'Pemilik Bengkel', location: 'Surabaya', rating: 4, text: 'EWS 7-tahap sangat membantu. Saya selalu ingat jatuh tempo. OCR juga cepat, pengajuan cuma 1 hari.', avatar: 'ahmad' },
    { name: 'Dewi Lestari', role: 'Pemilik Toko Kelontong', location: 'Yogyakarta', rating: 5, text: 'AI Chatbot responsif 24/7. Pertanyaan apapun dijawab cepat. Customer service terbaik yang pernah saya temui.', avatar: 'dewi' },
    { name: 'Hendra Kusuma', role: 'Distributor Sembako', location: 'Medan', rating: 5, text: 'Limit yang direkomendasikan AI sangat pas dengan kemampuan bayar saya. Tidak over-borrowing. Terima kasih FINATRA!', avatar: 'hendra' },
    { name: 'Rina Marlina', role: 'Pemilik Catering', location: 'Semarang', rating: 5, text: 'Dashboard tracker sangat informatif. Progres pembayaran, kalender jatuh tempo, semua lengkap di satu tempat.', avatar: 'rina' }
  ],

  render() {
    const grid = document.getElementById('testimonial-grid');
    if (!grid) return;
    grid.innerHTML = this.data.map(t => `
      <div class="card-skeu p-5 rounded-2xl testimonial-card reveal">
        <div class="flex items-center gap-3 mb-3">
          <img src="https://picsum.photos/seed/${t.avatar}/64/64" alt="${t.name}" class="w-12 h-12 rounded-full border-2 border-finPeach">
          <div>
            <h5 class="font-semibold text-sm text-finDeep">${t.name}</h5>
            <p class="text-[10px] text-gray-500">${t.role} • ${t.location}</p>
          </div>
        </div>
        <div class="flex gap-0.5 mb-2">
          ${'<i class="fas fa-star text-finOrange text-xs"></i>'.repeat(t.rating)}
          ${'<i class="fas fa-star text-gray-300 text-xs"></i>'.repeat(5 - t.rating)}
        </div>
        <p class="text-xs text-gray-600 leading-relaxed italic">"${t.text}"</p>
      </div>
    `).join('');
  }
};

// ==========================================
// 7. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  App.aiEngine = AIEngine;
  App.chatBot = Chatbot;
  App.ocrService = OCRService;
  App.testimonialManager = TestimonialManager;
  
  App.init();
  TestimonialManager.render();
  
  setTimeout(() => App.setupScrollAnimations(), 100);
});