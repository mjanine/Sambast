import sqlite3
import os
from flask import Flask, render_template, g, request, session, redirect, url_for, flash, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import google.generativeai as genai

# --- AI SETUP ---
load_dotenv() # Loads the .env file

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    # If this triggers, check that your .env file is named correctly and in the right folder!
    print("WARNING: No GEMINI_API_KEY found in .env file. AI features will fail.")
else:
    genai.configure(api_key=api_key)
    # We define the model here so we can use it throughout the app
    ai_model = genai.GenerativeModel('gemini-2.5-flash') 

# --- FLASK SETUP ---
app = Flask(__name__)
app.secret_key = 'dev_key_for_session_management' 
DATABASE = 'database.db'

# --- CONFIGURATION: IMAGE UPLOADS ---
UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Ensure the upload directory exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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
    """Initializes tables and seeds test data for Sambast Admin."""
    with app.app_context():
        db = get_db()
        cursor = db.cursor()

        # Core Tables
        cursor.execute('''CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT, 
            email TEXT UNIQUE, 
            name TEXT, 
            contact_no TEXT UNIQUE NOT NULL,
            otp_code TEXT, 
            pin_hash TEXT, 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS products (
            product_id INTEGER PRIMARY KEY AUTOINCREMENT, 
            name TEXT NOT NULL, 
            category TEXT, 
            price REAL NOT NULL, 
            stock_status INTEGER DEFAULT 1, 
            image_filename TEXT, 
            description TEXT)''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS orders (
            order_id INTEGER PRIMARY KEY AUTOINCREMENT, 
            order_no TEXT UNIQUE NOT NULL, 
            user_id INTEGER, 
            total_price REAL, 
            status TEXT DEFAULT "Pending", 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
            FOREIGN KEY (user_id) REFERENCES users (user_id))''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS order_items (
            item_id INTEGER PRIMARY KEY AUTOINCREMENT, 
            order_id INTEGER, 
            product_id INTEGER, 
            quantity INTEGER, 
            price_at_time REAL, 
            FOREIGN KEY (order_id) REFERENCES orders (order_id), 
            FOREIGN KEY (product_id) REFERENCES products (product_id))''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS admin (
            admin_id INTEGER PRIMARY KEY AUTOINCREMENT, 
            username TEXT UNIQUE NOT NULL, 
            email TEXT UNIQUE, 
            password_hash TEXT NOT NULL)''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS audit_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT, 
            admin_id INTEGER, 
            action_text TEXT NOT NULL, 
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
            FOREIGN KEY (admin_id) REFERENCES admin (admin_id))''')

        # SEED ADMIN: REY / admin123
        cursor.execute("SELECT COUNT(*) FROM admin")
        if cursor.fetchone()[0] == 0:
            hashed_pw = generate_password_hash("admin123")
            cursor.execute("INSERT INTO admin (username, email, password_hash) VALUES (?, ?, ?)", 
                           ("REY", "admin@sambast.com", hashed_pw))

        db.commit()
        print("Database initialized successfully.")

# --- AI CONTEXT HELPERS ---

def get_inventory_context():
    """Fetches all active products to feed to the AI Chatbot."""
    db = get_db()
    try:
        products = db.execute('SELECT name, category, price, description FROM products WHERE stock_status = 1').fetchall()
        if not products:
            return "No products currently available."
        
        context_string = "CURRENT STORE INVENTORY:\n"
        for p in products:
            context_string += f"- {p['name']} (Category: {p['category']}): ₱{p['price']}. Description: {p['description']}\n"
        return context_string
    except Exception as e:
        print(f"Database error in get_inventory_context: {e}")
        return "Inventory data currently unavailable."

