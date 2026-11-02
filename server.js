const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, schema, sqlite } = require('./src/db');
const { users, tasks, labs, taskHistory } = schema;
const { eq, and, desc, like, or } = require('drizzle-orm');
const { seed } = require('./src/db/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files (HTML, CSS, JS, assets)
app.use(express.static(path.resolve(__dirname, '.')));

/**
 * Helper: Automatic System Urgency Evaluator
 * Same robust logic as PRD requirements
 */
function evaluateDeadlineUrgency(deadlineString) {
  if (!deadlineString) {
    return {
      urgency: 'warning',
      label: '🟡 H-3 Waspada',
      badgeClass: 'badge-warning'
    };
  }

  const deadline = new Date(deadlineString);
  const now = new Date();
  const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0) {
    return {
      urgency: 'overdue',
      label: '⚠️ Lewat Deadline',
      badgeClass: 'badge-urgent'
    };
  }
  if (diffHours <= 24) {
    return {
      urgency: 'critical',
      label: '🔴 H-1 Mendesak',
      badgeClass: 'badge-urgent'
    };
  }
  if (diffHours <= 72) {
    return {
      urgency: 'warning',
      label: '🟡 H-3 Waspada',
      badgeClass: 'badge-warning'
    };
  }
  return {
    urgency: 'safe',
    label: '🟢 H-7 Aman',
    badgeClass: 'badge-safe'
  };
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

// -----------------------------------------------------------------------------
// AUTHENTICATION ROUTES
// -----------------------------------------------------------------------------

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, major, semester } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi.' });
    }

    const existing = db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
    if (existing) {
      return res.status(409).json({ error: 'Email mahasiswa ini sudah terdaftar.' });
    }

    const [newUser] = db.insert(users).values({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password, // In production hash with bcrypt
      major: major || 'Teknik Informatika',
      semester: semester || 'Semester 4',
      createdAt: new Date().toISOString()
    }).returning().all();

    const { password: _, ...userSafe } = newUser;
    res.status(201).json({ message: 'Registrasi berhasil', user: userSafe });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Gagal melakukan pendaftaran akun.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
    }

    const user = db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Email atau kata sandi tidak cocok.' });
    }

    const { password: _, ...userSafe } = user;
    res.json({ message: 'Login berhasil', user: userSafe });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Gagal melakukan proses login.' });
  }
});

// POST /api/auth/demo (1-Click Instant Demo Login)
app.post('/api/auth/demo', async (req, res) => {
  try {
    let demoUser = db.select().from(users).where(eq(users.email, 'user123@kampus.ac.id')).get();
    if (!demoUser) {
      // Seed if not exists
      await seed(true);
      demoUser = db.select().from(users).where(eq(users.email, 'user123@kampus.ac.id')).get();
    }

    const { password: _, ...userSafe } = demoUser;
    res.json({ message: 'Demo login berhasil', user: userSafe });
  } catch (err) {
    console.error('Demo auth error:', err);
    res.status(500).json({ error: 'Gagal login demo.' });
  }
});

// -----------------------------------------------------------------------------
// TASKS CRUD ROUTES (Drizzle ORM)
// -----------------------------------------------------------------------------

// GET /api/tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const { search, course, completed } = req.query;

    let allTasks = db.select().from(tasks).orderBy(desc(tasks.createdAt)).all();

    // Map through and evaluate system urgency dynamically
    allTasks = allTasks.map(task => {
      const evalResult = evaluateDeadlineUrgency(task.deadlineDate);
      let parsedLinks = [];
      try {
        parsedLinks = task.links ? JSON.parse(task.links) : [];
      } catch (e) {
        parsedLinks = [];
      }

      return {
        ...task,
        completed: Boolean(task.completed),
        urgency: evalResult.urgency,
        urgencyLabel: evalResult.label,
        badgeClass: evalResult.badgeClass,
        links: parsedLinks
      };
    });

    // In-memory filter based on query params
    if (completed !== undefined) {
      const isComp = completed === 'true' || completed === '1';
      allTasks = allTasks.filter(t => t.completed === isComp);
    }
    if (course && course !== 'all') {
      allTasks = allTasks.filter(t => t.course.toLowerCase() === course.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      allTasks = allTasks.filter(t => t.title.toLowerCase().includes(q) || t.course.toLowerCase().includes(q));
    }

    res.json({ data: allTasks, count: allTasks.length });
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar tugas.' });
  }
});

