import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

cur.execute('SELECT name, image_filename FROM products LIMIT 10')
rows = cur.fetchall()

print("\n--- Product Image Filenames (First 10) ---")
for name, image in rows:
    status = "✓" if image else "✗"
    print(f"{status} {name[:30]:30} | {image}")

# Check how many products have image_filename populated
cur.execute('SELECT COUNT(*) as total, COUNT(image_filename) as with_images FROM products')
total, with_images = cur.fetchone()
print(f"\n--- Summary ---")
print(f"Total products: {total}")
print(f"Products with images: {with_images}")
print(f"Missing images: {total - with_images}")

conn.close()