def get_top_products_context():
    """Fetches the top 5 most bought items for the AI Recommendation engine."""
    db = get_db()
    try:
        # SQL query to count which product_ids appear most in order_items
        top_items = db.execute('''
            SELECT p.name, COUNT(oi.product_id) as purchase_count
            FROM order_items oi
            JOIN products p ON oi.product_id = p.product_id
            GROUP BY oi.product_id
            ORDER BY purchase_count DESC
            LIMIT 5
        ''').fetchall()
        
        if not top_items:
            return "Not enough sales data yet."
            
        context_string = "TOP SELLING PRODUCTS:\n"
        for item in top_items:
            context_string += f"- {item['name']} (Bought {item['purchase_count']} times)\n"
        return context_string
    except Exception as e:
        print(f"Database error in get_top_products_context: {e}")
        return "Top product data unavailable."

# --- ROUTES ---

@app.route('/')
def home():
    return render_template('user/index.html')

# --- ADMIN LOGIN & DASHBOARD ---
@app.route('/admin', methods=['POST'])
def admin_login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid request. Expected JSON.'}), 400

    user_input = data.get('username')
    pass_input = data.get('password')
    db = get_db()
    admin = db.execute('SELECT * FROM admin WHERE username = ?', (user_input,)).fetchone()
    
    if admin and check_password_hash(admin['password_hash'], pass_input):
        session.clear()
        session['admin_id'] = admin['admin_id']
        session['admin_user'] = admin['username']
        return jsonify({'success': True, 'redirect_url': url_for('admin_analytics')})
    
    return jsonify({'error': 'Invalid Username or Password'}), 401

@app.route('/admin', methods=['GET'])
def admin_login_page():
    return render_template('admin/adminlogin.html')

@app.route('/admin/dashboard')
def admin_analytics(): 
    if 'admin_id' not in session: return redirect(url_for('admin_login_page'))
    return render_template('admin/analytics.html')

# --- ORDER MANAGEMENT ---

@app.route('/admin/orders')
def admin_orders():
    if 'admin_id' not in session: return redirect(url_for('admin_login_page'))
    status_filter = request.args.get('status')
    db = get_db()
    if status_filter:
        orders = db.execute('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC', (status_filter,)).fetchall()
    else:
        orders = db.execute('SELECT * FROM orders ORDER BY created_at DESC').fetchall()
    return render_template('admin/orders.html', orders=orders, active_filter=status_filter)

@app.route('/admin/orders/<int:order_id>/status', methods=['POST'])
def update_order_status(order_id):
    if 'admin_id' not in session: return redirect(url_for('admin_login_page'))
    new_status = request.form.get('status')
    db = get_db()
    db.execute('UPDATE orders SET status = ? WHERE order_id = ?', (new_status, order_id))
    db.execute('INSERT INTO audit_logs (admin_id, action_text) VALUES (?, ?)', 
               (session['admin_id'], f"Moved Order #{order_id} to {new_status}"))
    db.commit()
    return redirect(url_for('admin_orders', status=new_status))

@app.route('/admin/orders/<int:order_id>/cancel', methods=['POST'])
def cancel_order(order_id):
    if 'admin_id' not in session: return redirect(url_for('admin_login_page'))
    db = get_db()
    db.execute('UPDATE orders SET status = "Cancelled" WHERE order_id = ?', (order_id,))
    db.execute('INSERT INTO audit_logs (admin_id, action_text) VALUES (?, ?)', 
               (session['admin_id'], f"Cancelled Order #{order_id}"))
    db.commit()
    return redirect(url_for('admin_orders'))

# --- INVENTORY MANAGEMENT (CRUD) ---

@app.route('/admin/inventory')
def admin_inventory():
    if 'admin_id' not in session: return redirect(url_for('admin_login_page'))
    db = get_db()
    products = db.execute('SELECT * FROM products ORDER BY name ASC').fetchall()
    return render_template('admin/inventory.html', products=products)

