import sqlite3
import random
from datetime import datetime, timedelta

def seed_analytics():
    conn = sqlite3.connect('database.db')
    db = conn.cursor()

    print("🌱 Starting Analytics Seed (2 Months of Data)...")

    # 1. Fetch all available products to sell
    db.execute("SELECT product_id, price FROM products")
    products = db.fetchall()
    
    if not products:
        print("❌ Error: No products found! Please run 'python seed.py' first.")
        return

    # 2. Create some fake customers (Removed full_name to match your database)
    fake_users = [
        ('Juan Dela Cruz', 'juan@test.com', '09123456789'),
        ('Maria Clara', 'maria@test.com', '09987654321'),
        ('Jose Rizal', 'jose@test.com', '09111111111'),
        ('Andres Bonifacio', 'andres@test.com', '09222222222'),
        ('Gabriela Silang', 'gaby@test.com', '09333333333')
    ]
    
    user_ids = []
    for name, email, phone in fake_users:
        db.execute('''
            INSERT INTO users (name, email, contact_no) 
            VALUES (?, ?, ?)
        ''', (name, email, phone))
        user_ids.append(db.lastrowid)

    # 3. Time Travel: Generate 60 days of orders
    start_date = datetime.now() - timedelta(days=60)
    total_orders_created = 0

    for day_offset in range(60):
        # Current simulated day
        current_date = start_date + timedelta(days=day_offset)
        
        # Randomize how many orders happened on this day (between 2 and 15)
        # Weekends (day 5 & 6) can be busier!
        is_weekend = current_date.weekday() >= 5
        daily_order_volume = random.randint(10, 25) if is_weekend else random.randint(2, 10)

        for _ in range(daily_order_volume):
            user_id = random.choice(user_ids)
            order_no = f"ORD-{current_date.strftime('%y%m%d')}-{random.randint(1000, 9999)}"
            
            # Mix up the statuses, but mostly completed for analytics
            status = random.choices(
                ['Completed', 'Pending', 'Processing', 'Cancelled'], 
                weights=[70, 10, 10, 10]
            )[0]

            # Pick 1 to 4 random products for this order
            num_items = random.randint(1, 4)
            chosen_products = random.sample(products, num_items)
            
            total_amount = 0
            order_items_data = []

            for product_id, base_price in chosen_products:
                qty = random.randint(1, 3)
                line_total = base_price * qty
                total_amount += line_total
                
                # Format: product_id, quantity, price_at_time, base_price_at_time
                order_items_data.append((product_id, qty, base_price, base_price))

            # Add a slight chance of a discount (10% off) for realism
            discount = 0
            if random.random() > 0.8: # 20% chance of discount
                discount = total_amount * 0.10
            
            final_total = total_amount - discount

            # Generate random time during that specific day
            random_hour = random.randint(8, 20)
            random_minute = random.randint(0, 59)
            created_at = current_date.replace(hour=random_hour, minute=random_minute, second=0).strftime('%Y-%m-%d %H:%M:%S')

            # Insert Order
            db.execute('''
                INSERT INTO orders (order_no, user_id, total_price, status, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (order_no, user_id, final_total, status, created_at))
            order_id = db.lastrowid

            # Insert Order Items
            for item in order_items_data:
                db.execute('''
                    INSERT INTO order_items (order_id, product_id, quantity, price_at_time, base_price_at_time)
                    VALUES (?, ?, ?, ?, ?)
                ''', (order_id, item[0], item[1], item[2], item[3]))
            
            total_orders_created += 1

    conn.commit()
    conn.close()
    
    print("✅ SUCCESS!")
    print(f"📦 Created {total_orders_created} mock orders across the last 60 days.")
    print("📊 Your Admin Analytics dashboard should now look beautiful and full of data!")

if __name__ == "__main__":
    seed_analytics()