// POST /api/tasks (System computes urgency automatically)
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, course, deadlineDate, links, userId } = req.body;
    if (!title || !deadlineDate) {
      return res.status(400).json({ error: 'Nama tugas dan tenggat waktu (deadline) wajib diisi.' });
    }

    const evalResult = evaluateDeadlineUrgency(deadlineDate);
    const deadlineText = formatReadableDate(deadlineDate);
    const linksJson = Array.isArray(links) ? JSON.stringify(links) : (links ? JSON.stringify([{ name: links, url: '#' }]) : '[]');

    const [newTask] = db.insert(tasks).values({
      userId: userId ? Number(userId) : 1,
      title: title.trim(),
      course: (course || 'Umum').trim(),
      deadlineDate: new Date(deadlineDate).toISOString(),
      deadlineText: deadlineText,
      urgency: evalResult.urgency,
      urgencyLabel: evalResult.label,
      badgeClass: evalResult.badgeClass,
      links: linksJson,
      completed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning().all();

    // Record creation history
    db.insert(taskHistory).values({
      taskId: newTask.id,
      action: 'created',
      note: `Tugas dicatat. Sistem menetapkan urgensi ${evalResult.label}.`,
      timestamp: new Date().toISOString()
    }).run();

    res.status(201).json({
      message: 'Tugas berhasil dicatat!',
      data: {
        ...newTask,
        completed: false,
        links: JSON.parse(newTask.links || '[]')
      }
    });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Gagal mencatat tugas baru.' });
  }
});

// PATCH /api/tasks/:id/toggle (Toggle completed status + History Tracking)
app.patch('/api/tasks/:id/toggle', async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const current = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!current) {
      return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
    }

    const newStatus = current.completed ? 0 : 1;
    const [updated] = db.update(tasks).set({
      completed: newStatus,
      updatedAt: new Date().toISOString()
    }).where(eq(tasks.id, taskId)).returning().all();

    // Record history action
    db.insert(taskHistory).values({
      taskId: taskId,
      action: newStatus === 1 ? 'completed' : 'uncompleted',
      note: newStatus === 1 ? 'Tugas ditandai selesai.' : 'Tugas dikembalikan ke antrian pengerjaan.',
      timestamp: new Date().toISOString()
    }).run();

    res.json({
      message: newStatus === 1 ? 'Tugas selesai!' : 'Tugas dibuka kembali.',
      data: {
        ...updated,
        completed: Boolean(updated.completed),
        links: JSON.parse(updated.links || '[]')
      }
    });
  } catch (err) {
    console.error('Toggle task error:', err);
    res.status(500).json({ error: 'Gagal memperbarui status tugas.' });
  }
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const current = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!current) {
      return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
    }

    db.delete(tasks).where(eq(tasks.id, taskId)).run();
    res.json({ message: 'Tugas berhasil dihapus.', id: taskId });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Gagal menghapus tugas.' });
  }
});

// GET /api/tasks/:id/history (History tracking inspection)
app.get('/api/tasks/:id/history', async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const histories = db.select().from(taskHistory).where(eq(taskHistory.taskId, taskId)).orderBy(desc(taskHistory.timestamp)).all();
    res.json({ data: histories });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Gagal memuat riwayat tugas.' });
  }
});

// -----------------------------------------------------------------------------
// LABS CRUD ROUTES (Jadwal Praktikum Khusus - PRD Section 5)
// -----------------------------------------------------------------------------

// GET /api/labs
app.get('/api/labs', async (req, res) => {
  try {
    const allLabs = db.select().from(labs).orderBy(desc(labs.createdAt)).all();
    const formatted = allLabs.map(l => ({ ...l, attended: Boolean(l.attended) }));
    res.json({ data: formatted, count: formatted.length });
  } catch (err) {
    console.error('Get labs error:', err);
    res.status(500).json({ error: 'Gagal memuat jadwal praktikum.' });
  }
});

