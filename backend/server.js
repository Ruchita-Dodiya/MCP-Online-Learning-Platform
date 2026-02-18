// server.js - Production-ready Online Learning Platform API
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const { body, param, query, validationResult } = require('express-validator');

// ========== CONFIGURATION VALIDATION ==========
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const PORT = parseInt(process.env.PORT || '3000', 10);
const DB_PATH = process.env.DB_PATH || './learning_platform.db';
const NODE_ENV = process.env.NODE_ENV || 'production';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters');
  process.exit(1);
}

if (BCRYPT_ROUNDS < 10 || BCRYPT_ROUNDS > 15) {
  console.error('FATAL: BCRYPT_ROUNDS must be between 10 and 15');
  process.exit(1);
}

if (ALLOWED_ORIGINS.length === 0) {
  console.error('FATAL: ALLOWED_ORIGINS must be explicitly set (comma-separated list)');
  process.exit(1);
}

// ========== DATABASE INITIALIZATION ==========
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('FATAL: Database connection failed:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('instructor', 'student')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    instructor_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    completed BOOLEAN DEFAULT 0,
    completed_at DATETIME,
    UNIQUE(student_id, lesson_id),
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_progress_student ON progress(student_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_progress_lesson ON progress(lesson_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)`);
});

const dbAsync = {
  get: (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  }),
  all: (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  }),
  run: (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes });
    });
  })
};

// ========== RATE LIMITING ==========
const rateLimiters = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 100;

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimiters.entries()) {
    if (now - data.resetTime > RATE_LIMIT_WINDOW_MS) {
      rateLimiters.delete(key);
    }
  }
}, 5 * 60 * 1000);

const perClientRateLimit = (req, res, next) => {
  const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  let limiterData = rateLimiters.get(clientKey);
  
  if (!limiterData || now - limiterData.resetTime > RATE_LIMIT_WINDOW_MS) {
    limiterData = { count: 0, resetTime: now };
    rateLimiters.set(clientKey, limiterData);
  }
  
  limiterData.count++;
  
  if (limiterData.count > RATE_LIMIT_MAX_REQUESTS) {
    auditLog(null, 'RATE_LIMIT_EXCEEDED', 'request', null, clientKey);
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  next();
};

// ========== AUDIT LOGGING ==========
const auditLog = async (userId, action, resourceType, resourceId, ipAddress) => {
  try {
    await dbAsync.run(
      'INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, ?, ?, ?)',
      [userId, action, resourceType, resourceId, ipAddress]
    );
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
};

// ========== EXPRESS APP SETUP ==========
const app = express();

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  if (req.method === 'OPTIONS') {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.sendStatus(204);
  }
  
  next();
});

app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
  }
  next();
});

app.use(perClientRateLimit);

// ========== AUTHENTICATION MIDDLEWARE ==========
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: JWT_EXPIRY
    });
    
    if (!payload.userId || !payload.role) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    
    const user = await dbAsync.get('SELECT id, email, role FROM users WHERE id = ?', [payload.userId]);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// ========== VALIDATION HELPERS ==========
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
};

const paginationValidator = [
  query('page').optional().isInt({ min: 1, max: 10000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];

const applyPagination = (req) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const offset = (page - 1) * limit;
  return { limit, offset };
};

// ========== HEALTH ENDPOINT (NO AUTH) ==========
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// ========== AUTH ENDPOINTS ==========
app.post('/api/auth/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 }),
  body('role').isIn(['instructor', 'student']),
  validate,
  async (req, res) => {
    try {
      const { email, password, role } = req.body;
      
      const existingUser = await dbAsync.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }
      
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      
      const result = await dbAsync.run(
        'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
        [email, passwordHash, role]
      );
      
      await auditLog(result.lastID, 'USER_REGISTERED', 'user', result.lastID, req.ip);
      
      const token = jwt.sign(
        { userId: result.lastID, role },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: JWT_EXPIRY }
      );
      
      res.status(201).json({
        token,
        user: { id: result.lastID, email, role }
      });
    } catch (err) {
      console.error('Registration error:', err.message);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

app.post('/api/auth/login',
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 1, max: 128 }),
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await dbAsync.get('SELECT * FROM users WHERE email = ?', [email]);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const isValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isValid) {
        await auditLog(user.id, 'LOGIN_FAILED', 'user', user.id, req.ip);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      await auditLog(user.id, 'LOGIN_SUCCESS', 'user', user.id, req.ip);
      
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: JWT_EXPIRY }
      );
      
      res.json({
        token,
        user: { id: user.id, email: user.email, role: user.role }
      });
    } catch (err) {
      console.error('Login error:', err.message);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ========== COURSE ENDPOINTS ==========
app.get('/api/courses',
  authenticateToken,
  paginationValidator,
  validate,
  async (req, res) => {
    try {
      const { limit, offset } = applyPagination(req);
      
      const courses = await dbAsync.all(
        `SELECT c.id, c.title, c.description, c.instructor_id, c.created_at, c.updated_at,
                u.email as instructor_email
         FROM courses c
         JOIN users u ON c.instructor_id = u.id
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      
      res.json({ courses });
    } catch (err) {
      console.error('Get courses error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve courses' });
    }
  }
);

