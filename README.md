# 📚 TaskLab - Student Task & Lab Manager

Aplikasi produktivitas berbasis web yang dirancang khusus untuk mahasiswa guna mengelola jadwal praktikum, memantau tenggat waktu (*deadline*) tugas dari berbagai mata kuliah, dan menyimpan tautan referensi materi dalam satu platform terpusat.

Dibangun berdasarkan spesifikasi **Product Requirements Document (PRD)** dengan fokus mengatasi prokrastinasi melalui indikator visual urgensi otomatis (*H-1 Merah, H-3 Kuning, H-7 Hijau*).

---

## 🚀 Fitur Utama

- **Dashboard Mahasiswa:** Ringkasan terpadu tugas dan agenda praktikum minggu ini.
- **Daftar Tugas & Deadline (CRUD):** Tambah, lihat, update status, hapus, serta pelacakan riwayat (*history tracking*).
- **Kalkulasi Urgensi Otomatis:** Sistem mengevaluasi selisih waktu deadline secara otomatis (🔴 H-1 Kritis $\le 24$ jam, 🟡 H-3 Waspada $1-3$ hari, 🟢 H-7 Aman $> 3$ hari).
- **Jadwal Praktikum Khusus (P1 Wajib):** Kalender rutin praktikum terpisah dari tugas biasa, lengkap dengan jam, ruangan lab, dan asisten dosen.
- **Penyimpanan Link & Modul (P2):** Tautan modul PDF, Google Drive, dan GitHub repo langsung tersemat di kartu tugas.
- **Autentikasi Pengguna:** Login, pendaftaran akun baru, dan fitur demo instan 1-klik sebagai mahasiswa (*user123*).
- **Antarmuka Responsif:** Dioptimalkan untuk perangkat mobile (smartphone) dengan bilah aksi bawah (*floating bottom bar*) dan desktop laptop.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5 Semantik, Tailwind CSS (Utility-First), Modern Vanilla JavaScript (ES6+), Google Fonts (Plus Jakarta Sans & Inter).
- **Backend:** Node.js, Express.js REST API.
- **Database & ORM:** SQLite (`better-sqlite3`) dengan **Drizzle ORM**.
- **Task Seeding:** Script inisialisasi data awal mahasiswa, tugas, riwayat, dan sesi praktikum.

---

## 💻 Cara Menjalankan Aplikasi

### 1. Prasyarat
- Pastikan **Node.js** (versi 18+) sudah terpasang.

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Inisialisasi Database (Seed Data Awal)
```bash
npm run seed:force
```

### 4. Menjalankan Server
```bash
# Menjalankan server backend & frontend
npm start

# Atau mode development (auto-reload)
npm run dev
```

Buka browser Anda di `http://localhost:3000`.

---

## 📂 Struktur Proyek

```text
tugas_web/
├── assets/
│   ├── css/
│   │   └── style.css       # Custom styles, responsive animations & urgencies
│   └── js/
│       └── main.js         # Frontend interactive logic & API sync
├── src/
│   └── db/
│       ├── schema.js       # Skema Drizzle ORM (users, tasks, task_history, labs)
│       ├── index.js        # Inisialisasi SQLite database & Drizzle
│       └── seed.js         # Seeding data awal tugas & praktikum
├── server.js               # Express server & REST API endpoints
├── index.html              # Landing page & Student Dashboard
├── package.json            # Script & dependensi
└── prd.md                  # Dokumen Product Requirements Document
```

---

## 👤 Pembuat
- **Username:** Aditya-Ramdhani
- **Repository:** https://github.com/Aditya-Ramdhani/tugas_web
