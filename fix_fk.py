import os

import psycopg2
from dotenv import load_dotenv


load_dotenv()


def _table_exists(cursor, table_name):
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        )
        """,
        (table_name,),
    )
    return bool(cursor.fetchone()[0])


def _column_exists(cursor, table_name, column_name):
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
              AND column_name = %s
        )
        """,
        (table_name, column_name),
    )
    return bool(cursor.fetchone()[0])


def _get_fk_name(cursor):
    cursor.execute(
        """
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'pets'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'user_id'
          AND ccu.table_name = 'users'
          AND ccu.column_name = 'user_id'
        LIMIT 1
        """
    )
    row = cursor.fetchone()
    return row[0] if row else None


def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable not set. "
            "Please configure your Supabase PostgreSQL connection string."
        )

    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    try:
        if not _table_exists(cursor, "pets"):
            raise RuntimeError("Table 'pets' does not exist. Nothing to repair.")

        if not _table_exists(cursor, "users"):
            raise RuntimeError("Table 'users' does not exist. Cannot create foreign key.")

        if not _column_exists(cursor, "users", "user_id"):
            raise RuntimeError("Table 'users' is missing expected 'user_id' column.")

        if not _column_exists(cursor, "pets", "user_id"):
            raise RuntimeError("Table 'pets' is missing expected 'user_id' column.")

        existing_fk = _get_fk_name(cursor)
        if existing_fk:
            print(f"Foreign key already exists: {existing_fk}")
            conn.commit()
            return

        # If orphaned pet rows exist, nullify user_id so FK creation succeeds.
        cursor.execute(
            """
            UPDATE pets p
            SET user_id = NULL
            WHERE p.user_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM users u
                  WHERE u.user_id = p.user_id
              )
            """
        )
        orphan_rows_fixed = cursor.rowcount

        cursor.execute(
            """
            ALTER TABLE pets
            ADD CONSTRAINT pets_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES users(user_id)
            """
        )

        conn.commit()
        print(
            "pets foreign key repair complete. "
            f"Orphan rows fixed: {orphan_rows_fixed}. Constraint: pets_user_id_fkey"
        )

    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