app.get('/api/courses/:id',
  authenticateToken,
  param('id').isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    try {
      const course = await dbAsync.get(
        `SELECT c.id, c.title, c.description, c.instructor_id, c.created_at, c.updated_at,
                u.email as instructor_email
         FROM courses c
         JOIN users u ON c.instructor_id = u.id
         WHERE c.id = ?`,
        [req.params.id]
      );
      
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      
      const lessons = await dbAsync.all(
        'SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC',
        [req.params.id]
      );
      
      res.json({ course: { ...course, lessons } });
    } catch (err) {
      console.error('Get course error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve course' });
    }
  }
);

app.post('/api/courses',
  authenticateToken,
  requireRole('instructor'),
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  body('description').isString().trim().isLength({ min: 1, max: 5000 }),
  validate,
  async (req, res) => {
    try {
      const { title, description } = req.body;
      
      const result = await dbAsync.run(
        'INSERT INTO courses (title, description, instructor_id) VALUES (?, ?, ?)',
        [title, description, req.user.id]
      );
      
      await auditLog(req.user.id, 'COURSE_CREATED', 'course', result.lastID, req.ip);
      
      const course = await dbAsync.get('SELECT * FROM courses WHERE id = ?', [result.lastID]);
      
      res.status(201).json({ course });
    } catch (err) {
      console.error('Create course error:', err.message);
      res.status(500).json({ error: 'Failed to create course' });
    }
  }
);

