/**
 * TaskLab - Student Task & Lab Manager
 * Main Interactive Application Script
 * Integrated with Backend Drizzle ORM & SQLite Database (with fallback)
 */

// Initial Seed Tasks Fallback
const defaultTasks = [
  {
    id: 1,
    title: 'Laporan Akhir Jaringan Komputer: Routing OSPF & BGP',
    course: 'Jaringan Komputer II',
    deadlineDate: getRelativeDateIso(1, 23, 59),
    deadlineText: 'Besok, 23:59 WIB',
    urgency: 'critical',
    urgencyLabel: '🔴 H-1 Mendesak',
    badgeClass: 'badge-urgent',
    links: [
      { name: 'Modul-07.pdf', url: '#' },
      { name: 'Cisco Packet Tracer', url: '#' }
    ],
    completed: false
  },
  {
    id: 2,
    title: 'Tugas Analisis Kompleksitas Algoritma Dijkstra',
    course: 'Strategi Algoritma',
    deadlineDate: getRelativeDateIso(3, 17, 0),
    deadlineText: '3 Hari Lagi (Kamis, 17:00 WIB)',
    urgency: 'warning',
    urgencyLabel: '🟡 H-3 Waspada',
    badgeClass: 'badge-warning',
    links: [
      { name: 'Slide Dosen Pertemuan 8', url: '#' }
    ],
    completed: false
  },
  {
    id: 3,
    title: 'Review Jurnal Basis Data NoSQL vs RDBMS',
    course: 'Sistem Basis Data Lanjut',
    deadlineDate: getRelativeDateIso(7, 23, 59),
    deadlineText: '7 Hari Lagi (Minggu Depan)',
    urgency: 'safe',
    urgencyLabel: '🟢 H-7 Aman',
    badgeClass: 'badge-safe',
    links: [
      { name: 'IEEE Paper.pdf', url: '#' }
    ],
    completed: true
  }
];

// Initial Seed Lab Schedules Fallback
const defaultLabs = [
  {
    id: 101,
    title: 'Praktikum Pemrograman Web: REST API & Flask MVC',
    course: 'Praktikum Pemrograman Web',
    time: 'Hari Ini, 13:00 - 15:30 WIB',
    room: 'Lab Komputasi Gedung B - R.302',
    assistant: 'Kak Arya & Kak Cindy',
    link: 'Modul Flask Jinja2.pdf',
    attended: false
  },
  {
    id: 102,
    title: 'Praktikum Jaringan Komputer: Simulasi Subnetting & VLAN',
    course: 'Praktikum Jaringan Komputer',
    time: 'Jumat, 08:00 - 10:30 WIB',
    room: 'Lab Jaringan Komputer - R.204',
    assistant: 'Kak Budi Santoso',
    link: 'Panduan VLAN Lab.pdf',
    attended: false
  }
];

// Backend API Base Configuration
const API_BASE = (window.location.protocol.startsWith('http')) ? '' : 'http://localhost:3000';

// Application State
let appState = {
  isLoggedIn: false,
  isBackendConnected: false,
  user: {
    id: 1,
    name: 'user123',
    major: 'Teknik Informatika',
    semester: 'Semester 4',
    email: 'user123@kampus.ac.id'
  },
  tasks: [],
  labs: [],
  currentAppTab: 'overview',
  overviewFilter: 'all',
  landingFilter: 'all'
};

function getRelativeDateIso(daysFromNow, hours = 23, minutes = 59) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/* -------------------------------------------------------------------------- */
/* DOM Ready Lifecycle                                                        */
/* -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  loadLocalState();
  initLandingInteractions();
  initAuthSystem();
  initUrgencyAutoCalculator();
  initTaskAndLabModals();
  initAppNavigation();

  // Try synchronizing with Drizzle ORM backend
  await syncWithBackend();

  if (appState.isLoggedIn) {
    showAppView();
  } else {
    showLandingView();
  }
});

/* -------------------------------------------------------------------------- */
/* Backend API Synchronization (Drizzle ORM)                                  */
/* -------------------------------------------------------------------------- */
async function syncWithBackend() {
  try {
    const [tasksRes, labsRes] = await Promise.all([
      fetch(`${API_BASE}/api/tasks`, { headers: { 'Accept': 'application/json' } }),
      fetch(`${API_BASE}/api/labs`, { headers: { 'Accept': 'application/json' } })
    ]);

    if (tasksRes.ok && labsRes.ok) {
      const tasksData = await tasksRes.json();
      const labsData = await labsRes.json();

      appState.tasks = tasksData.data || [];
      appState.labs = labsData.data || [];
      appState.isBackendConnected = true;
      persistLocalState();

      renderAppOverview();
      renderAppTasks();
      renderAppLabs();
      renderLandingSimulator();
      console.log('✅ Connected to Drizzle ORM SQLite Backend (tasklab.db)!');
    }
  } catch (err) {
    console.log('ℹ️ Running with offline/local state fallback.');
  }
}

