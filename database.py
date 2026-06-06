import sqlite3
import os
import uuid
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "sentinel.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create Users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL
    )
    ''')
    
    # Create Chat Sessions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    ''')
    
    # Create Messages table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        extra_data TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES chat_sessions(id)
    )
    ''')
    
    conn.commit()
    conn.close()

def get_or_create_user(username: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    
    if row:
        user_id = row[0]
    else:
        user_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)", 
                       (user_id, username, datetime.utcnow().isoformat()))
        conn.commit()
        
    conn.close()
    return user_id

def create_chat_session(user_id: str, title: str, mode: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    session_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO chat_sessions (id, user_id, title, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, user_id, title, mode, now, now)
    )
    conn.commit()
    conn.close()
    return session_id

def save_message(session_id: str, role: str, content: str, message_type: str = "text", extra_data: dict = None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    msg_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    extra_str = json.dumps(extra_data) if extra_data else None
    
    cursor.execute(
        "INSERT INTO messages (id, session_id, role, content, message_type, extra_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (msg_id, session_id, role, content, message_type, extra_str, now)
    )
    
    # Update session updated_at
    cursor.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, session_id))
    
    conn.commit()
    conn.close()
    return msg_id

def get_user_chat_sessions(user_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_chat_messages(session_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]