app.put('/api/courses/:id',
  authenticateToken,
  requireRole('instructor'),
  param('id').isInt({ min: 1 }).toInt(),
  body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().trim().isLength({ min: 1, max: 5000 }),
  validate,
  async (req, res) => {
    try {
      const course = await dbAsync.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
      
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      
      if (course.instructor_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to modify this course' });
      }
      
      const { title, description } = req.body;
      const updates = [];
      const params = [];
      
      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);
      
      await dbAsync.run(
        `UPDATE courses SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      
      await auditLog(req.user.id, 'COURSE_UPDATED', 'course', req.params.id, req.ip);
      
      const updatedCourse = await dbAsync.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
      
      res.json({ course: updatedCourse });
    } catch (err) {
      console.error('Update course error:', err.message);
      res.status(500).json({ error: 'Failed to update course' });
    }
  }
);

app.delete('/api/courses/:id',
  authenticateToken,
  requireRole('instructor'),
  param('id').isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    try {
      const course = await dbAsync.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
      
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      
      if (course.instructor_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to delete this course' });
      }
      
      await dbAsync.run('DELETE FROM courses WHERE id = ?', [req.params.id]);
      
      await auditLog(req.user.id, 'COURSE_DELETED', 'course', req.params.id, req.ip);
      
      res.status(204).send();
    } catch (err) {
      console.error('Delete course error:', err.message);
      res.status(500).json({ error: 'Failed to delete course' });
    }
  }
);

// ========== LESSON ENDPOINTS ==========
app.get('/api/courses/:courseId/lessons',
  authenticateToken,
  param('courseId').isInt({ min: 1 }).toInt(),
  paginationValidator,
  validate,
  async (req, res) => {
    try {
      const course = await dbAsync.get('SELECT id FROM courses WHERE id = ?', [req.params.courseId]);
      
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      
      const { limit, offset } = applyPagination(req);
      
      const lessons = await dbAsync.all(
        `SELECT id, course_id, title, content, order_index, created_at, updated_at
         FROM lessons
         WHERE course_id = ?
         ORDER BY order_index ASC
         LIMIT ? OFFSET ?`,
        [req.params.courseId, limit, offset]
      );
      
      res.json({ lessons });
    } catch (err) {
      console.error('Get lessons error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve lessons' });
    }
  }
);

app.get('/api/lessons/:id',
  authenticateToken,
  param('id').isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    try {
      const lesson = await dbAsync.get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
      
      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      
      res.json({ lesson });
    } catch (err) {
      console.error('Get lesson error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve lesson' });
    }
  }
);

app.post('/api/courses/:courseId/lessons',
  authenticateToken,
  requireRole('instructor'),
  param('courseId').isInt({ min: 1 }).toInt(),
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  body('content').isString().trim().isLength({ min: 1, max: 50000 }),
  body('order_index').isInt({ min: 0 }),
  validate,
  async (req, res) => {
    try {
      const course = await dbAsync.get('SELECT * FROM courses WHERE id = ?', [req.params.courseId]);
      
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      
      if (course.instructor_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to add lessons to this course' });
      }
      
      const { title, content, order_index } = req.body;
      
      const result = await dbAsync.run(
        'INSERT INTO lessons (course_id, title, content, order_index) VALUES (?, ?, ?, ?)',
        [req.params.courseId, title, content, order_index]
      );
      
      await auditLog(req.user.id, 'LESSON_CREATED', 'lesson', result.lastID, req.ip);
      
      const lesson = await dbAsync.get('SELECT * FROM lessons WHERE id = ?', [result.lastID]);
      
      res.status(201).json({ lesson });
    } catch (err) {
      console.error('Create lesson error:', err.message);
      res.status(500).json({ error: 'Failed to create lesson' });
    }
  }
);

app.put('/api/lessons/:id',
  authenticateToken,
  requireRole('instructor'),
  param('id').isInt({ min: 1 }).toInt(),
  body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('content').optional().isString().trim().isLength({ min: 1, max: 50000 }),
  body('order_index').optional().isInt({ min: 0 }),
  validate,
  async (req, res) => {
    try {
      const lesson = await dbAsync.get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
      
      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      
      const course = await dbAsync.get('SELECT * FROM courses WHERE id = ?', [lesson.course_id]);
      
      if (course.instructor_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to modify this lesson' });
      }
      
      const { title, content, order_index } = req.body;
      const updates = [];
      const params = [];
      
      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }
      if (content !== undefined) {
        updates.push('content = ?');
        params.push(content);
      }
      if (order_index !== undefined) {
        updates.push('order_index = ?');
        params.push(order_index);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);
      
      await dbAsync.run(
        `UPDATE lessons SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      
      await auditLog(req.user.id, 'LESSON_UPDATED', 'lesson', req.params.id, req.ip);
      
      const updatedLesson = await dbAsync.get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
      
      res.json({ lesson: updatedLesson });
    } catch (err) {
      console.error('Update lesson error:', err.message);
      res.status(500).json({ error: 'Failed to update lesson' });
    }
  }
);

app.delete('/api/lessons/:id',
  authenticateToken,
  requireRole('instructor'),
  param('id').isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    try {
      const lesson = await dbAsync.get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
      
      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      
      const course = await dbAsync.get('SELECT * FROM courses WHERE id = ?', [lesson.course_id]);
      
      if (course.instructor_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to delete this lesson' });
      }
      
      await dbAsync.run('DELETE FROM lessons WHERE id = ?', [req.params.id]);
      
      await auditLog(req.user.id, 'LESSON_DELETED', 'lesson', req.params.id, req.ip);
      
      res.status(204).send();
    } catch (err) {
      console.error('Delete lesson error:', err.message);
      res.status(500).json({ error: 'Failed to delete lesson' });
    }
  }
);

// ========== ENROLLMENT ENDPOINTS ==========
app.post('/api/enrollments',
  authenticateToken,
  requireRole('student'),
  body('course_id').isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const { course_id } = req.body;
      
      const course = await dbAsync.get('SELECT id FROM courses WHERE id = ?', [course_id]);
      
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      
      const existingEnrollment = await dbAsync.get(
        'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
        [req.user.id, course_id]
      );
      
      if (existingEnrollment) {
        return res.status(409).json({ error: 'Already enrolled in this course' });
      }
      
      const result = await dbAsync.run(
        'INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)',
        [req.user.id, course_id]
      );
      
      await auditLog(req.user.id, 'ENROLLMENT_CREATED', 'enrollment', result.lastID, req.ip);
      
      const enrollment = await dbAsync.get('SELECT * FROM enrollments WHERE id = ?', [result.lastID]);
      
      res.status(201).json({ enrollment });
    } catch (err) {
      console.error('Create enrollment error:', err.message);
      res.status(500).json({ error: 'Failed to enroll in course' });
    }
  }
);

