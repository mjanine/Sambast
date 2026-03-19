import sqlite3
import os
from flask import Flask, render_template, g

app = Flask(__name__)
app.secret_key = 'dev_key_for_session_management' 
DATABASE = 'database.db'

# --- DATABASE UTILITIES ---

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        # CRITICAL: This line enables Foreign Key enforcement in SQLite
        db.execute("PRAGMA foreign_keys = ON")
        db.row_factory = sqlite3.Row  
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    """Creates the 6 core tables required for the project."""
    with app.app_context():
        db = get_db()
        cursor = db.cursor()

        # 1. Users
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT,
                otp_code TEXT,
                pin_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 2. Products
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                product_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT,
                price REAL NOT NULL,
                stock_status INTEGER DEFAULT 1,
                image_filename TEXT,
                description TEXT
            )
        ''')

        # 3. Orders
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                order_id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_no TEXT UNIQUE NOT NULL,
                user_id INTEGER,
                total_price REAL,
                status TEXT DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        ''')

        # 4. Order Items
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS order_items (
                item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                product_id INTEGER,
                quantity INTEGER,
                price_at_time REAL,
                FOREIGN KEY (order_id) REFERENCES orders (order_id),
                FOREIGN KEY (product_id) REFERENCES products (product_id)
            )
        ''')

        # 5. Admin (Adjusted to include username for "REY")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS admin (
                admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT NOT NULL
            )
        ''')

        # 6. Audit Logs
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER,
                action_text TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admin (admin_id)
            )
        ''')

        # Seed initial dummy products
        cursor.execute("SELECT COUNT(*) FROM products")
        if cursor.fetchone()[0] == 0:
            cursor.executemany(
                "INSERT INTO products (name, category, price) VALUES (?, ?, ?)",
                [('Item 1', 'Category A', 100.0), ('Item 2', 'Category B', 250.0)]
            )

        db.commit()
        print("Database initialized with 6 tables.")

# --- ROUTES ---

@app.route('/')
def home():
    return render_template('user/index.html')

@app.route('/admin')
def admin_home():
    # CHANGED: Matches your specific filename
    return render_template('admin/adminlogin.html')

if __name__ == '__main__':
    # Initialize the DB if it doesn't exist
    if not os.path.exists(DATABASE):
        init_db()
    app.run(debug=True)