// POST /api/labs
app.post('/api/labs', async (req, res) => {
  try {
    const { title, course, room, time, assistant, link, userId } = req.body;
    if (!title || !course || !room || !time) {
      return res.status(400).json({ error: 'Judul, mata kuliah, ruangan, dan jam praktikum wajib diisi.' });
    }

    const [newLab] = db.insert(labs).values({
      userId: userId ? Number(userId) : 1,
      title: title.trim(),
      course: course.trim(),
      room: room.trim(),
      time: time.trim(),
      assistant: assistant ? assistant.trim() : null,
      link: link ? link.trim() : null,
      attended: 0,
      createdAt: new Date().toISOString()
    }).returning().all();

    res.status(201).json({
      message: 'Jadwal praktikum berhasil disimpan!',
      data: { ...newLab, attended: false }
    });
  } catch (err) {
    console.error('Create lab error:', err);
    res.status(500).json({ error: 'Gagal menyimpan jadwal praktikum.' });
  }
});

// PATCH /api/labs/:id/toggle (Toggle attendance)
app.patch('/api/labs/:id/toggle', async (req, res) => {
  try {
    const labId = Number(req.params.id);
    const current = db.select().from(labs).where(eq(labs.id, labId)).get();
    if (!current) {
      return res.status(404).json({ error: 'Praktikum tidak ditemukan.' });
    }

    const newAttended = current.attended ? 0 : 1;
    const [updated] = db.update(labs).set({ attended: newAttended }).where(eq(labs.id, labId)).returning().all();

    res.json({
      message: newAttended === 1 ? 'Kehadiran praktikum dicatat!' : 'Status kehadiran diperbarui.',
      data: { ...updated, attended: Boolean(updated.attended) }
    });
  } catch (err) {
    console.error('Toggle lab error:', err);
    res.status(500).json({ error: 'Gagal memperbarui kehadiran praktikum.' });
  }
});

// DELETE /api/labs/:id
app.delete('/api/labs/:id', async (req, res) => {
  try {
    const labId = Number(req.params.id);
    db.delete(labs).where(eq(labs.id, labId)).run();
    res.json({ message: 'Jadwal praktikum berhasil dihapus.', id: labId });
  } catch (err) {
    console.error('Delete lab error:', err);
    res.status(500).json({ error: 'Gagal menghapus jadwal praktikum.' });
  }
});

// -----------------------------------------------------------------------------
// DASHBOARD STATS ROUTE
// -----------------------------------------------------------------------------

// GET /api/dashboard/stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const allTasks = db.select().from(tasks).all();
    const allLabs = db.select().from(labs).all();

    const activeTasks = allTasks.filter(t => !t.completed);
    const completedTasks = allTasks.filter(t => t.completed);
    const criticalTasks = activeTasks.filter(t => {
      const evalRes = evaluateDeadlineUrgency(t.deadlineDate);
      return evalRes.urgency === 'critical';
    });

    const completionRate = allTasks.length > 0 
      ? Math.round((completedTasks.length / allTasks.length) * 100) 
      : 100;

    res.json({
      activeTasks: activeTasks.length,
      criticalTasks: criticalTasks.length,
      totalLabs: allLabs.length,
      completionRate: `${completionRate}%`
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Gagal memuat statistik dashboard.' });
  }
});

// POST /api/seed (Re-seed database endpoint)
app.post('/api/seed', async (req, res) => {
  try {
    await seed(true);
    res.json({ message: 'Database Drizzle berhasil di-reset dan di-seed dengan data awal!' });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: 'Gagal me-reset database.' });
  }
});

// Fallback to index.html for client-side navigation (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 TaskLab Backend Server Running with Drizzle ORM`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`💾 Database: SQLite (Drizzle ORM via better-sqlite3)`);
    console.log(`📋 REST API: /api/tasks, /api/labs, /api/auth, /api/stats`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
