import sqlite3
from werkzeug.security import generate_password_hash

def seed_complete_data():
    db = sqlite3.connect('database.db')
    cursor = db.cursor()

    print("Cleaning up and seeding Rey + Test Sales...")
    
    # 1. Clear everything for a fresh start
    cursor.execute("DELETE FROM order_items")
    cursor.execute("DELETE FROM orders")
    cursor.execute("DELETE FROM products")
    cursor.execute("DELETE FROM users")
    cursor.execute("DELETE FROM admin")
    cursor.execute("DELETE FROM audit_logs")

    # 2. Seed Rey (Admin)
    hashed_pw = generate_password_hash("12345")
    cursor.execute('''
        INSERT INTO admin (username, email, password_hash) 
        VALUES (?, ?, ?)
    ''', ("rey", "admin@sambast.com", hashed_pw))

    # 3. Seed Products
    products = [
        ('Premium Dog Food', 'Food', 1200.00, 10, 'logo.png', 'High protein'),
        ('Cat Litter 5kg', 'Supplies', 450.00, 3, 'logo.png', 'Clumping'),
        ('Bird Seed Mix', 'Food', 150.00, 20, 'logo.png', 'Mixed seeds')
    ]
    cursor.executemany('''INSERT INTO products (name, category, price, stock_status, image_filename, description) 
                          VALUES (?, ?, ?, ?, ?, ?)''', products)

    # 4. Seed a Test User
    cursor.execute("INSERT INTO users (email, name) VALUES (?, ?)", ("test@user.com", "Test Buyer"))
    user_id = cursor.lastrowid

    # 5. Seed Orders (This is what makes the ₱2,100 show up!)
    # Order 1: Dog Food (1200)
    cursor.execute("INSERT INTO orders (order_no, user_id, total_price, status) VALUES (?, ?, ?, ?)", 
                   ("ORD-001", user_id, 1200.00, "Completed"))
    order1_id = cursor.lastrowid
    cursor.execute("INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)", 
                   (order1_id, 1, 1, 1200.00))

    # Order 2: Cat Litter (900)
    cursor.execute("INSERT INTO orders (order_no, user_id, total_price, status) VALUES (?, ?, ?, ?)", 
                   ("ORD-002", user_id, 900.00, "Completed"))
    order2_id = cursor.lastrowid
    cursor.execute("INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)", 
                   (order2_id, 2, 2, 450.00))

    db.commit()
    db.close()
    print("Success! Login with rey/12345 to see your ₱2,100 revenue.")

if __name__ == "__main__":
    seed_complete_data()
