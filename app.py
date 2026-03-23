import sqlite3
import os
from flask import Flask, render_template, g, request, session, redirect, url_for, flash
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

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
            email TEXT UNIQUE NOT NULL, 
            name TEXT, 
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

# --- ROUTES ---

@app.route('/')
def home():
    return render_template('user/index.html')

# --- ADMIN LOGIN & DASHBOARD ---
@app.route('/admin', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        user_input = request.form.get('username') 
        pass_input = request.form.get('password')
        db = get_db()
        admin = db.execute('SELECT * FROM admin WHERE username = ?', (user_input,)).fetchone()
        
        if admin and check_password_hash(admin['password_hash'], pass_input):
            session.clear()
            session['admin_id'] = admin['admin_id']
            session['admin_user'] = admin['username']
            return redirect(url_for('admin_dashboard'))
        
        flash("Invalid Username or Password")
    return render_template('admin/adminlogin.html')

@app.route('/admin/dashboard')
def admin_dashboard():
    if 'admin_id' not in session: return redirect(url_for('admin_login'))
    return render_template('admin/analytics.html')

# --- ORDER MANAGEMENT ---

@app.route('/admin/orders')
def admin_orders():
    if 'admin_id' not in session: return redirect(url_for('admin_login'))
    status_filter = request.args.get('status')
    db = get_db()
    if status_filter:
        orders = db.execute('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC', (status_filter,)).fetchall()
    else:
        orders = db.execute('SELECT * FROM orders ORDER BY created_at DESC').fetchall()
    return render_template('admin/orders.html', orders=orders, active_filter=status_filter)

@app.route('/admin/orders/<int:order_id>/status', methods=['POST'])
def update_order_status(order_id):
    if 'admin_id' not in session: return redirect(url_for('admin_login'))
    new_status = request.form.get('status')
    db = get_db()
    db.execute('UPDATE orders SET status = ? WHERE order_id = ?', (new_status, order_id))
    db.execute('INSERT INTO audit_logs (admin_id, action_text) VALUES (?, ?)', 
               (session['admin_id'], f"Moved Order #{order_id} to {new_status}"))
    db.commit()
    return redirect(url_for('admin_orders', status=new_status))

@app.route('/admin/orders/<int:order_id>/cancel', methods=['POST'])
def cancel_order(order_id):
    if 'admin_id' not in session: return redirect(url_for('admin_login'))
    db = get_db()
    db.execute('UPDATE orders SET status = "Cancelled" WHERE order_id = ?', (order_id,))
    db.execute('INSERT INTO audit_logs (admin_id, action_text) VALUES (?, ?)', 
               (session['admin_id'], f"Cancelled Order #{order_id}"))
    db.commit()
    return redirect(url_for('admin_orders'))

# --- INVENTORY MANAGEMENT (CRUD) ---

@app.route('/admin/inventory')
def admin_inventory():
    if 'admin_id' not in session: return redirect(url_for('admin_login'))
    db = get_db()
    products = db.execute('SELECT * FROM products ORDER BY name ASC').fetchall()
    return render_template('admin/inventory.html', products=products)

@app.route('/admin/products/add', methods=['POST'])
def add_product():
    if 'admin_id' not in session: return redirect(url_for('admin_login'))
    
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
    if 'admin_id' not in session: return redirect(url_for('admin_login'))
    
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
    if 'admin_id' not in session: return redirect(url_for('admin_login'))
    db = get_db()
    db.execute('DELETE FROM products WHERE product_id = ?', (product_id,))
    db.execute('INSERT INTO audit_logs (admin_id, action_text) VALUES (?, ?)', 
               (session['admin_id'], f"Deleted product ID: {product_id}"))
    db.commit()
    return redirect(url_for('admin_inventory'))

# --- AUTH FLOWS ---

@app.route('/admin/logout')
def admin_logout():
    session.clear()
    return redirect(url_for('admin_login'))

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
        return redirect(url_for('admin_login'))
    return render_template('admin/createpass.html')

@app.route('/admin/audit')
def admin_audit():
    # Security check: Make sure only logged-in admins can see this
    if 'admin_id' not in session:
        return redirect(url_for('admin_login'))
        
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
        return redirect(url_for('admin_login'))
    
    db = get_db()
    admin = db.execute('SELECT * FROM admin WHERE admin_id = ?', (session['admin_id'],)).fetchone()
    return render_template('admin/profile.html', admin=admin)

if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        init_db()
    app.run(debug=True)