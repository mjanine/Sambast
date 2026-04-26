import csv
import sqlite3

# 1. Connect to your database
conn = sqlite3.connect('database.db')
db = conn.cursor()

print("Synchronizing schema and linking product photos...")

# 2. RE-CREATE TABLE: Clean slate with all columns required by app.py
db.execute('DROP TABLE IF EXISTS products')
db.execute('''
    CREATE TABLE products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        image TEXT DEFAULT 'default.png',
        image_filename TEXT DEFAULT 'default.png',
        category TEXT DEFAULT 'Feeds',
        stock_status TEXT DEFAULT 'In Stock',
        purpose TEXT,
        target_species TEXT,
        tags TEXT,
        unit TEXT DEFAULT 'kg',
        is_archived INTEGER DEFAULT 0,
        archived_at TEXT,
        unit_options_json TEXT
    )
''')

# 3. Open and Read the CSV
try:
    with open('sambast_inventory_list_v2.csv', 'r') as file:
        csv_reader = csv.DictReader(file)
        
        count = 0
        for row in csv_reader:
            # Logic: Pull filename from CSV, then add the folder path
            # This ensures the HTML finds them in static/products/
            raw_photo = row.get('Photo') if row.get('Photo') else 'default.png'
            photo_path = f"products/{raw_photo}"

            db.execute('''
                INSERT INTO products (
                    name, 
                    description, 
                    price, 
                    image, 
                    image_filename, 
                    category
                ) 
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                row['Product'],            # Column A
                row['Description'],        # Column B
                row['Price per kg (PHP)'], # Column C
                photo_path,                # Results in 'products/filename.png'
                photo_path,                # Results in 'products/filename.png'
                'Feeds'                    # Default Category
            ))
            count += 1

    conn.commit()
    print(f"--- 💥 SUCCESS: {count} products reloaded 💥 ---")
    print(f"--- 📁 Photos linked to: static/products/ ---")

except FileNotFoundError:
    print("Error: 'sambast_inventory_list_v2.csv' not found.")
except KeyError as e:
    print(f"Error: Could not find column {e} in your CSV. Please check headers!")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
finally:
    conn.close()