@app.route('/admin/products/add', methods=['POST'])
def add_product():
    if 'admin_id' not in session: return redirect(url_for('admin_login_page'))
    
    name = request.form.get('name')
    category = request.form.get('category')
    price = request.form.get('price')
    description = request.form.get('description')
    stock_status = request.form.get('stock_status', 1)
    file = request.files.get('image')

    filename = 'logo.png' # Fallback image
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))

    db = get_db()
    db.execute('''INSERT INTO products (name, category, price, stock_status, image_filename, description) 
                  VALUES (?, ?, ?, ?, ?, ?)''', (name, category, price, stock_status, filename, description))
    db.execute('INSERT INTO audit_logs (admin_id, action_text) VALUES (?, ?)', 
               (session['admin_id'], f"Added product: {name}"))
    db.commit()
    flash(f"Product {name} added!")
    return redirect(url_for('admin_inventory'))

@app.route('/admin/products/edit/<int:product_id>', methods=['POST'])
def edit_product(product_id):
    if 'admin_id' not in session: return redirect(url_for('admin_login_page'))
    
    name = request.form.get('name')
    category = request.form.get('category')
    price = request.form.get('price')
    description = request.form.get('description')
    stock_status = request.form.get('stock_status')
    
    db = get_db()
    
    # Handle Image Update if provided
    file = request.files.get('image')
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        db.execute('UPDATE products SET image_filename = ? WHERE product_id = ?', (filename, product_id))

    db.execute('''UPDATE products SET name=?, category=?, price=?, description=?, stock_status=? 
                  WHERE product_id = ?''', (name, category, price, description, stock_status, product_id))
    db.execute('INSERT INTO audit_logs (admin_id, action_text) VALUES (?, ?)', 
               (session['admin_id'], f"Edited product ID: {product_id}"))
    db.commit()
    return redirect(url_for('admin_inventory'))

@app.route('/admin/products/delete/<int:product_id>', methods=['POST'])
def delete_product(product_id):
    if 'admin_id' not in session: return redirect(url_for('admin_login_page'))
    db = get_db()
    db.execute('DELETE FROM products WHERE product_id = ?', (product_id,))
    db.execute('INSERT INTO audit_logs (admin_id, action_text) VALUES (?, ?)', 
               (session['admin_id'], f"Deleted product ID: {product_id}"))
    db.commit()
    return redirect(url_for('admin_inventory'))

@app.route('/api/admin/inventory-insights', methods=['GET'])
def inventory_insights():
    if 'admin_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    db = get_db()
    try:
        products = db.execute('SELECT name, stock_status FROM products').fetchall()
        inventory_list = ", ".join([f"{p['name']} (Stock: {p['stock_status']})" for p in products])
        
        prompt = f"Current inventory: {inventory_list}. Please return a 1-2 sentence warning identifying any items that need restocking based on low stock."
        
        response = ai_model.generate_content(prompt)
        return jsonify({"insights": response.text.strip()})
    except Exception as e:
        print(f"Inventory insights error: {e}")
        return jsonify({"error": "Failed to generate insights"}), 500

@app.route('/api/admin/business-summary', methods=['GET'])
def business_summary():
    if 'admin_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    db = get_db()
    try:
        result = db.execute("SELECT SUM(total_price) as total FROM orders WHERE status != 'Cancelled'").fetchone()
        total_revenue = result['total'] if result and result['total'] else 0
        
        prompt = f"The store has a total revenue of ₱{total_revenue:,.2f}. Write a short, encouraging 2-sentence executive summary about the store's performance."
        
        response = ai_model.generate_content(prompt)
        return jsonify({"summary": response.text.strip()})
    except Exception as e:
        print(f"Business summary error: {e}")
        return jsonify({"error": "Failed to generate business summary"}), 500

