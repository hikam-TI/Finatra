/**
 * FINATRA TRACKER v3.0 - FINAL PRODUCTION
 * ========================================
 * FITUR LENGKAP:
 * - Avatar: Inline SVG dengan inisial nama
 * - UUID: Fallback untuk crypto.randomUUID()
 * - Auth: Nama dari database saat login
 * - Dashboard: Reset ke 0 untuk akun baru
 * - AI Matching: Limit 70% agunan, Bunga 9-16%, Tenor 12-60
 * - Payment: 4 metode (AstraPay, Transfer, VA, Minimarket)
 * - Payment History: Tersimpan per user
 */

// ==========================================
// UUID GENERATOR (Fallback untuk HTTP)
// ==========================================
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==========================================
// 1. DATABASE SERVICE
// ==========================================
class DatabaseService {
  constructor(mode = 'dev') {
    this.mode = mode;
    this.PREFIX = 'FINATRA_';
  }

  _getStore(key) {
    const data = localStorage.getItem(this.PREFIX + key);
    return data ? JSON.parse(data) : null;
  }

  _setStore(key, value) {
    localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
  }

  async login(phone, pin) {
    const users = this._getStore('users') || {};
    const user = Object.values(users).find(u => u.phone === phone && u.pin === pin);
    if (!user) return { success: false, error: 'Nomor atau PIN salah.' };
    
    const token = btoa(JSON.stringify({ phone, ts: Date.now() }));
    const session = { token, user };
    this._setStore('session', session);
    
    return { success: true, data: user };
  }

  async register(name, phone, pin) {
    let users = this._getStore('users') || {};
    if (Object.values(users).find(u => u.phone === phone)) {
      return { success: false, error: 'Nomor sudah terdaftar.' };
    }
    
    const id = generateUUID();
    const now = new Date().toISOString();
    const avatarUrl = this._generateAvatarUrl(name, id);
    
    users[id] = { 
      id, 
      name: name, 
      phone, 
      pin, 
      avatarUrl,
      createdAt: now,
      applications: [],
      loans: [],
      paymentHistory: []
    };
    this._setStore('users', users);
    return { success: true };
  }

