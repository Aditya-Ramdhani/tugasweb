const { db, schema, sqlite } = require('./index');
const { users, tasks, labs, taskHistory } = schema;
const { eq } = require('drizzle-orm');

function getRelativeDateIso(daysFromNow, hours = 23, minutes = 59) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function formatReadableDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function seed(force = false) {
  console.log('🌱 Starting TaskLab Database Seeding with Drizzle ORM...');

  const existingUsers = db.select().from(users).all();
  if (existingUsers.length > 0 && !force) {
    console.log('Database already has data. Skipping seed. (Use force=true to reset)');
    return;
  }

  if (force) {
    console.log('Clearing existing tables...');
    sqlite.exec(`
      DELETE FROM task_history;
      DELETE FROM tasks;
      DELETE FROM labs;
      DELETE FROM users;
      DELETE FROM sqlite_sequence WHERE name IN ('task_history', 'tasks', 'labs', 'users');
    `);
  }

  // 1. Seed Demo Student User
  const [demoUser] = db.insert(users).values({
    name: 'user123',
    email: 'user123@kampus.ac.id',
    major: 'Teknik Informatika',
    semester: 'Semester 4',
    password: 'password123',
    createdAt: new Date().toISOString()
  }).returning().all();

  console.log(`👤 Created user: ${demoUser.name} (${demoUser.email})`);

  // 2. Seed Tasks with Realistic Urgency (PRD Section 5 & 6)
  const tomorrowIso = getRelativeDateIso(1, 23, 59);
  const threeDaysIso = getRelativeDateIso(3, 17, 0);
  const sevenDaysIso = getRelativeDateIso(7, 23, 59);

  const seededTasks = [
    {
      userId: demoUser.id,
      title: 'Laporan Akhir Jaringan Komputer: Routing OSPF & BGP',
      course: 'Jaringan Komputer II',
      deadlineDate: tomorrowIso,
      deadlineText: formatReadableDate(tomorrowIso),
      urgency: 'critical',
      urgencyLabel: '🔴 H-1 Mendesak',
      badgeClass: 'badge-urgent',
      links: JSON.stringify([
        { name: 'Modul-07.pdf', url: '#' },
        { name: 'Cisco Packet Tracer', url: '#' }
      ]),
      completed: 0
    },
    {
      userId: demoUser.id,
      title: 'Tugas Analisis Kompleksitas Algoritma Dijkstra',
      course: 'Strategi Algoritma',
      deadlineDate: threeDaysIso,
      deadlineText: formatReadableDate(threeDaysIso),
      urgency: 'warning',
      urgencyLabel: '🟡 H-3 Waspada',
      badgeClass: 'badge-warning',
      links: JSON.stringify([
        { name: 'Slide Dosen Pertemuan 8', url: '#' }
      ]),
      completed: 0
    },
    {
      userId: demoUser.id,
      title: 'Review Jurnal Basis Data NoSQL vs RDBMS',
      course: 'Sistem Basis Data Lanjut',
      deadlineDate: sevenDaysIso,
      deadlineText: formatReadableDate(sevenDaysIso),
      urgency: 'safe',
      urgencyLabel: '🟢 H-7 Aman',
      badgeClass: 'badge-safe',
      links: JSON.stringify([
        { name: 'IEEE Paper.pdf', url: '#' }
      ]),
      completed: 1
    }
  ];

  for (const t of seededTasks) {
    const [insertedTask] = db.insert(tasks).values(t).returning().all();
    
    // Seed history
    db.insert(taskHistory).values({
      taskId: insertedTask.id,
      action: 'created',
      note: 'Tugas dibuat melalui inisialisasi awal (task seeding).',
      timestamp: new Date().toISOString()
    }).run();

    if (insertedTask.completed) {
      db.insert(taskHistory).values({
        taskId: insertedTask.id,
        action: 'completed',
        note: 'Tugas ditandai selesai tepat waktu.',
        timestamp: new Date().toISOString()
      }).run();
    }
  }

  console.log(`📝 Seeded ${seededTasks.length} tasks with history tracking.`);

  // 3. Seed Labs (PRD Section 5: Jadwal Praktikum Khusus P1)
  const seededLabs = [
    {
      userId: demoUser.id,
      title: 'Praktikum Pemrograman Web: REST API & Flask MVC',
      course: 'Praktikum Pemrograman Web',
      time: 'Hari Ini, 13:00 - 15:30 WIB',
      room: 'Lab Komputasi Gedung B - R.302',
      assistant: 'Kak Arya & Kak Cindy',
      link: 'Modul Flask Jinja2.pdf',
      attended: 0
    },
    {
      userId: demoUser.id,
      title: 'Praktikum Jaringan Komputer: Simulasi Subnetting & VLAN',
      course: 'Praktikum Jaringan Komputer',
      time: 'Jumat, 08:00 - 10:30 WIB',
      room: 'Lab Jaringan Komputer - R.204',
      assistant: 'Kak Budi Santoso',
      link: 'Panduan VLAN Lab.pdf',
      attended: 0
    }
  ];

  for (const l of seededLabs) {
    db.insert(labs).values(l).run();
  }

  console.log(`🧪 Seeded ${seededLabs.length} lab practical sessions.`);
  console.log('✅ TaskLab Database Seeding complete!\n');
}

// Allow running directly via CLI
if (require.main === module) {
  const force = process.argv.includes('--force');
  seed(force);
}

module.exports = { seed };

