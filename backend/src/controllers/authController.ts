import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { config } from '../config/index.js';
import { AuthRequest } from '../middleware/auth.js';

export async function register(req: AuthRequest, res: Response) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }

    const existing = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase().trim());
    if (existing) {
      res.status(400).json({ error: 'User with this email already exists.' });
      return;
    }

    const userRole = 'STUDENT';
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, name, email, passwordHash, role, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, name, email.toLowerCase().trim(), passwordHash, userRole, now, now);

    const token = jwt.sign(
      { id: userId, name, email: email.toLowerCase().trim(), role: userRole },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        name,
        email: email.toLowerCase().trim(),
        role: userRole,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

export async function login(req: AuthRequest, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase().trim()) as any;
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    // Record login audit log into database
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
    db.prepare(`
      INSERT INTO login_logs (id, userId, userName, userEmail, userRole, ipAddress, loginTime)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), user.id, user.name, user.email, user.role, ipAddress, new Date().toISOString());

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
}

export async function me(req: AuthRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  res.json({ user: req.user });
}

export async function logout(req: AuthRequest, res: Response) {
  res.json({ message: 'Successfully logged out.' });
}