function loadLocalState() {
  const savedUser = localStorage.getItem('tasklab_user');
  const savedTasks = localStorage.getItem('tasklab_tasks');
  const savedLabs = localStorage.getItem('tasklab_labs');

  if (savedUser) {
    try {
      appState.user = JSON.parse(savedUser);
      appState.isLoggedIn = true;
    } catch (e) {}
  }

  if (savedTasks) {
    try {
      appState.tasks = JSON.parse(savedTasks);
    } catch (e) {
      appState.tasks = [...defaultTasks];
    }
  } else {
    appState.tasks = [...defaultTasks];
  }

  if (savedLabs) {
    try {
      appState.labs = JSON.parse(savedLabs);
    } catch (e) {
      appState.labs = [...defaultLabs];
    }
  } else {
    appState.labs = [...defaultLabs];
  }

  // Recalculate local urgencies dynamically
  appState.tasks.forEach(task => {
    if (task.deadlineDate) {
      const evalResult = evaluateDeadlineUrgency(task.deadlineDate);
      task.urgency = evalResult.urgency;
      task.urgencyLabel = evalResult.label;
      task.badgeClass = evalResult.badgeClass;
    }
  });
}

function persistLocalState() {
  localStorage.setItem('tasklab_tasks', JSON.stringify(appState.tasks));
  localStorage.setItem('tasklab_labs', JSON.stringify(appState.labs));
}

/* -------------------------------------------------------------------------- */
/* AUTOMATIC SYSTEM URGENCY CALCULATION                                       */
/* -------------------------------------------------------------------------- */
function evaluateDeadlineUrgency(deadlineString) {
  if (!deadlineString) {
    return {
      urgency: 'warning',
      label: '🟡 H-3 Waspada',
      badgeClass: 'badge-warning',
      boxClass: 'calc-warning',
      icon: '⚙️',
      title: 'Pilih Deadline untuk Evaluasi Sistem',
      desc: 'Sistem akan mengevaluasi selisih jam dan menentukan warna urgensi.'
    };
  }

  const deadline = new Date(deadlineString);
  const now = new Date();
  const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0) {
    return {
      urgency: 'overdue',
      label: '⚠️ Lewat Deadline',
      badgeClass: 'badge-urgent',
      boxClass: 'calc-overdue',
      icon: '⏰',
      title: 'Tenggat Waktu Telah Berlalu',
      desc: 'Waktu yang Anda pilih sudah terlewati. Tugas ini berstatus keterlambatan.'
    };
  }

  if (diffHours <= 24) {
    const hoursLeft = Math.max(1, Math.round(diffHours));
    return {
      urgency: 'critical',
      label: '🔴 H-1 Mendesak',
      badgeClass: 'badge-urgent',
      boxClass: 'calc-critical',
      icon: '🚨',
      title: '🔴 H-1 Kritis (Kurang dari 24 Jam)',
      desc: `Sistem mendeteksi sisa waktu ${hoursLeft} jam. Highlight merah akan ditempatkan di prioritas teratas!`
    };
  }

  if (diffHours <= 72) {
    const daysLeft = Math.round(diffHours / 24);
    return {
      urgency: 'warning',
      label: '🟡 H-3 Waspada',
      badgeClass: 'badge-warning',
      boxClass: 'calc-warning',
      icon: '⏳',
      title: '🟡 H-3 Waspada (Waktu Emas Mencicil)',
      desc: `Sistem mendeteksi waktu tersisa ${daysLeft} hari (${Math.round(diffHours)} jam). Mulai cicil sekarang.`
    };
  }

  const daysLeft = Math.round(diffHours / 24);
  return {
    urgency: 'safe',
    label: '🟢 H-7 Aman',
    badgeClass: 'badge-safe',
    boxClass: 'calc-safe',
    icon: '✅',
    title: '🟢 H-7 Aman & Terencana',
    desc: `Sisa waktu ${daysLeft} hari. Tugas masuk ke jadwal terencana tanpa risiko prokrastinasi.`
  };
}

