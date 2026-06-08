/* Dotun Backend Server (Express + SQLite / Pure JS Fallback) */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'DOTUN_SECURE_JWT_SECRET_KEY_2026';
const DB_PATH = path.join(__dirname, 'dotun.db');

// Enable parsing of JSON body payloads with large image capacity limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve frontend assets statically
app.use(express.static(path.join(__dirname, 'client', 'dist')));

// ----------------------------------------------------
// Database Initialization & Migrations (SQLite or Pure JS Fallback)
// ----------------------------------------------------
let db;
let dbType = 'sqlite';

// Fallback in-memory tables
let inMemoryUsers = [];
let inMemoryProjects = [];
let nextUserId = 1;
let nextProjectId = 1;

try {
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.warn('SQLite connection failure. Falling back to in-memory database:', err.message);
            setupInMemoryDB();
        } else {
            console.log('Successfully connected to SQLite database:', DB_PATH);
            runMigrations();
        }
    });
} catch (e) {
    console.warn('Failed to load native sqlite3 bindings (common on serverless environments like Vercel). Gracefully falling back to pure JavaScript in-memory database store.');
    setupInMemoryDB();
}

function setupInMemoryDB() {
    dbType = 'memory';
    db = {
        serialize: (callback) => callback(),
        run: function(query, params, callback) {
            try {
                const queryNormalized = query.trim().replace(/\s+/g, ' ');
                if (queryNormalized.startsWith('INSERT INTO users')) {
                    const [username, password] = params;
                    const id = nextUserId++;
                    inMemoryUsers.push({ id, username, password, created_at: new Date().toISOString() });
                    if (callback) callback.call({ lastID: id }, null);
                } else if (queryNormalized.startsWith('INSERT INTO projects')) {
                    const [user_id, name, image_data, state, thumbnail] = params;
                    const id = nextProjectId++;
                    inMemoryProjects.push({ id, user_id, name, image_data, state, thumbnail, created_at: new Date().toISOString() });
                    if (callback) callback.call({ lastID: id }, null);
                } else if (queryNormalized.startsWith('UPDATE projects')) {
                    const [name, image_data, state, thumbnail, id, user_id] = params;
                    const proj = inMemoryProjects.find(p => p.id === parseInt(id) && p.user_id === parseInt(user_id));
                    if (proj) {
                        proj.name = name;
                        proj.image_data = image_data;
                        proj.state = state;
                        proj.thumbnail = thumbnail;
                        if (callback) callback.call({ changes: 1 }, null);
                    } else {
                        if (callback) callback.call({ changes: 0 }, null);
                    }
                } else if (queryNormalized.startsWith('DELETE FROM projects')) {
                    const [id, user_id] = params;
                    const initialLen = inMemoryProjects.length;
                    inMemoryProjects = inMemoryProjects.filter(p => !(p.id === parseInt(id) && p.user_id === parseInt(user_id)));
                    const changes = initialLen - inMemoryProjects.length;
                    if (callback) callback.call({ changes }, null);
                } else {
                    if (callback) callback(null);
                }
            } catch (e) {
                if (callback) callback(e);
            }
        },
        get: function(query, params, callback) {
            try {
                const queryNormalized = query.trim().replace(/\s+/g, ' ');
                if (queryNormalized.includes('FROM users WHERE username = ?')) {
                    const [username] = params;
                    const user = inMemoryUsers.find(u => u.username === username);
                    if (callback) callback.call(null, user || null);
                } else if (queryNormalized.includes('FROM projects WHERE id = ? AND user_id = ?')) {
                    const [id, user_id] = params;
                    const project = inMemoryProjects.find(p => p.id === parseInt(id) && p.user_id === parseInt(user_id));
                    if (callback) callback.call(null, project || null);
                } else {
                    if (callback) callback(null, null);
                }
            } catch (e) {
                if (callback) callback(e, null);
            }
        },
        all: function(query, params, callback) {
            try {
                const queryNormalized = query.trim().replace(/\s+/g, ' ');
                if (queryNormalized.includes('FROM projects WHERE user_id = ?')) {
                    const [user_id] = params;
                    const projects = inMemoryProjects
                        .filter(p => p.user_id === parseInt(user_id))
                        .map(p => ({
                            id: p.id,
                            name: p.name,
                            thumbnail: p.thumbnail,
                            created_at: p.created_at
                        }))
                        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    if (callback) callback(null, projects);
                } else {
                    if (callback) callback(null, []);
                }
            } catch (e) {
                if (callback) callback(e, null);
            }
        }
    };
    console.log('Pure JS in-memory database mock initialized successfully.');
}