  _generateAvatarUrl(name, id) {
    const nameStr = name || id || 'User';
    const initials = this._getInitials(nameStr);
    
    const colors = [
      { bg: '#FF7B00', text: '#FFFFFF' },
      { bg: '#FF9644', text: '#FFFFFF' },
      { bg: '#800000', text: '#FFFFFF' },
      { bg: '#FFCE99', text: '#562F00' },
      { bg: '#E67E22', text: '#FFFFFF' },
      { bg: '#D35400', text: '#FFFFFF' }
    ];
    
    const hash = this._hashCode(nameStr.toLowerCase());
    const color = colors[Math.abs(hash) % colors.length];
    const fontSize = initials.length === 1 ? '45' : '35';
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="100" height="100" fill="${color.bg}" rx="50"/>
      <text x="50" y="50" font-family="Arial, sans-serif" font-weight="bold" 
            font-size="${fontSize}" fill="${color.text}" 
            text-anchor="middle" dominant-baseline="central">
        ${initials}
      </text>
    </svg>`;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  _getInitials(name) {
    if (!name) return 'U';
    const words = name.trim().split(/\s+/);
    let initials = '';
    if (words.length >= 2) {
      initials = words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase();
    } else if (words[0].length > 0) {
      initials = words[0].charAt(0).toUpperCase();
    } else {
      initials = 'U';
    }
    return initials;
  }

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
    return this._getStore('transactions') || this._seedTransactions();
  }

  _seedTransactions() {
    const txs = [];
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

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('phone').value.trim();
      const pin = document.getElementById('pin').value.trim();
      const isReg = document.getElementById('auth-title').textContent.includes('Daftar');
      
      const nameInput = document.getElementById('name');
      const name = isReg ? (nameInput?.value?.trim() || '') : '';

      if (!/^[0-9]{10,13}$/.test(phone)) return this.toast('Nomor HP tidak valid (10-13 digit).', 'error');
      if (!/^\d{6}$/.test(pin)) return this.toast('PIN harus 6 digit angka.', 'error');
      if (isReg && !name) return this.toast('Nama lengkap wajib diisi saat mendaftar.', 'error');

      const btn = document.getElementById('auth-submit');
      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Memproses...`;

      try {
        if (isReg) {
          const regRes = await DB.register(name, phone, pin);
          if (!regRes.success) {
            this.toast(regRes.error, 'error');
            return;
          }
        }
        
        const loginRes = await DB.login(phone, pin);
        
        if (loginRes.success) {
          this.state.user = loginRes.data;
          this._enterApp();
          this.toast(`Selamat datang, ${loginRes.data.name}!`);
        } else {
          this.toast(loginRes.error, 'error');
        }
      } catch (err) {
        console.error('Auth error:', err);
        this.toast('Gagal terhubung ke server: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    });

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.route));
    });

    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('-translate-x-full');
    });

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

    document.getElementById('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      if (!input.value.trim()) return;
      this.chatBot.sendMessage(input.value);
      input.value = '';
    });

    document.getElementById('ai-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.aiEngine.evaluate();
    });

    document.getElementById('search-tx').addEventListener('input', (e) => this.renderTransactions(null, e.target.value));
    document.getElementById('filter-date').addEventListener('change', (e) => this.renderTransactions(e.target.value));

    document.getElementById('logout-btn').addEventListener('click', () => { 
      if (confirm('Yakin ingin keluar?')) {
        DB.clearSession(); 
        location.reload(); 
      }
    });

    document.getElementById('testimonial-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.toast('Terima kasih! Testimoni Anda akan direview.');
      e.target.reset();
    });

    document.querySelectorAll('#testimonial-form .fa-star').forEach(star => {
      star.addEventListener('click', () => {
        const rate = parseInt(star.dataset.rate);
        document.querySelectorAll('#testimonial-form .fa-star').forEach((s, i) => {
          s.classList.toggle('text-gray-300', i >= rate);
          s.classList.toggle('text-finOrange', i < rate);
        });
      });
    });

    window.addEventListener('scroll', () => {
      const btn = document.getElementById('back-to-top');
      if (window.scrollY > 300) { btn.classList.remove('hidden'); btn.classList.add('flex'); }
      else { btn.classList.add('hidden'); btn.classList.remove('flex'); }
      btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.querySelectorAll('.faq-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const content = btn.querySelector('div:last-child');
        const icon = btn.querySelector('.fa-chevron-down');
        content.classList.toggle('hidden');
        icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    });

    document.querySelectorAll('.ocr-upload-area').forEach(area => {
      area.addEventListener('click', () => area.querySelector('.ocr-input').click());
      area.querySelector('.ocr-input').addEventListener('change', (e) => this.ocrService.process(e, area));
    });

    // ✅ BARU: Event listener untuk tombol Bayar Sekarang
    const btnPay = document.getElementById('btn-pay-now');
    if (btnPay) {
      btnPay.addEventListener('click', () => this.processPayment());
    }
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
    
    document.getElementById('user-display').textContent = userName;
    document.getElementById('profile-name').textContent = userName;
    
    const avatarUrl = user.avatarUrl || this.getAvatarUrl(user);
    
    const profileAvatar = document.getElementById('profile-avatar');
    const topbarAvatar = document.getElementById('topbar-avatar');
    
    if (profileAvatar) profileAvatar.src = avatarUrl;
    if (topbarAvatar) topbarAvatar.src = avatarUrl;
    
    const joinDateEl = document.getElementById('join-date');
    if (joinDateEl) {
      joinDateEl.textContent = `Bergabung sejak ${this.formatJoinDate(user.createdAt)}`;
    }
    
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
    
    const userLoans = this.state.user.loans || [];
    const hasActiveLoan = userLoans.length > 0;
    
    this.updateDashboardStats(hasActiveLoan);
    
    const userApps = this.state.user.applications || [];
    if (userApps.length > 0) {
      this.renderApplicationProgress(userApps[0]);
    } else {
      this.renderNoApplication();
    }
    
    if (hasActiveLoan) {
      this.renderPaymentProgress(userLoans[0]);
    } else {
      this.renderEmptyPaymentProgress();
    }
    
    this.renderCalendar();
    this.renderEWSTimeline();
    this.renderNotifications();
    
    // ✅ BARU: Render info pembayaran & riwayat
    this.renderPaymentInfo();
    this.renderMyPaymentHistory();
  },

  updateDashboardStats(hasActiveLoan) {
    const limitEl = document.getElementById('stat-limit');
    const loanEl = document.getElementById('stat-loan');
    const paidEl = document.getElementById('stat-paid');
    const progressBar = document.getElementById('limit-progress');
    const limitInfo = document.getElementById('limit-info');
    const loanStatus = document.getElementById('loan-status');
    const paidInfo = document.getElementById('paid-info');
    
    if (hasActiveLoan) {
      const loan = this.state.user.loans[0];
      const totalLimit = loan.collateralValue * 0.7;
      const paidPercent = (loan.paidInstallments.length / loan.tenor) * 100;
      
      if (limitEl) limitEl.textContent = this.formatRupiah(totalLimit - loan.activeLoan);
      if (loanEl) loanEl.textContent = this.formatRupiah(loan.activeLoan);
      if (paidEl) paidEl.textContent = this.formatRupiah(loan.paidAmount || 0);
      if (progressBar) progressBar.style.width = `${paidPercent}%`;
      if (limitInfo) limitInfo.textContent = `${paidPercent.toFixed(0)}% sudah terbayar`;
      if (loanStatus) loanStatus.textContent = `${loan.paidInstallments.length}/${loan.tenor} angsuran lunas`;
      if (paidInfo) paidInfo.textContent = `Dari ${loan.tenor} angsuran`;
    } else {
      if (limitEl) limitEl.textContent = 'Rp 0';
      if (loanEl) loanEl.textContent = 'Rp 0';
      if (paidEl) paidEl.textContent = 'Rp 0';
      if (progressBar) progressBar.style.width = '0%';
      if (limitInfo) limitInfo.textContent = '0% dari total limit';
      if (loanStatus) loanStatus.textContent = 'Belum ada pinjaman aktif';
      if (paidInfo) paidInfo.textContent = 'Dari 0 angsuran';
    }
  },

  renderNoApplication() {
    const container = document.querySelector('#view-dashboard > .card-skeu:nth-of-type(2)');
    if (!container) return;
    
    container.innerHTML = `
      <div class="p-8 text-center">
        <div class="w-20 h-20 bg-finPeach/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-file-signature text-4xl text-finOrange"></i>
        </div>
        <h4 class="font-semibold text-finDeep text-lg mb-2">Belum Ada Pengajuan Pembiayaan</h4>
        <p class="text-sm text-gray-500 mb-6">Mulai ajukan pembiayaan untuk mengembangkan usaha Anda.</p>
        <button onclick="App.navigate('matching')" class="btn-primary px-6 py-2.5 rounded-lg font-medium shadow-md inline-flex items-center gap-2">
          <i class="fas fa-brain"></i>
          <span>Cek Kemampuan & Ajukan</span>
        </button>
      </div>
    `;
  },

  renderApplicationProgress(application) {
    const container = document.querySelector('#view-dashboard > .card-skeu:nth-of-type(2)');
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
          <i class="fas fa-file-signature text-finOrange"></i> Progres Pengajuan
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
          ${steps.map((step) => `
            <div class="flex flex-col items-center">
              <div class="w-8 h-8 rounded-full ${step.status === 'done' ? 'bg-finOrange text-white' : step.status === 'current' ? 'bg-finOrange text-white animate-pulse' : 'bg-gray-200 text-gray-400'} flex items-center justify-center text-xs">
                <i class="fas ${step.status === 'done' ? 'fa-check' : step.icon}"></i>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

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
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'col-span-12 text-center mt-3 text-xs text-gray-500';
    infoDiv.innerHTML = '<i class="fas fa-info-circle mr-1"></i>Klik nomor angsuran untuk detail.';
    grid.appendChild(infoDiv);
  },

  renderPaymentProgress(loan) {
    const grid = document.getElementById('payment-progress-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    grid.className = 'grid grid-cols-12 gap-2';
    
    const currentInstallment = loan.currentInstallment || 1;
    const paidInstallments = loan.paidInstallments || [];
    
    for (let i = 1; i <= loan.tenor; i++) {
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

  showInstallmentDetail(installmentNum, loan) {
    const isPaid = loan && loan.paidInstallments?.includes(installmentNum);
    const isCurrent = loan && installmentNum === loan.currentInstallment && !isPaid;
    const isUpcoming = !loan || installmentNum > loan.currentInstallment;
    
    const amount = loan ? this.formatRupiah(loan.monthlyPayment) : '-';
    const dueDate = loan ? this.formatDate(new Date(loan.startDate).setMonth(new Date(loan.startDate).getMonth() + installmentNum)) : '-';
    
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

  // ✅ BARU: Render info pembayaran angsuran berjalan
  renderPaymentInfo() {
    const loan = this.state.user.loans?.[0];
    const badge = document.getElementById('payment-status-badge');
    const installmentNum = document.getElementById('current-installment-num');
    const dueDate = document.getElementById('current-due-date');
    const billAmount = document.getElementById('current-bill-amount');
    const daysRemaining = document.getElementById('days-remaining');
    const paymentMethods = document.getElementById('payment-methods');
    const btnPay = document.getElementById('btn-pay-now');
    const paymentInfo = document.getElementById('payment-info');
    
    if (!loan || loan.paidInstallments.length >= loan.tenor) {
      if (badge) { badge.textContent = 'Lunas'; badge.className = 'text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full'; }
      if (installmentNum) installmentNum.textContent = '-';
      if (dueDate) dueDate.textContent = '-';
      if (billAmount) billAmount.textContent = '-';
      if (daysRemaining) daysRemaining.textContent = '-';
      if (paymentMethods) paymentMethods.classList.add('hidden');
      if (btnPay) btnPay.classList.add('hidden');
      if (paymentInfo) paymentInfo.innerHTML = '<p class="text-center text-green-600 font-semibold py-4">🎉 Semua angsuran lunas!</p>';
      return;
    }
    
    const current = loan.currentInstallment;
    const startDate = new Date(loan.startDate);
    const dueDateObj = new Date(startDate);
    dueDateObj.setMonth(dueDateObj.getMonth() + current);
    
    const today = new Date();
    const daysLeft = Math.ceil((dueDateObj - today) / (1000 * 60 * 60 * 24));
    
    if (badge) {
      if (daysLeft < 0) { badge.textContent = 'Terlambat'; badge.className = 'text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full'; }
      else if (daysLeft <= 3) { badge.textContent = 'Segera Bayar'; badge.className = 'text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full'; }
      else { badge.textContent = 'Aktif'; badge.className = 'text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full'; }
    }
    if (installmentNum) installmentNum.textContent = `${current} / ${loan.tenor}`;
    if (dueDate) dueDate.textContent = this.formatDate(dueDateObj);
    if (billAmount) billAmount.textContent = this.formatRupiah(loan.monthlyPayment);
    if (daysRemaining) {
      daysRemaining.textContent = daysLeft < 0 ? `${Math.abs(daysLeft)} hari` : `${daysLeft} hari`;
      if (daysLeft < 0) daysRemaining.className = 'text-xl font-bold text-red-500';
      else if (daysLeft <= 3) daysRemaining.className = 'text-xl font-bold text-orange-500';
      else daysRemaining.className = 'text-xl font-bold text-green-600';
    }
    
    if (paymentMethods) paymentMethods.classList.remove('hidden');
    if (btnPay) btnPay.classList.remove('hidden');
  },

  // ✅ BARU: Proses pembayaran
  processPayment() {
    const loan = this.state.user.loans?.[0];
    if (!loan) return this.toast('Tidak ada pinjaman aktif.', 'error');
    
    const method = document.querySelector('input[name="payment-method"]:checked')?.value;
    const methodNames = {
      astrapay: 'AstraPay Auto-Debit',
      transfer: 'Transfer Bank',
      va: 'Virtual Account',
      minimarket: 'Minimarket'
    };
    
    if (!confirm(`Konfirmasi pembayaran angsuran ke-${loan.currentInstallment} sebesar ${this.formatRupiah(loan.monthlyPayment)} via ${methodNames[method]}?`)) {
      return;
    }
    
    const btn = document.getElementById('btn-pay-now');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Memproses...`;
    
    setTimeout(() => {
      loan.paidInstallments.push(loan.currentInstallment);
      loan.paidAmount = (loan.paidAmount || 0) + loan.monthlyPayment;
      loan.activeLoan = loan.amount - loan.paidAmount;
      loan.currentInstallment = loan.currentInstallment + 1;
      
      const users = DB._getStore('users') || {};
      users[this.state.user.id] = this.state.user;
      DB._setStore('users', users);
      
      const txs = DB._getStore('transactions') || [];
      txs.unshift({
        id: 'KW-' + Date.now().toString().slice(-6),
        date: new Date().toISOString().split('T')[0],
        amount: loan.monthlyPayment,
        method: methodNames[method],
        status: 'Success'
      });
      DB._setStore('transactions', txs);
      
      const paymentHistory = this.state.user.paymentHistory || [];
      paymentHistory.push({
        installment: loan.currentInstallment - 1,
        date: new Date().toISOString(),
        amount: loan.monthlyPayment,
        method: methodNames[method],
        status: 'Success'
      });
      this.state.user.paymentHistory = paymentHistory;
      
      btn.disabled = false;
      btn.innerHTML = originalHTML;
      
      this.toast(`Pembayaran angsuran ke-${loan.currentInstallment - 1} berhasil!`);
      
      this.loadDashboard();
    }, 1500);
  },

  // ✅ BARU: Render riwayat pembayaran user
  renderMyPaymentHistory() {
    const container = document.getElementById('my-payment-history');
    if (!container) return;
    
    const history = this.state.user.paymentHistory || [];
    
    if (history.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Belum ada riwayat pembayaran</p>';
      return;
    }
    
    container.innerHTML = history.slice().reverse().map(p => `
      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border-l-4 border-green-500">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <i class="fas fa-check"></i>
          </div>
          <div>
            <p class="text-sm font-semibold text-finDeep">Angsuran ke-${p.installment}</p>
            <p class="text-[10px] text-gray-500">${this.formatDate(p.date)} • ${p.method}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-bold text-sm text-finDeep">${this.formatRupiah(p.amount)}</p>
          <p class="text-[10px] text-green-600">Lunas</p>
        </div>
      </div>
    `).join('');
  },

  formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  },

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
        <td class="px-4 py-3 font-medium text-finDeep">${this.formatRupiah(tx.amount)}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${tx.method}</td>
        <td class="px-4 py-3"><span class="status-badge status-${tx.status.toLowerCase()}">${tx.status}</span></td>
      `;
      tbody.appendChild(tr);
    });
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
      { label: 'H-14 Sebelum Jatuh Tempo', desc: 'Pengingat awal.', status: 'done', date: '11 Juni 2026' },
      { label: 'H-7 Sebelum Jatuh Tempo', desc: 'Pengingat mingguan.', status: 'done', date: '18 Juni 2026' },
      { label: 'H-3 Sebelum Jatuh Tempo', desc: 'Perhatian.', status: 'done', date: '22 Juni 2026' },
      { label: 'H-1 Sebelum Jatuh Tempo', desc: 'Besok jatuh tempo.', status: 'active', date: '24 Juni 2026' },
      { label: 'Hari H - Jatuh Tempo', desc: 'Hari ini jatuh tempo.', status: '', date: '25 Juni 2026' },
      { label: 'H+1 - Pengingat Denda', desc: 'Denda Rp 50.000.', status: '', date: '26 Juni 2026' },
      { label: 'H+3 - Peringatan Terakhir', desc: 'Denda Rp 150.000.', status: 'danger', date: '28 Juni 2026' }
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
      { icon: 'check-circle', color: 'green-500', msg: 'Pembayaran H-14 berhasil' },
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

  getAvatarUrl(user) {
    const name = user.name || user.phone || 'User';
    const initials = this._getInitials(name);
    
    const colors = [
      { bg: '#FF7B00', text: '#FFFFFF' },
      { bg: '#FF9644', text: '#FFFFFF' },
      { bg: '#800000', text: '#FFFFFF' },
      { bg: '#FFCE99', text: '#562F00' },
      { bg: '#E67E22', text: '#FFFFFF' },
      { bg: '#D35400', text: '#FFFFFF' }
    ];
    
    const hash = this._hashCode(name.toLowerCase());
    const color = colors[Math.abs(hash) % colors.length];
    const fontSize = initials.length === 1 ? '45' : '35';
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="100" height="100" fill="${color.bg}" rx="50"/>
      <text x="50" y="50" font-family="Arial, sans-serif" font-weight="bold" 
            font-size="${fontSize}" fill="${color.text}" 
            text-anchor="middle" dominant-baseline="central">
        ${initials}
      </text>
    </svg>`;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  },

  _getInitials(name) {
    if (!name) return 'U';
    const words = name.trim().split(/\s+/);
    let initials = '';
    if (words.length >= 2) {
      initials = words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase();
    } else if (words[0].length > 0) {
      initials = words[0].charAt(0).toUpperCase();
    } else {
      initials = 'U';
    }
    return initials;
  },

  _hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  },

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
  }
};

