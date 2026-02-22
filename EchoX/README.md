# EchoX — Real-Time Chat Application

A production-ready real-time chat application with dark glassmorphism UI, built with Flask + SocketIO + PostgreSQL.

## Features
- 🔐 Authentication (signup, login, logout, sessions)
- 💬 Real-time one-to-one chat with typing indicators & seen status
- 👥 Group chats with admin controls
- ⚡ Pulse (status/stories) — image, video, text
- 📎 File sharing (images, videos, documents, any format)
- 🏠 Premium dashboard with profile, stats, settings
- 🗑️ Secure account deletion
- 🌑 Dark glassmorphism theme, mobile-first

---

## Prerequisites

- Python 3.10+
- PostgreSQL 14+
- pip

---

## Installation

### Step 1 — Clone / Extract the project

```bash
cd echox
```

### Step 2 — Create a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate        # macOS / Linux
# OR
venv\Scripts\activate           # Windows
```

### Step 3 — Install Python dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Set up PostgreSQL

#### Option A — Use the setup script (Linux/macOS)
```bash
chmod +x setup_db.sh
./setup_db.sh
```

#### Option B — Manual setup
Open your PostgreSQL prompt and run:

```sql
CREATE USER echox_user WITH PASSWORD 'echox_pass';
CREATE DATABASE echox_db OWNER echox_user;
GRANT ALL PRIVILEGES ON DATABASE echox_db TO echox_user;
\c echox_db
GRANT ALL ON SCHEMA public TO echox_user;
```

### Step 5 — Configure database URL (optional)

The default connection string in `app.py` is:
```
postgresql://echox_user:echox_pass@localhost/echox_db
```

To override, set the environment variable before running:
```bash
export DATABASE_URL=postgresql://YOUR_USER:YOUR_PASS@localhost/YOUR_DB
```

Or on Windows:
```cmd
set DATABASE_URL=postgresql://YOUR_USER:YOUR_PASS@localhost/YOUR_DB
```

### Step 6 — Run the application

```bash
python app.py
```

The app will:
1. Auto-create all database tables (users, messages, groups, group_members, pulses)
2. Start the Flask-SocketIO server

Open your browser at: **http://localhost:5000**

---

## Project Structure

```
echox/
├── app.py                  # Main Flask application
├── requirements.txt        # Python dependencies
├── setup_db.sh             # PostgreSQL setup helper
├── templates/
│   ├── login.html
│   ├── signup.html
│   ├── dashboard.html
│   ├── chat.html
│   ├── group.html
│   ├── pulse.html
│   └── delete_account.html
└── static/
    ├── css/
    │   └── style.css
    ├── js/
    │   └── script.js
    └── uploads/
        ├── avatars/
        ├── groups/
        ├── pulses/
        └── files/
```

---

## Production Deployment

For production, use **gunicorn** with **eventlet**:

```bash
pip install gunicorn eventlet
gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 app:app
```

Set a strong `SECRET_KEY`:
```bash
export SECRET_KEY="your-very-long-random-secret-key-here"
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `echox-super-secret-key-change-in-prod` | Flask session secret |
| `DATABASE_URL` | `postgresql://echox_user:echox_pass@localhost/echox_db` | PostgreSQL connection string |

---

## Pages

| Route | Description |
|---|---|
| `/` | Redirects to login or dashboard |
| `/login` | Sign in page |
| `/signup` | Create account page |
| `/dashboard` | User dashboard |
| `/chat` | Real-time chat |
| `/groups` | Group chats |
| `/pulse` | Pulse (status) feed |
| `/delete-account` | Secure account deletion |
| `/logout` | Logout and clear session |