@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    if 'admin_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    db = get_db()
    try:
        # 1. Total Revenue (Completed only)
        rev_res = db.execute("SELECT SUM(total_price) as total FROM orders WHERE status != 'Cancelled'").fetchone()
        revenue = rev_res['total'] if rev_res['total'] else 0

        # 2. Total Orders (All non-cancelled)
        order_res = db.execute("SELECT COUNT(order_id) as count FROM orders WHERE status != 'Cancelled'").fetchone()
        order_count = order_res['count'] if order_res['count'] else 0

        # 3. Average Order Value
        avg_value = revenue / order_count if order_count > 0 else 0

        # 4. Low Stock Count (Items with stock_status 0 or very low)
        # Note: If you used my seed_data, items with 0 stock have stock_status=0
        low_stock_res = db.execute("SELECT name FROM products WHERE stock_status = 0").fetchall()
        low_stock_items = [item['name'] for item in low_stock_res]

        return jsonify({
            "revenue": f"₱{revenue:,.2f}",
            "order_count": order_count,
            "avg_value": f"₱{avg_value:,.2f}",
            "low_stock": low_stock_items
        })
    except Exception as e:
        print(f"Stats Error: {e}")
        return jsonify({"error": "Failed to load stats"}), 500

# --- AUTH FLOWS ---

@app.route('/admin/logout')
def admin_logout():
    session.clear()
    return redirect(url_for('admin_login_page'))

@app.route('/admin/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email')
        db = get_db()
        admin = db.execute('SELECT * FROM admin WHERE email = ?', (email,)).fetchone()
        if admin:
            session['reset_email'] = email
            session['temp_otp'] = "123456" 
            return redirect(url_for('verify_otp'))
        flash("Email not found.")
    return render_template('admin/verifyemail.html')

@app.route('/admin/verify-otp', methods=['GET', 'POST'])
def verify_otp():
    if request.method == 'POST':
        if request.form.get('otp') == session.get('temp_otp'):
            return redirect(url_for('reset_password'))
        flash("Invalid OTP")
    return render_template('admin/verifyemail.html')

