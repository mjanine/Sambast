import sqlite3

def create_tables():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    print("Building EVERY table for Sambast (Login, Analytics, Audit)...")

    # 1. ADMIN TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin (
            admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')

    # 2. USERS TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            name TEXT
        )
    ''')

    # 3. PRODUCTS TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            product_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            price REAL,
            stock_status INTEGER,
            image_filename TEXT,
            description TEXT
        )
    ''')

    # 4. ORDERS TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            order_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_no TEXT,
            user_id INTEGER,
            total_price REAL,
            status TEXT DEFAULT 'Pending'
        )
    ''')

    # 5. ORDER_ITEMS TABLE (THE MISSING PIECE!)
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

    # 6. AUDIT_LOGS TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_name TEXT,
            action TEXT,
            target TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()
    print("Success! Database skeleton is 100% complete.")

if __name__ == "__main__":
    create_tables()
