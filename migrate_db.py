import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError(
        'DATABASE_URL environment variable not set. '
        'Please configure your Supabase PostgreSQL connection string.'
    )

def run_migration():
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    try:
        # For PostgreSQL, foreign keys are enabled by default.
        
        # Add columns to products table
        columns_to_add = [
            ("purpose", "TEXT"),
            ("target_species", "TEXT"),
            ("tags", "TEXT")
        ]

        for col_name, col_type in columns_to_add:
            try:
                cursor.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_type};")
                print(f"Added column {col_name} to products.")
            except psycopg2.Error as e:
                if "already exists" in str(e).lower():
                    print(f"Column {col_name} already exists in products.")
                else:
                    print(f"Error adding {col_name}: {e}")

        # Create pets table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                name TEXT,
                species TEXT,
                breed TEXT,
                age_months INTEGER,
                weight_kg REAL,
                lifestyle_classification TEXT DEFAULT 'Unclassified',
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')
        print("Checked/Created pets table.")

        conn.commit()

    except Exception as e:
        print(f"Migration error: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    run_migration()
    print("Migration successful.")