@app.route('/admin/reset-password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'POST':
        new_password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        if new_password != confirm_password:
            flash("Passwords do not match!")
            return render_template('admin/createpass.html')
        hashed = generate_password_hash(new_password)
        db = get_db()
        db.execute('UPDATE admin SET password_hash = ? WHERE email = ?', (hashed, session.get('reset_email')))
        db.commit()
        session.pop('temp_otp', None)
        flash("Password reset successful!")
        return redirect(url_for('admin_login_page'))
    return render_template('admin/createpass.html')

@app.route('/admin/audit')
def admin_audit():
    # Security check: Make sure only logged-in admins can see this
    if 'admin_id' not in session:
        return redirect(url_for('admin_login_page'))
        
    db = get_db()
    # Fetch logs and join with admin table to see who did what
    logs = db.execute('''
        SELECT audit_logs.*, admin.username 
        FROM audit_logs 
        LEFT JOIN admin ON audit_logs.admin_id = admin.admin_id 
        ORDER BY timestamp DESC
    ''').fetchall()
    
    return render_template('admin/audit_logs.html', logs=logs)

# Check if this is in your app.py!
@app.route('/admin/profile')
def admin_profile():
    if 'admin_id' not in session:
        return redirect(url_for('admin_login_page'))
    
    db = get_db()
    admin = db.execute('SELECT * FROM admin WHERE admin_id = ?', (session['admin_id'],)).fetchone()
    return render_template('admin/profile.html', admin=admin)

# =============================================================================
# PART 2 — USER REGISTRATION
# Flow: index.html -> /register -> verifycode.html -> /verify-otp -> setpin.html
# =============================================================================

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid request. Expected JSON.'}), 400

    full_name  = data.get('full_name', '').strip()
    contact_no = data.get('contact_no', '').strip()

    if not full_name or not contact_no:
        return jsonify({'error': 'Please fill in all fields.'}), 400

    db = get_db()
    existing = db.execute(
        'SELECT user_id FROM users WHERE contact_no = ?', (contact_no,)
    ).fetchone()
    if existing:
        return jsonify({'error': 'An account with that contact number already exists.'}), 409

    cursor = db.execute(
        'INSERT INTO users (name, contact_no) VALUES (?, ?)',
        (full_name, contact_no)
    )
    db.commit()

    session['pending_user_id'] = cursor.lastrowid
    session['pending_contact']  = contact_no

    #OTP generation and sending logic would go here
    return jsonify({'success': True, 'redirect_url': url_for('set_pin')})


@app.route('/verify-otp', methods=['GET', 'POST'])
def verify_otp_user():
    """
    Placeholder — OTP not implemented yet (Dev A decision).
    Kept so verifycode.html form action can point here without a 404.
    Immediately redirects to set-pin.
    """
    return redirect(url_for('set_pin'))


# =============================================================================
# PART 3 — USER PIN AUTH
# Flow: setpin.html -> /set-pin -> verifypin.html -> /verify-pin -> shophomepage
#        usersignin.html -> /sign-in -> shophomepage
# =============================================================================

@app.route('/set-pin', methods=['GET', 'POST'])
def set_pin():
    # Must have come from registration
    if 'pending_user_id' not in session:
        return redirect(url_for('home'))

    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid request. Expected JSON.'}), 400
        
        pin = data.get('pin', '')

        if len(pin) != 4 or not pin.isdigit():
            return jsonify({'error': 'PIN must be exactly 4 digits.'}), 400

        # Store the PIN in session temporarily; confirmed on verify-pin page
        session['pending_pin_hash'] = generate_password_hash(pin)
        return jsonify({'success': True, 'redirect_url': url_for('verify_pin')})

    return render_template('user/setpin.html')


@app.route('/verify-pin', methods=['GET', 'POST'])
def verify_pin():
    if 'pending_user_id' not in session or 'pending_pin_hash' not in session:
        return redirect(url_for('home'))

    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid request. Expected JSON.'}), 400
            
        confirm_pin = data.get('pin', '')

        if not check_password_hash(session['pending_pin_hash'], confirm_pin):
            return jsonify({'error': 'PINs do not match. Please try again.'}), 400

        # PINs match — save the hash to the DB and open a full session
        db = get_db()
        db.execute(
            'UPDATE users SET pin_hash = ? WHERE user_id = ?',
            (session['pending_pin_hash'], session['pending_user_id'])
        )
        db.commit()

        # Promote from pending session to full user session
        user_id = session.pop('pending_user_id')
        session.pop('pending_pin_hash', None)
        session.pop('pending_contact', None)
        session['user_id'] = user_id

        return jsonify({'success': True, 'redirect_url': url_for('shop_home')})

    return render_template('user/verifypin.html')


@app.route('/sign-in', methods=['POST'])
def sign_in():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid request. Expected JSON.'}), 400
        
    contact_no = data.get('contact_no', '').strip()
    pin        = data.get('pin', '')

    db   = get_db()
    user = db.execute(
        'SELECT * FROM users WHERE contact_no = ?', (contact_no,)
    ).fetchone()

    if not user:
        return jsonify({'error': 'No account found with that contact number.'}), 404

    if not user['pin_hash']:
        return jsonify({'error': 'Account exists, but a PIN has not been set. Please complete registration.'}), 403

    if not check_password_hash(user['pin_hash'], pin):
        return jsonify({'error': 'Incorrect PIN. Please try again.'}), 401

    session['user_id'] = user['user_id']
    return jsonify({'success': True, 'redirect_url': url_for('shop_home')})

@app.route('/sign-in', methods=['GET'])
def sign_in_page():
    return render_template('user/usersignin.html')


@app.route('/sign-out')
def sign_out():
    session.pop('user_id', None)
    return redirect(url_for('sign_in_page'))


# Placeholder shop route — Part 4 will flesh this out
@app.route('/shop')
def shop_home():
    if 'user_id' not in session:
        return redirect(url_for('sign_in_page'))
    return render_template('user/shophomepage.html')


# =============================================================================
# PART 4 — PRODUCTS API (customer view)
# =============================================================================

@app.route('/products')
def get_products():
    if 'user_id' not in session:
        return {'error': 'Unauthorized'}, 401

    db       = get_db()
    category = request.args.get('category', '').strip()
    search   = request.args.get('search', '').strip()

    query  = 'SELECT * FROM products WHERE stock_status = 1'
    params = []

    if category:
        query += ' AND category = ?'
        params.append(category)

    if search:
        query += ' AND name LIKE ?'
        params.append(f'%{search}%')

    query += ' ORDER BY name ASC'

    products = db.execute(query, params).fetchall()

    return [{
        'product_id'     : p['product_id'],
        'name'           : p['name'],
        'category'       : p['category'],
        'price'          : p['price'],
        'description'    : p['description'],
        'image_filename' : p['image_filename'],
        'stock_status'   : p['stock_status']
    } for p in products]


@app.route('/api/recommendations', methods=['POST'])
def api_recommendations():
    if 'ai_model' not in globals():
        return jsonify({'error': 'AI model not configured'}), 500

    data = request.get_json()
    cart_items = data.get('cart_items', []) if data else []
    
    top_products = get_top_products_context()
    
    prompt = f"User cart: {cart_items}. Top sellers: {top_products}. Suggest 2 complementary products. Return ONLY a raw JSON array of strings."
    
    try:
        response = ai_model.generate_content(prompt)
        import json
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
        return jsonify(json.loads(text))
    except Exception as e:
        print(f"AI Recommendation error: {e}")
        return jsonify({"error": "Failed to generate recommendations"}), 500

@app.route('/api/chat', methods=['POST'])
def api_chat():
    if 'ai_model' not in globals():
        return jsonify({'error': 'AI model not configured'}), 500

    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'Invalid request. Expected JSON with a message string.'}), 400

    user_message = data.get('message', '')
    inventory_context = get_inventory_context()
    
    prompt = f"{inventory_context}\n\nUser Message: {user_message}"
    
    try:
        response = ai_model.generate_content(prompt)
        return jsonify({"response": response.text})
    except Exception as e:
        print(f"AI Chat error: {e}")
        return jsonify({"error": "Failed to generate chat response"}), 500