function runMigrations() {
    db.serialize(() => {
        // 1. Users authentication table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('Migration error (users table):', err.message);
        });

        // 2. Projects storage table (with FK constraints)
        db.run(`
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                image_data TEXT NOT NULL, -- Large base64 original image
                state TEXT NOT NULL,      -- Stringified JSON slider state
                thumbnail TEXT NOT NULL,  -- Small base64 thumbnail for quick list loads
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) console.error('Migration error (projects table):', err.message);
        });
    });
}

// ----------------------------------------------------
// Authentication Middleware
// ----------------------------------------------------
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ success: false, error: 'Access token missing.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Token is invalid or expired.' });
        }
        req.user = user;
        next();
    });
}

// ----------------------------------------------------
// REST API Routes
// ----------------------------------------------------

// 1. User Registration
app.post('/api/auth/signup', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password required.' });
    }

    const trimmedUser = username.trim();
    if (trimmedUser.length < 3) {
        return res.status(400).json({ success: false, error: 'Username must be at least 3 characters long.' });
    }
    if (password.length < 5) {
        return res.status(400).json({ success: false, error: 'Password must be at least 5 characters long.' });
    }

    // Hash user credentials
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Hash failed.' });
        }

        const query = `INSERT INTO users (username, password) VALUES (?, ?)`;
        db.run(query, [trimmedUser, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ success: false, error: 'Username is already taken.' });
                }
                return res.status(500).json({ success: false, error: 'Registration database insertion error.' });
            }
            res.status(201).json({ success: true, message: 'User created successfully!' });
        });
    });
});

// 2. User Authentication Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Credentials required.' });
    }

    const query = `SELECT * FROM users WHERE username = ?`;
    db.get(query, [username.trim()], (err, user) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Login query database failure.' });
        }
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid username or password.' });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Credential compare comparison error.' });
            }
            if (!isMatch) {
                return res.status(401).json({ success: false, error: 'Invalid username or password.' });
            }

            // Create token payload
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({
                success: true,
                token,
                username: user.username
            });
        });
    });
});

// 3. Retrieve Projects List (Excludes heavy image_data to optimize bandwidth)
app.get('/api/projects', authenticateToken, (req, res) => {
    const query = `
        SELECT id, name, thumbnail, created_at 
        FROM projects 
        WHERE user_id = ? 
        ORDER BY created_at DESC
    `;
    db.all(query, [req.user.userId], (err, projects) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Database projects retrieval failure.' });
        }
        res.json({ success: true, projects });
    });
});

// 4. Retrieve Single Project Full Specs (Retrieves full source photo and slider inputs)
app.get('/api/projects/:id', authenticateToken, (req, res) => {
    const query = `
        SELECT id, name, image_data, state 
        FROM projects 
        WHERE id = ? AND user_id = ?
    `;
    db.get(query, [req.params.id, req.user.userId], (err, project) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Database single project fetch failure.' });
        }
        if (!project) {
            return res.status(404).json({ success: false, error: 'Project not found.' });
        }
        res.json({ success: true, project });
    });
});

// 5. Cloud Save / Create Project
app.post('/api/projects/save', authenticateToken, (req, res) => {
    const { id, name, image_data, state, thumbnail } = req.body;

    if (!name || !image_data || !state || !thumbnail) {
        return res.status(400).json({ success: false, error: 'Project parameter specs missing.' });
    }

    if (id) {
        // Update existing project
        const query = `
            UPDATE projects 
            SET name = ?, image_data = ?, state = ?, thumbnail = ? 
            WHERE id = ? AND user_id = ?
        `;
        db.run(query, [name, image_data, state, thumbnail, id, req.user.userId], function(err) {
            if (err) {
                return res.status(500).json({ success: false, error: 'Project update DB failure.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ success: false, error: 'Project not found or unauthorized.' });
            }
            res.json({ success: true, projectId: id, message: 'Project updated successfully!' });
        });
    } else {
        // Create new project
        const query = `
            INSERT INTO projects (user_id, name, image_data, state, thumbnail) 
            VALUES (?, ?, ?, ?, ?)
        `;
        db.run(query, [req.user.userId, name, image_data, state, thumbnail], function(err) {
            if (err) {
                return res.status(500).json({ success: false, error: 'Project insertion DB failure.' });
            }
            res.status(201).json({ success: true, projectId: this.lastID, message: 'Project saved successfully!' });
        });
    }
});

// 6. Delete Project
app.delete('/api/projects/:id', authenticateToken, (req, res) => {
    const query = `DELETE FROM projects WHERE id = ? AND user_id = ?`;
    db.run(query, [req.params.id, req.user.userId], function(err) {
        if (err) {
            return res.status(500).json({ success: false, error: 'Project deletion DB failure.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Project not found or unauthorized.' });
        }
        res.json({ success: true, message: 'Project deleted successfully!' });
    });
});

// Fallback to index.html for undefined front routes (SPA friendly)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// Launch server listen listener
app.listen(PORT, () => {
    console.log(`Dotun full-stack server is running at: http://localhost:${PORT}`);
});