function initUrgencyAutoCalculator() {
  const deadlineInput = document.getElementById('modalTaskDeadline');
  const box = document.getElementById('systemUrgencyBox');
  const icon = document.getElementById('systemUrgencyIcon');
  const title = document.getElementById('systemUrgencyTitle');
  const desc = document.getElementById('systemUrgencyDesc');

  if (!deadlineInput || !box) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 0, 0);
  
  const localIso = new Date(tomorrow.getTime() - (tomorrow.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  deadlineInput.value = localIso;

  function updatePreview() {
    const val = deadlineInput.value;
    const result = evaluateDeadlineUrgency(val);

    box.className = `urgency-calc-box p-3.5 rounded-xl border flex items-start gap-3 transition-all duration-200 ${result.boxClass}`;
    icon.textContent = result.icon;
    title.textContent = result.title;
    desc.textContent = result.desc;
  }

  deadlineInput.addEventListener('input', updatePreview);
  deadlineInput.addEventListener('change', updatePreview);
  updatePreview();
}

/* -------------------------------------------------------------------------- */
/* AUTHENTICATION SYSTEM                                                      */
/* -------------------------------------------------------------------------- */
function initAuthSystem() {
  const authModal = document.getElementById('authModal');
  const closeBtn = document.getElementById('closeAuthModal');
  const openLoginBtns = document.querySelectorAll('.btn-open-login');
  const openCobaBtns = document.querySelectorAll('.btn-coba-sekarang');
  const tabBtnLogin = document.getElementById('tabBtnLogin');
  const tabBtnSignup = document.getElementById('tabBtnSignup');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const instantDemoBtn = document.getElementById('btnInstantDemoLogin');
  const logoutBtn = document.getElementById('logoutBtn');
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

  function openModal(defaultTab = 'login') {
    if (!authModal) return;
    authModal.classList.remove('hidden');
    authModal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    if (defaultTab === 'signup') {
      tabBtnSignup.click();
    } else {
      tabBtnLogin.click();
    }
  }

  function closeModal() {
    if (!authModal) return;
    authModal.classList.add('hidden');
    authModal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  openLoginBtns.forEach(btn => btn.addEventListener('click', () => openModal('login')));
  openCobaBtns.forEach(btn => btn.addEventListener('click', () => openModal('login')));

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeModal();
    });
  }

  if (tabBtnLogin && tabBtnSignup) {
    tabBtnLogin.addEventListener('click', () => {
      tabBtnLogin.className = 'flex-1 py-3 text-xs font-bold text-indigo-600 border-b-2 border-indigo-600 transition';
      tabBtnSignup.className = 'flex-1 py-3 text-xs font-semibold text-slate-500 hover:text-slate-700 transition';
      loginForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
    });

    tabBtnSignup.addEventListener('click', () => {
      tabBtnSignup.className = 'flex-1 py-3 text-xs font-bold text-indigo-600 border-b-2 border-indigo-600 transition';
      tabBtnLogin.className = 'flex-1 py-3 text-xs font-semibold text-slate-500 hover:text-slate-700 transition';
      signupForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    });
  }

  // 1-Click Instant Demo Login
  if (instantDemoBtn) {
    instantDemoBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/demo`, { method: 'POST' });
        if (res.ok) {
          const body = await res.json();
          appState.user = body.user;
        }
      } catch (e) {}

      appState.isLoggedIn = true;
      localStorage.setItem('tasklab_user', JSON.stringify(appState.user));
      closeModal();
      showAppView();
      syncWithBackend();
      showToast(`🎉 Selamat datang, ${appState.user.name}! Berhasil masuk ke dashboard mahasiswa.`);
    });
  }

  // Handle Login Form
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (res.ok) {
          const body = await res.json();
          appState.user = body.user;
        } else {
          const name = email.split('@')[0].replace('.', ' ') || 'Mahasiswa Aktif';
          appState.user = {
            id: Date.now(),
            name: capitalizeWords(name),
            major: 'Teknik Informatika',
            semester: 'Semester 4',
            email: email
          };
        }
      } catch (err) {
        const name = email.split('@')[0].replace('.', ' ') || 'Mahasiswa Aktif';
        appState.user = {
          id: Date.now(),
          name: capitalizeWords(name),
          major: 'Teknik Informatika',
          semester: 'Semester 4',
          email: email
        };
      }

      appState.isLoggedIn = true;
      localStorage.setItem('tasklab_user', JSON.stringify(appState.user));
      closeModal();
      showAppView();
      syncWithBackend();
      showToast(`👋 Berhasil masuk! Selamat datang di TaskLab, ${appState.user.name}.`);
    });
  }

  // Handle Sign-Up Form
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signupName').value.trim();
      const major = document.getElementById('signupMajor').value.trim() || 'Teknik Informatika';
      const semester = document.getElementById('signupSemester').value;
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;

      try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, major, semester })
        });
        if (res.ok) {
          const body = await res.json();
          appState.user = body.user;
        } else {
          appState.user = { id: Date.now(), name, major, semester, email };
        }
      } catch (err) {
        appState.user = { id: Date.now(), name, major, semester, email };
      }

      appState.isLoggedIn = true;
      localStorage.setItem('tasklab_user', JSON.stringify(appState.user));
      closeModal();
      showAppView();
      syncWithBackend();
      showToast(`✨ Akun berhasil dibuat! Selamat datang di TaskLab, ${name}.`);
    });
  }

  function handleLogout() {
    appState.isLoggedIn = false;
    localStorage.removeItem('tasklab_user');
    showLandingView();
    showToast('👋 Anda telah berhasil keluar (logout). Sampai jumpa kembali!');
  }

  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);
}

function showLandingView() {
  const landing = document.getElementById('landingView');
  const app = document.getElementById('appView');
  if (landing) landing.classList.remove('hidden');
  if (app) app.classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAppView() {
  const landing = document.getElementById('landingView');
  const app = document.getElementById('appView');
  if (landing) landing.classList.add('hidden');
  if (app) app.classList.remove('hidden');

  const avatar = document.getElementById('userAvatarInitials');
  const profileName = document.getElementById('userProfileName');
  const profileMajor = document.getElementById('userProfileMajor');
  const greetingName = document.getElementById('appGreetingName');

  if (avatar && appState.user.name) {
    const parts = appState.user.name.split(' ');
    const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
    avatar.textContent = initials;
  }
  if (profileName) profileName.textContent = appState.user.name;
  if (profileMajor) profileMajor.textContent = `${appState.user.major} • ${appState.user.semester}`;
  if (greetingName) greetingName.textContent = appState.user.name.split(' ')[0];

  renderAppOverview();
  renderAppTasks();
  renderAppLabs();
  updateAppMetrics();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* -------------------------------------------------------------------------- */
/* APP DASHBOARD NAVIGATION                                                   */
/* -------------------------------------------------------------------------- */
function initAppNavigation() {
  const tabs = document.querySelectorAll('.app-nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.appTab;
      switchAppTab(tabName);
    });
  });

  const filterPills = document.querySelectorAll('.app-filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => {
        p.classList.remove('bg-indigo-600', 'text-white');
        p.classList.add('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');
      });
      pill.classList.add('bg-indigo-600', 'text-white');
      pill.classList.remove('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');

      appState.overviewFilter = pill.dataset.appFilter;
      renderAppOverview();
    });
  });

  const searchInput = document.getElementById('searchTaskInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderAppTasks();
    });
  }

  const courseSelect = document.getElementById('filterCourseSelect');
  if (courseSelect) {
    courseSelect.addEventListener('change', () => {
      renderAppTasks();
    });
  }
}

window.switchAppTab = function(tabName, optionalFilter = null) {
  appState.currentAppTab = tabName;

  const tabs = document.querySelectorAll('.app-nav-tab');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.appTab === tabName);
  });

  const paneOverview = document.getElementById('paneOverview');
  const paneTasks = document.getElementById('paneTasks');
  const paneLabs = document.getElementById('paneLabs');

  if (paneOverview) paneOverview.classList.toggle('hidden', tabName !== 'overview');
  if (paneTasks) paneTasks.classList.toggle('hidden', tabName !== 'tasks');
  if (paneLabs) paneLabs.classList.toggle('hidden', tabName !== 'labs');

  if (tabName === 'tasks') {
    renderAppTasks();
  } else if (tabName === 'labs') {
    renderAppLabs();
  } else {
    if (optionalFilter) {
      appState.overviewFilter = optionalFilter;
    }
    renderAppOverview();
  }
};

/* -------------------------------------------------------------------------- */
/* RENDER FUNCTIONS (APP & DASHBOARD)                                         */
/* -------------------------------------------------------------------------- */
function updateAppMetrics() {
  const statActive = document.getElementById('statActiveTasks');
  const statCritical = document.getElementById('statCriticalTasks');
  const statLabs = document.getElementById('statLabSessions');
  const urgentBanner = document.getElementById('appUrgentBanner');
  const urgentBannerText = document.getElementById('appUrgentBannerText');

  const activeTasks = appState.tasks.filter(t => !t.completed);
  const criticalTasks = activeTasks.filter(t => t.urgency === 'critical');

  if (statActive) statActive.textContent = activeTasks.length;
  if (statCritical) statCritical.textContent = criticalTasks.length;
  if (statLabs) statLabs.textContent = appState.labs.length;

  if (urgentBanner) {
    if (criticalTasks.length > 0) {
      urgentBanner.classList.remove('hidden');
      if (urgentBannerText) {
        urgentBannerText.textContent = `Ada ${criticalTasks.length} tugas kritis dengan deadline H-1! Segera selesaikan sebelum tenggat waktu.`;
      }
    } else {
      urgentBanner.classList.add('hidden');
    }
  }
}

function renderAppOverview() {
  const container = document.getElementById('appOverviewList');
  const labsContainer = document.getElementById('appOverviewLabsList');
  if (!container) return;

  const sortedTasks = [...appState.tasks].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    const rank = { critical: 1, warning: 2, safe: 3, overdue: 0 };
    return (rank[a.urgency] || 4) - (rank[b.urgency] || 4);
  });

  const filtered = sortedTasks.filter(item => {
    if (appState.overviewFilter === 'critical') return item.urgency === 'critical';
    if (appState.overviewFilter === 'lab') return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        <span class="text-3xl">🎉</span>
        <p class="text-sm font-semibold text-slate-600 mt-2">Tidak ada tugas dalam kategori ini</p>
        <p class="text-xs text-slate-400">Semua beban akademik terkelola dengan baik!</p>
      </div>
    `;
  } else {
    container.innerHTML = filtered.map(task => `
      <div class="py-3.5 flex items-start gap-3 sm:gap-4 transition hover:bg-slate-50/80 px-2 rounded-xl">
        <input 
          type="checkbox" 
          aria-label="Tandai selesai" 
          class="task-checkbox mt-1" 
          ${task.completed ? 'checked' : ''} 
          onchange="appToggleTaskStatus(${task.id})"
        />
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${task.badgeClass}">
              ${task.urgencyLabel}
            </span>
            <span class="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              ${task.course}
            </span>
          </div>

          <h4 class="text-sm sm:text-base font-bold ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'} leading-snug">
            ${task.title}
          </h4>

          <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span class="flex items-center gap-1 ${task.urgency === 'critical' && !task.completed ? 'text-red-600 font-bold' : ''}">
              🕒 ${task.deadlineText}
            </span>
            ${task.links && task.links.length > 0 ? `
              <span class="text-indigo-600 flex items-center gap-1 font-medium">
                📎 ${task.links.map(l => l.name).join(', ')}
              </span>
            ` : ''}
          </div>
        </div>

        <button 
          type="button" 
          onclick="appDeleteTask(${task.id})" 
          title="Hapus tugas" 
          class="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    `).join('');
  }

  if (labsContainer) {
    if (appState.labs.length === 0) {
      labsContainer.innerHTML = `
        <div class="text-center py-6 text-xs text-slate-400">
          Belum ada jadwal praktikum minggu ini.
        </div>
      `;
    } else {
      labsContainer.innerHTML = appState.labs.map(lab => `
        <div class="p-3 rounded-xl border border-purple-100 bg-purple-50/40 hover:bg-purple-50 transition">
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
              ${lab.course}
            </span>
            <span class="text-[10px] text-slate-400">Rutin</span>
          </div>
          <h5 class="text-xs font-bold text-slate-900">${lab.title}</h5>
          <div class="mt-2 text-[11px] text-purple-800 space-y-0.5">
            <div>🕒 ${lab.time}</div>
            <div>📍 ${lab.room}</div>
            ${lab.link ? `<div class="text-indigo-600 font-medium">📄 ${lab.link}</div>` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  updateAppMetrics();
}

function renderAppTasks() {
  const container = document.getElementById('appFullTasksList');
  const courseSelect = document.getElementById('filterCourseSelect');
  const searchInput = document.getElementById('searchTaskInput');
  if (!container) return;

  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selectedCourse = courseSelect ? courseSelect.value : 'all';

  if (courseSelect) {
    const courses = Array.from(new Set(appState.tasks.map(t => t.course))).filter(Boolean);
    const currentVal = courseSelect.value;
    courseSelect.innerHTML = '<option value="all">Semua Mata Kuliah</option>' +
      courses.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join('');
  }

  const filtered = appState.tasks.filter(t => {
    const matchesSearch = !searchQuery || 
      t.title.toLowerCase().includes(searchQuery) || 
      t.course.toLowerCase().includes(searchQuery);
    const matchesCourse = selectedCourse === 'all' || t.course === selectedCourse;
    return matchesSearch && matchesCourse;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
        <p class="text-sm font-semibold text-slate-600">Tidak ada tugas ditemukan</p>
        <p class="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau buat tugas baru.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(task => `
    <div class="p-4 rounded-xl border ${task.completed ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200 bg-white hover:border-indigo-200 shadow-xs'} transition flex items-start gap-4">
      <input 
        type="checkbox" 
        aria-label="Tandai selesai" 
        class="task-checkbox mt-1" 
        ${task.completed ? 'checked' : ''} 
        onchange="appToggleTaskStatus(${task.id})"
      />
      
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2 mb-1">
          <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${task.badgeClass}">
            ${task.urgencyLabel}
          </span>
          <span class="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
            ${task.course}
          </span>
          <span class="text-[11px] ${task.completed ? 'text-emerald-600 font-bold' : 'text-slate-400'}">
            ${task.completed ? '✓ Selesai' : '⏳ Sedang Dikerjakan'}
          </span>
        </div>

        <h3 class="text-base font-bold ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}">
          ${task.title}
        </h3>

        <div class="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
          <span class="flex items-center gap-1 ${task.urgency === 'critical' && !task.completed ? 'text-red-600 font-bold' : ''}">
            🕒 Deadline: ${task.deadlineText}
          </span>
          ${task.links && task.links.length > 0 ? `
            <div class="flex items-center gap-1.5">
              <span class="text-slate-400">Modul:</span>
              ${task.links.map(l => `
                <a href="${l.url}" onclick="event.preventDefault(); showToast('Membuka file: ${l.name}');" class="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded text-[11px] font-medium">
                  <span>${l.name}</span>
                </a>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <button 
        type="button" 
        onclick="appDeleteTask(${task.id})" 
        class="p-2 text-slate-300 hover:text-red-600 rounded-lg hover:bg-red-50 transition" 
        title="Hapus Tugas"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    </div>
  `).join('');
}

function renderAppLabs() {
  const container = document.getElementById('appFullLabsGrid');
  if (!container) return;

  if (appState.labs.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
        <span class="text-3xl">🧪</span>
        <h4 class="text-sm font-bold text-slate-700 mt-2">Belum ada Jadwal Praktikum</h4>
        <p class="text-xs text-slate-400 mt-1">Tambahkan sesi praktikum lab rutin Anda agar tidak terlewat.</p>
        <button type="button" class="open-add-lab-modal mt-4 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition">
          + Tambah Praktikum Baru
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = appState.labs.map(lab => `
    <div class="p-5 rounded-2xl border border-purple-200 bg-white hover:border-purple-300 shadow-xs transition flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
            ${lab.course}
          </span>
          <button 
            type="button" 
            onclick="appDeleteLab(${lab.id})" 
            class="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition" 
            title="Hapus Praktikum"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <h3 class="text-base font-bold text-slate-900 leading-snug">
          ${lab.title}
        </h3>

        <div class="mt-4 space-y-2 text-xs text-slate-600">
          <div class="flex items-center gap-2">
            <span class="w-5 text-purple-600">🕒</span>
            <span class="font-semibold text-slate-800">${lab.time}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-5 text-purple-600">📍</span>
            <span>${lab.room}</span>
          </div>
          ${lab.assistant ? `
            <div class="flex items-center gap-2">
              <span class="w-5 text-purple-600">👨‍🏫</span>
              <span>Asisten: ${lab.assistant}</span>
            </div>
          ` : ''}
          ${lab.link ? `
            <div class="flex items-center gap-2 pt-2 border-t border-slate-100">
              <span class="w-5 text-purple-600">📄</span>
              <a href="#" onclick="event.preventDefault(); showToast('Membuka modul: ${lab.link}');" class="text-indigo-600 hover:underline font-medium">
                ${lab.link}
              </a>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
        <label class="flex items-center gap-2 text-xs font-semibold cursor-pointer ${lab.attended ? 'text-emerald-700' : 'text-slate-600'}">
          <input 
            type="checkbox" 
            class="task-checkbox" 
            ${lab.attended ? 'checked' : ''} 
            onchange="appToggleLabAttendance(${lab.id})"
          />
          <span>${lab.attended ? 'Hadir di Lab ✓' : 'Tandai Kehadiran'}</span>
        </label>
        <span class="text-[11px] text-slate-400">P1 Wajib</span>
      </div>
    </div>
  `).join('');
}

// Global actions with Drizzle Backend integration
window.appToggleTaskStatus = async function(taskId) {
  const task = appState.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  persistLocalState();
  renderAppOverview();
  renderAppTasks();
  renderLandingSimulator();

  try {
    await fetch(`${API_BASE}/api/tasks/${taskId}/toggle`, { method: 'PATCH' });
  } catch (e) {}

  if (task.completed) {
    showToast(`🎉 Bagus sekali! "${task.title.substring(0, 24)}..." berhasil diselesaikan!`);
  } else {
    showToast('Tugas dipindahkan kembali ke daftar pengerjaan.');
  }
};

window.appDeleteTask = async function(taskId) {
  appState.tasks = appState.tasks.filter(t => t.id !== taskId);
  persistLocalState();
  renderAppOverview();
  renderAppTasks();
  renderLandingSimulator();

  try {
    await fetch(`${API_BASE}/api/tasks/${taskId}`, { method: 'DELETE' });
  } catch (e) {}

  showToast('Tugas berhasil dihapus dari database.');
};

window.appToggleLabAttendance = async function(labId) {
  const lab = appState.labs.find(l => l.id === labId);
  if (!lab) return;

  lab.attended = !lab.attended;
  persistLocalState();
  renderAppLabs();
  renderAppOverview();

  try {
    await fetch(`${API_BASE}/api/labs/${labId}/toggle`, { method: 'PATCH' });
  } catch (e) {}

  showToast(lab.attended ? '✓ Kehadiran praktikum berhasil dicatat!' : 'Status kehadiran diperbarui.');
};

window.appDeleteLab = async function(labId) {
  appState.labs = appState.labs.filter(l => l.id !== labId);
  persistLocalState();
  renderAppLabs();
  renderAppOverview();

  try {
    await fetch(`${API_BASE}/api/labs/${labId}`, { method: 'DELETE' });
  } catch (e) {}

  showToast('Jadwal praktikum berhasil dihapus.');
};

/* -------------------------------------------------------------------------- */
/* TASK & LAB MODALS SUBMISSION                                               */
/* -------------------------------------------------------------------------- */
function initTaskAndLabModals() {
  const taskModal = document.getElementById('addTaskModal');
  const openTaskBtns = document.querySelectorAll('.open-add-task-modal');
  const closeTaskBtn = document.getElementById('closeAddTaskModal');
  const cancelTaskBtn = document.getElementById('btnCancelAddTask');
  const taskForm = document.getElementById('quickAddTaskForm');

  function openTaskModal() {
    if (!taskModal) return;
    taskModal.classList.remove('hidden');
    taskModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const input = document.getElementById('modalTaskTitle');
      if (input) input.focus();
    }, 100);
  }

  function closeTaskModal() {
    if (!taskModal) return;
    taskModal.classList.add('hidden');
    taskModal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  openTaskBtns.forEach(btn => btn.addEventListener('click', openTaskModal));
  if (closeTaskBtn) closeTaskBtn.addEventListener('click', closeTaskModal);
  if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', closeTaskModal);
  if (taskModal) {
    taskModal.addEventListener('click', (e) => {
      if (e.target === taskModal) closeTaskModal();
    });
  }

  if (taskForm) {
    taskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('modalTaskTitle').value.trim();
      const course = document.getElementById('modalTaskCourse').value.trim() || 'Umum';
      const deadlineVal = document.getElementById('modalTaskDeadline').value;
      const linkVal = document.getElementById('modalTaskLink').value.trim();

      if (!title || !deadlineVal) return;

      const evaluated = evaluateDeadlineUrgency(deadlineVal);
      const d = new Date(deadlineVal);
      const formattedDate = d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });

      let newTask = {
        id: Date.now(),
        title: title,
        course: course,
        deadlineDate: new Date(deadlineVal).toISOString(),
        deadlineText: formattedDate,
        urgency: evaluated.urgency,
        urgencyLabel: evaluated.label,
        badgeClass: evaluated.badgeClass,
        links: linkVal ? [{ name: linkVal, url: '#' }] : [],
        completed: false
      };

      // Try sending to Drizzle backend
      try {
        const res = await fetch(`${API_BASE}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title,
            course: course,
            deadlineDate: newTask.deadlineDate,
            links: linkVal,
            userId: appState.user.id || 1
          })
        });
        if (res.ok) {
          const body = await res.json();
          newTask = body.data;
        }
      } catch (err) {}

      appState.tasks.unshift(newTask);
      persistLocalState();
      renderAppOverview();
      renderAppTasks();
      renderLandingSimulator();
      closeTaskModal();
      taskForm.reset();

      showToast(`✨ Tugas tersimpan di database! Status sistem: ${evaluated.label}`);
    });
  }

  // Add Lab Modal
  const labModal = document.getElementById('addLabModal');
  const openLabBtns = document.querySelectorAll('.open-add-lab-modal');
  const closeLabBtn = document.getElementById('closeAddLabModal');
  const cancelLabBtn = document.getElementById('btnCancelAddLab');
  const labForm = document.getElementById('quickAddLabForm');

  function openLabModal() {
    if (!labModal) return;
    labModal.classList.remove('hidden');
    labModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const input = document.getElementById('modalLabTitle');
      if (input) input.focus();
    }, 100);
  }

  function closeLabModal() {
    if (!labModal) return;
    labModal.classList.add('hidden');
    labModal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  openLabBtns.forEach(btn => btn.addEventListener('click', openLabModal));
  if (closeLabBtn) closeLabBtn.addEventListener('click', closeLabModal);
  if (cancelLabBtn) cancelLabBtn.addEventListener('click', closeLabModal);
  if (labModal) {
    labModal.addEventListener('click', (e) => {
      if (e.target === labModal) closeLabModal();
    });
  }

  if (labForm) {
    labForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('modalLabTitle').value.trim();
      const course = document.getElementById('modalLabCourse').value.trim();
      const room = document.getElementById('modalLabRoom').value.trim();
      const time = document.getElementById('modalLabTime').value.trim();
      const assistant = document.getElementById('modalLabAssistant').value.trim();
      const link = document.getElementById('modalLabLink').value.trim();

      if (!title || !course || !room || !time) return;

      let newLab = {
        id: Date.now(),
        title: title,
        course: course,
        room: room,
        time: time,
        assistant: assistant,
        link: link,
        attended: false
      };

      try {
        const res = await fetch(`${API_BASE}/api/labs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            course,
            room,
            time,
            assistant,
            link,
            userId: appState.user.id || 1
          })
        });
        if (res.ok) {
          const body = await res.json();
          newLab = body.data;
        }
      } catch (err) {}

      appState.labs.unshift(newLab);
      persistLocalState();
      renderAppLabs();
      renderAppOverview();
      closeLabModal();
      labForm.reset();

      showToast('🧪 Jadwal praktikum berhasil disimpan di database!');
    });
  }
}