# =============================================================================
# PART 5 — ORDER PLACEMENT
# =============================================================================

import random
import string

def generate_order_no():
    digits = ''.join(random.choices(string.digits, k=8))
    return f'ORD-{digits}'

@app.route('/checkout')
def checkout_page():
    if 'user_id' not in session:
        return redirect(url_for('sign_in_page'))
    return render_template('user/checkout.html')

@app.route('/orders', methods=['POST'])
def place_order():
    if 'user_id' not in session:
        return {'error': 'Unauthorized'}, 401

    data           = request.get_json()
    items          = data.get('items', [])
    payment_method = data.get('payment_method', 'cash')

    if not items:
        return {'error': 'No items in order.'}, 400

    # Calculate total
    total = sum(item['price'] * item['qty'] for item in items)

    # Generate a unique order number
    db       = get_db()
    order_no = generate_order_no()
    while db.execute('SELECT order_id FROM orders WHERE order_no = ?', (order_no,)).fetchone():
        order_no = generate_order_no()

    # Insert the order
    cursor = db.execute(
        'INSERT INTO orders (order_no, user_id, total_price, status) VALUES (?, ?, ?, ?)',
        (order_no, session['user_id'], total, 'Pending')
    )
    
    order_id = cursor.lastrowid

    # Insert each line item
    for item in items:
        db.execute(
            '''INSERT INTO order_items (order_id, product_id, quantity, price_at_time)
               VALUES (?, ?, ?, ?)''',
            (order_id, item['product_id'], item['qty'], item['price'])
        )

    db.commit()

    # Store order_no in session so progress page can poll it
    session['latest_order_no'] = order_no

    return {'success': True, 'order_no': order_no}


# =============================================================================
# PART 6 — ORDER STATUS + HISTORY
# =============================================================================