app.get('/api/enrollments',
  authenticateToken,
  requireRole('student'),
  paginationValidator,
  validate,
  async (req, res) => {
    try {
      const { limit, offset } = applyPagination(req);
      
      const enrollments = await dbAsync.all(
        `SELECT e.id, e.course_id, e.enrolled_at, c.title, c.description
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE e.student_id = ?
         ORDER BY e.enrolled_at DESC
         LIMIT ? OFFSET ?`,
        [req.user.id, limit, offset]
      );
      
      res.json({ enrollments });
    } catch (err) {
      console.error('Get enrollments error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve enrollments' });
    }
  }
);

app.delete('/api/enrollments/:id',
  authenticateToken,
  requireRole('student'),
  param('id').isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    try {
      const enrollment = await dbAsync.get(
        'SELECT * FROM enrollments WHERE id = ? AND student_id = ?',
        [req.params.id, req.user.id]
      );
      
      if (!enrollment) {
        return res.status(404).json({ error: 'Enrollment not found' });
      }
      
      await dbAsync.run('DELETE FROM enrollments WHERE id = ?', [req.params.id]);
      
      await auditLog(req.user.id, 'ENROLLMENT_DELETED', 'enrollment', req.params.id, req.ip);
      
      res.status(204).send();
    } catch (err) {
      console.error('Delete enrollment error:', err.message);
      res.status(500).json({ error: 'Failed to unenroll from course' });
    }
  }
);

// ========== PROGRESS TRACKING ENDPOINTS ==========
app.post('/api/progress',
  authenticateToken,
  requireRole('student'),
  body('lesson_id').isInt({ min: 1 }),
  body('completed').isBoolean(),
  validate,
  async (req, res) => {
    try {
      const { lesson_id, completed } = req.body;
      
      const lesson = await dbAsync.get('SELECT * FROM lessons WHERE id = ?', [lesson_id]);
      
      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      
      const enrollment = await dbAsync.get(
        'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
        [req.user.id, lesson.course_id]
      );
      
      if (!enrollment) {
        return res.status(403).json({ error: 'Must be enrolled in course to track progress' });
      }
      
      const existingProgress = await dbAsync.get(
        'SELECT * FROM progress WHERE student_id = ? AND lesson_id = ?',
        [req.user.id, lesson_id]
      );
      
      let result;
      
      if (existingProgress) {
        await dbAsync.run(
          'UPDATE progress SET completed = ?, completed_at = ? WHERE student_id = ? AND lesson_id = ?',
          [completed ? 1 : 0, completed ? new Date().toISOString() : null, req.user.id, lesson_id]
        );
        result = existingProgress;
      } else {
        const insertResult = await dbAsync.run(
          'INSERT INTO progress (student_id, lesson_id, completed, completed_at) VALUES (?, ?, ?, ?)',
          [req.user.id, lesson_id, completed ? 1 : 0, completed ? new Date().toISOString() : null]
        );
        result = { id: insertResult.lastID };
      }
      
      await auditLog(req.user.id, 'PROGRESS_UPDATED', 'progress', result.id, req.ip);
      
      const progress = await dbAsync.get(
        'SELECT * FROM progress WHERE student_id = ? AND lesson_id = ?',
        [req.user.id, lesson_id]
      );
      
      res.json({ progress });
    } catch (err) {
      console.error('Update progress error:', err.message);
      res.status(500).json({ error: 'Failed to update progress' });
    }
  }
);

app.get('/api/courses/:courseId/progress',
  authenticateToken,
  requireRole('student'),
  param('courseId').isInt({ min: 1 }).toInt(),
  validate,
  async (req, res) => {
    try {
      const enrollment = await dbAsync.get(
        'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
        [req.user.id, req.params.courseId]
      );
      
      if (!enrollment) {
        return res.status(403).json({ error: 'Not enrolled in this course' });
      }
      
      const progress = await dbAsync.all(
        `SELECT p.id, p.lesson_id, p.completed, p.completed_at, l.title, l.order_index
         FROM progress p
         JOIN lessons l ON p.lesson_id = l.id
         WHERE p.student_id = ? AND l.course_id = ?
         ORDER BY l.order_index ASC`,
        [req.user.id, req.params.courseId]
      );
      
      res.json({ progress });
    } catch (err) {
      console.error('Get progress error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve progress' });
    }
  }
);

// ========== CATCH-ALL ERROR HANDLER ==========
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ========== SERVER STARTUP ==========
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
  console.log('Security enforced: JWT auth, rate limiting, CORS, audit logging, input validation');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

module.exports = app;