/* -------------------------------------------------------------------------- */
/* LANDING PAGE INTERACTIONS                                                  */
/* -------------------------------------------------------------------------- */
function initLandingInteractions() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const closeBtn = document.getElementById('closeMobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const backdrop = document.getElementById('mobileMenuBackdrop');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');

  if (menuBtn && mobileMenu) {
    function openMenu() {
      mobileMenu.classList.remove('translate-x-full');
      backdrop.classList.remove('hidden');
      setTimeout(() => backdrop.classList.add('opacity-100'), 10);
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      mobileMenu.classList.add('translate-x-full');
      backdrop.classList.remove('opacity-100');
      setTimeout(() => backdrop.classList.add('hidden'), 300);
      document.body.style.overflow = '';
    }

    menuBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (backdrop) backdrop.addEventListener('click', closeMenu);
    mobileLinks.forEach(link => link.addEventListener('click', closeMenu));
  }

  const filterButtons = document.querySelectorAll('.filter-pill-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => {
        b.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
        b.classList.add('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');
      });
      btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      btn.classList.remove('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');

      appState.landingFilter = btn.dataset.filter;
      renderLandingSimulator();
    });
  });

  const resetBtn = document.getElementById('resetSimulatorBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      try {
        await fetch(`${API_BASE}/api/seed`, { method: 'POST' });
        await syncWithBackend();
      } catch (e) {
        appState.tasks = [...defaultTasks];
        appState.labs = [...defaultLabs];
        persistLocalState();
        renderLandingSimulator();
        renderAppOverview();
      }
      showToast('Simulasi & database berhasil di-reset.');
    });
  }

  const urgencyTabs = document.querySelectorAll('.urgency-tab-trigger');
  const urgencyPanels = document.querySelectorAll('.urgency-tab-panel');
  urgencyTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      urgencyTabs.forEach(t => {
        t.classList.remove('border-indigo-600', 'text-indigo-600', 'bg-indigo-50/50');
        t.classList.add('border-transparent', 'text-slate-500');
      });
      tab.classList.add('border-indigo-600', 'text-indigo-600', 'bg-indigo-50/50');
      tab.classList.remove('border-transparent', 'text-slate-500');

      urgencyPanels.forEach(p => {
        p.classList.toggle('hidden', p.id !== target);
      });
    });
  });

  const accordions = document.querySelectorAll('.accordion-item');
  accordions.forEach(item => {
    const trigger = item.querySelector('.accordion-trigger');
    if (trigger) {
      trigger.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        accordions.forEach(a => {
          a.classList.remove('active');
          const ic = a.querySelector('.accordion-icon');
          if (ic) ic.style.transform = 'rotate(0deg)';
        });
        if (!isActive) {
          item.classList.add('active');
          const ic = item.querySelector('.accordion-icon');
          if (ic) ic.style.transform = 'rotate(180deg)';
        }
      });
    }
  });

  renderLandingSimulator();
}

