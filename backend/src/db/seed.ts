import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db, initDatabase } from './index.js';

async function seed() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before creating the admin user.');
  }

  await initDatabase();

  const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existingAdmin) {
    console.log(`Admin account already exists: ${email}`);
    return;
  }

  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(password, 12);

  db.prepare(`
    INSERT INTO users (id, name, email, passwordHash, role, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), 'Site Administrator', email, passwordHash, 'ADMIN', now, now);

  console.log(`Created admin account: ${email}`);
}

seed().catch((err) => {
  console.error('Failed to create admin user:', err);
  process.exit(1);
});