// ==========================================
// 3. AI MATCHING ENGINE (UPDATED)
// ==========================================
const AIEngine = {
  evaluate() {
    const revenue = parseFloat(document.getElementById('revenue').value) || 0;
    const capability = parseFloat(document.getElementById('capability').value) || 0;
    const collateralValue = parseFloat(document.getElementById('collateral-value').value) || 0;
    const location = document.getElementById('location').value;
    const collateral = document.getElementById('collateral').value;
    const assetYear = parseInt(document.getElementById('asset-year').value) || 2020;
    const businessType = document.getElementById('business-type').value;
    const resultsContainer = document.getElementById('ai-results');

    if (revenue === 0 || capability === 0 || collateralValue === 0) {
      return App.toast('Lengkapi semua field termasuk nilai agunan.', 'error');
    }

    // ✅ HITUNG LIMIT: 70% dari nilai agunan
    const baseLimit = collateralValue * 0.7;
    
    // ✅ FAKTOR BUNGA (9% - 16%)
    const locationFactor = {
      jakarta: 1.0, bandung: 1.02, surabaya: 1.02, semarang: 1.04,
      yogyakarta: 1.04, denpasar: 1.06, medan: 1.08, makassar: 1.10, lainnya: 1.15
    };
    
    const collateralFactor = {
      sertifikat: 1.0, bpb_mobil: 1.08, bpb_motor: 1.15
    };
    
    const businessFactor = {
      besar: 1.0, menengah: 1.05, umkm: 1.10, personal: 1.15
    };
    
    const dti = capability / revenue;
    let dtiFactor = 1.0;
    if (dti > 0.5) dtiFactor = 1.20;
    else if (dti > 0.3) dtiFactor = 1.10;
    else if (dti > 0.2) dtiFactor = 1.05;
    
    const ageFactor = Math.max(1.0, 1 + ((2026 - assetYear) * 0.02));
    
    const baseRate = 9;
    const maxRate = 16;
    
    let calculatedRate = baseRate * 
      locationFactor[location] * 
      collateralFactor[collateral] * 
      businessFactor[businessType] * 
      dtiFactor * 
      ageFactor;
    
    calculatedRate = Math.min(maxRate, Math.max(baseRate, calculatedRate));
    
    // ✅ TENOR KELIPATAN 12: 12, 24, 36, 48, 60
    const tenors = [
      { label: '12 Bulan', value: 12 },
      { label: '24 Bulan', value: 24 },
      { label: '36 Bulan', value: 36 },
      { label: '48 Bulan', value: 48 },
      { label: '60 Bulan', value: 60 }
    ];

    const tenorResults = tenors.map(t => {
      const tenorRateAdjustment = ((t.value - 12) / 12) * 0.5;
      const finalRate = Math.min(maxRate, calculatedRate + tenorRateAdjustment);
      
      const totalInterest = baseLimit * (finalRate / 100) * (t.value / 12);
      const totalPayment = baseLimit + totalInterest;
      const monthlyPayment = totalPayment / t.value;
      
      const feasible = monthlyPayment <= capability;
      const dtiAfterLoan = (monthlyPayment / revenue) * 100;
      
      return {
        ...t,
        rate: finalRate,
        monthlyPayment,
        totalInterest,
        totalPayment,
        feasible,
        dtiAfterLoan
      };
    });

    // Simpan ke state user
    App.state.user.loans = App.state.user.loans || [];
    App.state.user.loans[0] = {
      id: 'LOAN-' + Date.now(),
      amount: baseLimit,
      collateralValue,
      collateralType: collateral,
      interestRate: tenorResults[0].rate,
      tenor: 12,
      monthlyPayment: tenorResults[0].monthlyPayment,
      startDate: new Date().toISOString(),
      currentInstallment: 1,
      paidInstallments: [],
      remainingLimit: 0,
      activeLoan: baseLimit,
      paidAmount: 0
    };
    
    const users = DB._getStore('users') || {};
    users[App.state.user.id] = App.state.user;
    DB._setStore('users', users);

    const fmt = (n) => App.formatRupiah(n);

    resultsContainer.innerHTML = `
      <div class="card-skeu p-5 rounded-2xl reveal active">
        <h4 class="font-semibold text-finDeep mb-3">💰 Ringkasan Analisis</h4>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="p-2 bg-finPeach/20 rounded-lg">
            <p class="text-gray-500">Nilai Agunan</p>
            <p class="font-bold text-finDeep">${fmt(collateralValue)}</p>
          </div>
          <div class="p-2 bg-finPeach/20 rounded-lg">
            <p class="text-gray-500">Limit (70%)</p>
            <p class="font-bold text-finOrange">${fmt(baseLimit)}</p>
          </div>
          <div class="p-2 bg-finPeach/20 rounded-lg">
            <p class="text-gray-500">DTI Ratio</p>
            <p class="font-bold text-finDeep">${(dti * 100).toFixed(1)}%</p>
          </div>
          <div class="p-2 bg-finPeach/20 rounded-lg">
            <p class="text-gray-500">Bunga Dasar</p>
            <p class="font-bold text-finDeep">${calculatedRate.toFixed(2)}%</p>
          </div>
        </div>
        <div class="mt-4 p-3 bg-gradient-to-r from-finOrange/10 to-finPeach/20 rounded-lg">
          <p class="text-xs text-gray-600">Jumlah Pinjaman Ideal</p>
          <p class="text-2xl font-bold text-finOrange">${fmt(baseLimit)}</p>
          <p class="text-[10px] text-gray-500 mt-1">70% dari nilai agunan ${fmt(collateralValue)}</p>
        </div>
      </div>

      <div class="card-skeu p-5 rounded-2xl reveal active">
        <h4 class="font-semibold text-finDeep mb-3">📅 Rekomendasi Tenor & Bunga</h4>
        <div class="space-y-2">
          ${tenorResults.map(t => `
            <div class="p-3 rounded-lg border-2 ${t.feasible ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50 opacity-70'}">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <p class="font-semibold text-sm">${t.label}</p>
                  <p class="text-[10px] text-gray-500">Bunga ${t.rate.toFixed(2)}%/tahun</p>
                </div>
                <div class="text-right">
                  <p class="font-bold text-sm ${t.feasible ? 'text-green-700' : 'text-red-600'}">${fmt(t.monthlyPayment)}/bln</p>
                  <p class="text-[10px] ${t.feasible ? 'text-green-600' : 'text-red-500'}">
                    ${t.feasible ? '✓ Layak' : '✗ Melebihi kemampuan'}
                  </p>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2 text-[10px] text-gray-600 pt-2 border-t border-gray-200">
                <div>
                  <p class="text-gray-400">Total Bunga</p>
                  <p class="font-semibold">${fmt(t.totalInterest)}</p>
                </div>
                <div>
                  <p class="text-gray-400">Total Bayar</p>
                  <p class="font-semibold">${fmt(t.totalPayment)}</p>
                </div>
                <div>
                  <p class="text-gray-400">DTI Setelah</p>
                  <p class="font-semibold ${t.dtiAfterLoan > 50 ? 'text-red-500' : 'text-green-600'}">${t.dtiAfterLoan.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card-skeu p-5 rounded-2xl reveal active">
        <h4 class="font-semibold text-finDeep mb-3">️ Kategori Risiko</h4>
        ${this.renderRiskCards(dti, baseLimit)}
      </div>

      <button onclick="App.navigate('dashboard')" class="btn-primary w-full py-3 rounded-lg font-semibold shadow-md">
        <i class="fas fa-check-circle mr-2"></i>Gunakan Rekomendasi Ini
      </button>
    `;

    App.toast('Analisis AI selesai. Limit & bunga sudah dihitung.');
  },

  renderRiskCards(dti, limit) {
    const cards = [
      { label: 'Sangat Aman', desc: 'DTI < 20%. Bunga preferensial 9-10%.', color: 'green', active: dti < 0.2 },
      { label: 'Aman', desc: 'DTI 20-40%. Bunga normal 10-13%.', color: 'yellow', active: dti >= 0.2 && dti < 0.4 },
      { label: 'Moderat', desc: 'DTI 40-50%. Bunga 13-15%.', color: 'orange', active: dti >= 0.4 && dti < 0.5 },
      { label: 'Berisiko', desc: 'DTI > 50%. Bunga 15-16% atau ditolak.', color: 'red', active: dti >= 0.5 }
    ];
    return cards.map(c => `
      <div class="p-3 rounded-lg border-2 ${c.active ? (
        c.color === 'red' ? 'border-red-300 bg-red-50' : 
        c.color === 'orange' ? 'border-orange-300 bg-orange-50' :
        c.color === 'yellow' ? 'border-yellow-300 bg-yellow-50' : 
        'border-green-300 bg-green-50 ring-2 ring-offset-2 ring-finOrange'
      ) : 'border-gray-200 opacity-50'} mb-2">
        <div class="flex justify-between items-center">
          <span class="font-bold text-sm ${
            c.color === 'red' ? 'text-red-600' : 
            c.color === 'orange' ? 'text-orange-600' :
            c.color === 'yellow' ? 'text-yellow-600' : 
            'text-green-600'
          }">${c.label}</span>
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
    'bayar': 'Anda dapat membayar melalui Dashboard atau aktifkan AstraPay Auto-Debit.',
    'bunga': 'Suku bunga FINATRA 9-16% per tahun, tergantung lokasi, agunan, dan profil risiko.',
    'telat': 'Denda H+1: Rp 50.000, H+3: Rp 150.000.',
    'limit': 'Limit = 70% dari nilai agunan Anda.',
    'kontak': 'Hubungi CS 24/7: 0800-123-4567',
    'ocr': 'OCR memverifikasi KTP/KK/BPKB otomatis.',
    'astrapay': 'AstraPay Auto-Debit memotong cicilan otomatis.',
    'ews': 'AI Warning System mengirim pengingat 7-tahap.',
    'matching': 'AI Matching menganalisis profil risiko Anda.',
    'testimoni': 'Lihat testimoni di menu Testimoni.',
    'default': 'Maaf, saya belum memahami. Coba tanya: bayar, bunga, telat, limit, ocr, astrapay, ews, matching.'
  },

  sendMessage(text) {
    const container = document.getElementById('chat-history');
    this.appendBubble(text, 'user');
    const typingEl = this.appendBubble('<i class="fas fa-circle-notch fa-spin"></i> Menganalisis...', 'ai');
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
// 5. OCR SERVICE
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
        resultText.textContent = `Dokumen "${file.name}" berhasil diverifikasi.`;
      }
      
      App.toast('OCR berhasil.');
    }, 1500);
  }
};

