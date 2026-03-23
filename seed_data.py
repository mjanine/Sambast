import sqlite3
from werkzeug.security import generate_password_hash

def seed_test_data():
    db = sqlite3.connect('database.db')
    cursor = db.cursor()

    # 1. Clean up old test data so it doesn't conflict
    cursor.execute("DELETE FROM order_items")
    cursor.execute("DELETE FROM orders")
    cursor.execute("DELETE FROM products")
    cursor.execute("DELETE FROM users WHERE email = 'test@user.com'")

    # 2. Add some products
    products = [
        ('Premium Dog Food', 'Food', 1200.00, 10, 'logo.png', 'High protein dog food'),
        ('Cat Litter 5kg', 'Supplies', 450.00, 3, 'logo.png', 'Clumping cat litter'),
        ('Bird Seed Mix', 'Food', 150.00, 20, 'logo.png', 'Mixed seeds for birds')
    ]
    cursor.executemany('''INSERT INTO products (name, category, price, stock_status, image_filename, description) 
                          VALUES (?, ?, ?, ?, ?, ?)''', products)

    # 3. Add the test user
    cursor.execute("INSERT INTO users (email, name) VALUES (?, ?)", ("test@user.com", "Test Buyer"))
    user_id = cursor.lastrowid

    # 4. Add 2 Completed Orders
    cursor.execute("INSERT INTO orders (order_no, user_id, total_price, status) VALUES (?, ?, ?, ?)", 
                   ("ORD-001", user_id, 1200.00, "Completed"))
    order1_id = cursor.lastrowid
    cursor.execute("INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)", 
                   (order1_id, 1, 1, 1200.00))

    cursor.execute("INSERT INTO orders (order_no, user_id, total_price, status) VALUES (?, ?, ?, ?)", 
                   ("ORD-002", user_id, 900.00, "Completed"))
    order2_id = cursor.lastrowid
    cursor.execute("INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)", 
                   (order2_id, 2, 2, 450.00))

    db.commit()
    db.close()
    print("Success! Test data injected.")

if __name__ == "__main__":
    seed_test_data()