@app.route('/order-progress')
def order_progress():
    if 'user_id' not in session:
        return redirect(url_for('sign_in_page'))
    
    db = get_db()
    # Fetch user info to display real name/contact on the progress page
    user = db.execute('SELECT name, contact_no FROM users WHERE user_id = ?', 
                      (session['user_id'],)).fetchone()
    
    return render_template('user/myorderprogress.html', user=user)

@app.route('/orders/latest/status')
def latest_order_status():
    if 'user_id' not in session:
        return {'error': 'Unauthorized'}, 401

    db    = get_db()
    order = db.execute(
        '''SELECT order_no, status, total_price 
           FROM orders 
           WHERE user_id = ? AND status NOT IN ('Completed', 'Cancelled')
           ORDER BY created_at DESC 
           LIMIT 1''',
        (session['user_id'],)
    ).fetchone()

    if not order:
        return {'error': 'No active order.'}, 404

    return {
        'order_no'    : order['order_no'],
        'status'      : order['status'],
        'total_price' : order['total_price']
    }

@app.route('/orders/history')
def order_history():
    if 'user_id' not in session:
        return {'error': 'Unauthorized'}, 401

    db = get_db()

    # Get all orders belonging to the logged-in user only
    orders = db.execute(
        '''SELECT o.order_id, o.order_no, o.status, o.total_price, o.created_at
           FROM orders o
           WHERE o.user_id = ?
           ORDER BY o.created_at DESC''',
        (session['user_id'],)
    ).fetchall()

    result = []
    for o in orders:
        items = db.execute(
            '''SELECT oi.quantity, oi.price_at_time, p.name, p.image_filename, p.product_id
               FROM order_items oi
               LEFT JOIN products p ON oi.product_id = p.product_id
               WHERE oi.order_id = ?''',
            (o['order_id'],)
        ).fetchall()

        result.append({
            'order_no'   : o['order_no'],
            'status'     : o['status'],
            'total_price': o['total_price'],
            'created_at' : o['created_at'],
            'items'      : [{
                'product_id'    : i['product_id'],
                'name'          : i['name'],
                'qty'           : i['quantity'],
                'price_at_time' : i['price_at_time'],
                'image_filename': i['image_filename']
            } for i in items]
        })

    return result

@app.route('/history')
def history_page():
    if 'user_id' not in session:
        return redirect(url_for('sign_in_page'))
    return render_template('user/history.html')

@app.route('/profile')
def profile_page():
    if 'user_id' not in session:
        return redirect(url_for('sign_in_page'))
    db = get_db()
    user = db.execute('SELECT name, contact_no FROM users WHERE user_id = ?', (session['user_id'],)).fetchone()
    return render_template('user/profile.html', user=user)

@app.route('/cart')
def cart_page():
    if 'user_id' not in session:
        return redirect(url_for('sign_in_page'))
    return render_template('user/cart.html')


@app.route('/change-pin', methods=['GET', 'POST'])
def change_pin():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid request. Expected JSON.'}), 400

        old_pin = data.get('old_pin', '')
        new_pin = data.get('new_pin', '')
        confirm_pin = data.get('confirm_pin', '')

        if not old_pin or not new_pin or not confirm_pin:
            return jsonify({'error': 'Please fill out all PIN fields.'}), 400

        if new_pin != confirm_pin:
            return jsonify({'error': 'New PINs do not match.'}), 400

        if len(new_pin) != 4 or not new_pin.isdigit():
            return jsonify({'error': 'PIN must be exactly 4 digits.'}), 400

        db = get_db()
        user = db.execute('SELECT pin_hash FROM users WHERE user_id = ?', (session['user_id'],)).fetchone()

        if not user or not check_password_hash(user['pin_hash'], old_pin):
            return jsonify({'error': 'Incorrect old PIN.'}), 401

        pin_hash = generate_password_hash(new_pin)
        db.execute(
            'UPDATE users SET pin_hash = ? WHERE user_id = ?',
            (pin_hash, session['user_id'])
        )
        db.commit()

        return jsonify({'success': True})

    return render_template('user/changepin.html')


if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        init_db()
    app.run(debug=True)