// ==========================================
// 6. TESTIMONIAL MANAGER
// ==========================================
const TestimonialManager = {
  data: [
    { name: 'Budi Santoso', role: 'Pemilik Warung', location: 'Jakarta', rating: 5, text: 'FINATRA membantu mengembangkan usaha. Proses cepat!', avatar: 'budi' },
    { name: 'Siti Rahayu', role: 'Pengusaha Konveksi', location: 'Bandung', rating: 5, text: 'AstraPay Auto-Debit sangat memudahkan.', avatar: 'siti' },
    { name: 'Ahmad Wijaya', role: 'Pemilik Bengkel', location: 'Surabaya', rating: 4, text: 'EWS 7-tahap sangat membantu.', avatar: 'ahmad' },
    { name: 'Dewi Lestari', role: 'Pemilik Toko', location: 'Yogyakarta', rating: 5, text: 'AI Chatbot responsif 24/7.', avatar: 'dewi' },
    { name: 'Hendra Kusuma', role: 'Distributor', location: 'Medan', rating: 5, text: 'Limit yang direkomendasikan AI sangat pas.', avatar: 'hendra' },
    { name: 'Rina Marlina', role: 'Pemilik Catering', location: 'Semarang', rating: 5, text: 'Dashboard tracker sangat informatif.', avatar: 'rina' }
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