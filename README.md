# Task Manager 📋

A responsive, full-featured web application for managing tasks, deadlines, and project workflows. Built with Node.js, Express, and MySQL (with seamless JSON fallback mode for standalone offline use).

---

## ✨ Features

- **Task Dashboard**: Real-time overview of pending, in-progress, and completed tasks.
- **Full CRUD Support**: Create, read, update status, edit, and delete tasks seamlessly.
- **MySQL & Fallback Mode**: Automatically connects to MySQL database if available, or gracefully falls back to local JSON storage for zero-config quick start.
- **Modern UI**: Clean, responsive Batman / cyberpunk-themed dashboard with smooth micro-interactions.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [MySQL](https://www.mysql.com/) (Optional — falls back to local JSON if MySQL is offline)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/yatinvarma2006-png/Task-Manager-.git
cd Task-Manager-

# Install dependencies
npm install
```

### 3. Running the App
```bash
# Development mode with hot-reloading
npm run dev

# Or start directly
npm start
```

Visit [http://localhost:3001](http://localhost:3001) in your browser.

---

## 🗄️ Database Setup (Optional)

If running with MySQL, configure your credentials using environment variables:
```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=taskmanager
PORT=3001
```

If MySQL is unavailable, the application will automatically manage tasks in `tasks_fallback.json` without breaking.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express
- **Database**: MySQL2 (with file fallback)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
