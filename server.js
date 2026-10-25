// 1. npm install
// 2. Make sure MySQL is running and taskmanager database + tasks table exist (or runs in fallback mode)
// 3. npm run dev
// 4. Open http://localhost:3001

const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Serve static files but disable auto-index so GET / can inject tasks and stats
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

let useMysql = false;
let pool = null;

const fallbackFile = path.join(__dirname, 'tasks_fallback.json');
let fallbackTasks = [];
if (fs.existsSync(fallbackFile)) {
  try {
    fallbackTasks = JSON.parse(fs.readFileSync(fallbackFile, 'utf8'));
  } catch (e) {
    fallbackTasks = [];
  }
}

function saveFallbackTasks() {
  try {
    fs.writeFileSync(fallbackFile, JSON.stringify(fallbackTasks, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save fallback tasks:', err.message);
  }
}

async function verifyConnection() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'taskmanager',
      waitForConnections: true,
      connectionLimit: 10,
    });
    const conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        assigned_to VARCHAR(100),
        deadline DATE,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    conn.release();
    useMysql = true;
    console.log('✓ Connected to MySQL database: taskmanager');
  } catch (err) {
    useMysql = false;
    console.warn('⚠️ MySQL connection failed:', err.message);
    console.log('🔄 Running in local fallback mode (using JSON storage)');
  }
}

function formatDeadline(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function formatTasks(rows) {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    assigned_to: row.assigned_to,
    deadline: formatDeadline(row.deadline),
    status: row.status,
    created_at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  }));
}

async function getTasksAndStats() {
  if (useMysql && pool) {
    const [tasks] = await pool.query(
      'SELECT * FROM tasks ORDER BY created_at DESC'
    );
    const [[stats]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'Pending') AS pending,
        SUM(status = 'Done') AS done
      FROM tasks
    `);
    return {
      tasks: formatTasks(tasks),
      stats: {
        total: Number(stats?.total) || 0,
        pending: Number(stats?.pending) || 0,
        done: Number(stats?.done) || 0,
      },
    };
  }

  const sorted = [...fallbackTasks].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  const pending = sorted.filter((t) => t.status === 'Pending').length;
  const done = sorted.filter((t) => t.status === 'Done').length;
  return {
    tasks: sorted,
    stats: { total: sorted.length, pending, done },
  };
}

function serveIndex(res, tasks, stats) {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const injection = `<script>window.__TASKS__=${JSON.stringify(tasks)};window.__STATS__=${JSON.stringify(stats)};</script>\n`;
  // Inject BEFORE the app script so window.__TASKS__ exists when renderTasks() runs
  if (html.includes('<body>')) {
    html = html.replace('<body>', '<body>\n' + injection);
  } else {
    html = html.replace('</body>', injection + '</body>');
  }
  res.send(html);
}

async function sendHome(req, res) {
  try {
    const { tasks, stats } = await getTasksAndStats();
    serveIndex(res, tasks, stats);
  } catch (err) {
    console.error('GET / error:', err);
    res.status(500).send('Server error');
  }
}

app.get('/', sendHome);
app.get('/index.html', sendHome);

app.post('/add', async (req, res) => {
  try {
    const { title, assignedTo, deadline, description } = req.body;
    if (!title || !String(title).trim()) {
      return res.redirect('/');
    }
    const deadlineDate = deadline ? String(deadline).slice(0, 10) : null;
    if (useMysql && pool) {
      await pool.query(
        'INSERT INTO tasks (title, description, assigned_to, deadline, status) VALUES (?, ?, ?, ?, ?)',
        [title, description || null, assignedTo || null, deadlineDate, 'Pending']
      );
    } else {
      const newTask = {
        id: Date.now(),
        title,
        description: description || null,
        assigned_to: assignedTo || null,
        deadline: deadlineDate,
        status: 'Pending',
        created_at: Date.now(),
      };
      fallbackTasks.unshift(newTask);
      saveFallbackTasks();
    }
    res.redirect('/');
  } catch (err) {
    console.error('POST /add error:', err);
    res.status(500).send('Server error');
  }
});

app.post('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    if (useMysql && pool) {
      await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
    } else {
      fallbackTasks = fallbackTasks.filter((t) => String(t.id) !== String(id));
      saveFallbackTasks();
    }
    res.redirect('/');
  } catch (err) {
    console.error('POST /delete error:', err);
    res.status(500).send('Server error');
  }
});

app.post('/done', async (req, res) => {
  try {
    const { id } = req.body;
    if (useMysql && pool) {
      await pool.query("UPDATE tasks SET status = 'Done' WHERE id = ?", [id]);
    } else {
      const task = fallbackTasks.find((t) => String(t.id) === String(id));
      if (task) task.status = 'Done';
      saveFallbackTasks();
    }
    res.redirect('/');
  } catch (err) {
    console.error('POST /done error:', err);
    res.status(500).send('Server error');
  }
});

verifyConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`Task Manager running at http://localhost:${PORT}`);
  });
});
