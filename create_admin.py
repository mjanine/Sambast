import sqlite3

conn = sqlite3.connect('database.db')
db = conn.cursor()

print("Force-syncing system tables...")

# 1. Drop the old tables to start fresh
db.execute('DROP TABLE IF EXISTS audit_logs')
db.execute('DROP TABLE IF EXISTS admin')

# 2. Create Admin Table with all necessary columns
db.execute('''
    CREATE TABLE admin (
        admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        full_name TEXT,
        profile_picture TEXT DEFAULT 'default_admin.png'
    )
''')

# 3. Create Audit Logs Table
db.execute('''
    CREATE TABLE audit_logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        action TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES admin(admin_id)
    )
''')

# 4. Insert your login credentials
db.execute('''
    INSERT INTO admin (username, password, email, full_name) 
    VALUES (?, ?, ?, ?)
''', ('admin', 'password123', 'admin@example.com', 'System Admin'))

conn.commit()
conn.close()
print("--- 💥 SUCCESS: System tables recreated! 💥 ---")
print("Login: admin / Password: password123")