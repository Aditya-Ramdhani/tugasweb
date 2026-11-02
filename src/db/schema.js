const { sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');

/**
 * Users Table
 * Stores student credentials, academic profiles, and timestamps
 */
const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  major: text('major').default('Teknik Informatika'),
  semester: text('semester').default('Semester 4'),
  password: text('password').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
});

/**
 * Tasks Table (PRD Section 5: CRUD Tugas & Deadline, Urgency Indicators)
 * Urgency is computed by system based on deadline
 */
const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  title: text('title').notNull(),
  course: text('course').notNull(),
  deadlineDate: text('deadline_date').notNull(),
  deadlineText: text('deadline_text'),
  urgency: text('urgency').notNull().default('warning'), // 'critical' | 'warning' | 'safe' | 'overdue'
  urgencyLabel: text('urgency_label').notNull().default('🟡 H-3 Waspada'),
  badgeClass: text('badge_class').notNull().default('badge-warning'),
  links: text('links'), // JSON array: [{ name, url }]
  completed: integer('completed').notNull().default(0), // 0: false, 1: true
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString())
});

/**
 * Task History Table (PRD Section 5: History Tracking Status Tugas)
 */
const taskHistory = sqliteTable('task_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'created' | 'completed' | 'uncompleted' | 'updated' | 'deleted'
  note: text('note'),
  timestamp: text('timestamp').notNull().$defaultFn(() => new Date().toISOString())
});

/**
 * Labs Table (PRD Section 5: Jadwal Khusus Praktikum P1 Wajib)
 * Rutin praktikum terpisah dari tugas biasa, lengkap dengan ruangan & asisten
 */
const labs = sqliteTable('labs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  title: text('title').notNull(),
  course: text('course').notNull(),
  time: text('time').notNull(),
  room: text('room').notNull(),
  assistant: text('assistant'),
  link: text('link'),
  attended: integer('attended').notNull().default(0), // 0: false, 1: true
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
});

module.exports = {
  users,
  tasks,
  taskHistory,
  labs
};