function renderLandingSimulator() {
  const container = document.getElementById('simulatorTasksList');
  const counter = document.getElementById('completedTasksCounter');
  if (!container) return;

  const filtered = appState.tasks.filter(item => {
    if (appState.landingFilter === 'all') return true;
    if (appState.landingFilter === 'critical') return item.urgency === 'critical';
    if (appState.landingFilter === 'pending') return !item.completed;
    return true;
  });

  const completedCount = appState.tasks.filter(t => t.completed).length;
  if (counter) {
    counter.textContent = `${completedCount} dari ${appState.tasks.length} selesai`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <p class="text-sm font-semibold text-slate-600">Tidak ada tugas pada filter ini.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(task => `
    <div class="p-4 rounded-xl border ${task.completed ? 'border-slate-200 bg-slate-50/60 opacity-80' : 'border-slate-200 bg-white hover:border-indigo-300 shadow-xs'} transition flex items-start gap-3 sm:gap-4">
      <input 
        type="checkbox" 
        aria-label="Tandai selesai" 
        class="task-checkbox mt-0.5" 
        ${task.completed ? 'checked' : ''} 
        onchange="appToggleTaskStatus(${task.id})"
      />
      
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2 mb-1">
          <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${task.badgeClass}">
            ${task.urgencyLabel}
          </span>
          <span class="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            ${task.course}
          </span>
        </div>

        <h4 class="text-sm sm:text-base font-bold ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'} leading-snug">
          ${task.title}
        </h4>

        <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span class="flex items-center gap-1 ${task.urgency === 'critical' && !task.completed ? 'text-red-600 font-bold' : ''}">
            🕒 ${task.deadlineText}
          </span>
          ${task.links && task.links.length > 0 ? `
            <span class="text-indigo-600 flex items-center gap-1">
              📎 ${task.links.map(l => l.name).join(', ')}
            </span>
          ` : ''}
        </div>
      </div>

      <button 
        type="button" 
        onclick="appDeleteTask(${task.id})" 
        class="text-slate-300 hover:text-red-500 p-1 rounded" 
        title="Hapus"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    </div>
  `).join('');
}

/* -------------------------------------------------------------------------- */
/* UTILITIES & NOTIFICATIONS                                                  */
/* -------------------------------------------------------------------------- */
function showToast(message) {
  let toast = document.getElementById('globalToast');
  if (!toast) return;

  toast.innerHTML = `
    <span class="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-400"></span>
    <span class="flex-1">${message}</span>
  `;

  toast.classList.remove('-translate-y-24', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.classList.add('-translate-y-24', 'opacity-0', 'pointer-events-none');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 3800);
}

function capitalizeWords(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}
