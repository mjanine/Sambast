import os

import psycopg2
from dotenv import load_dotenv


load_dotenv()


def print_table_schema(cursor, table_name):
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
    if not cursor.fetchone()[0]:
        print(f"\nTable: {table_name}\n<not found>")
        return

    print(f"\nTable: {table_name}")

    cursor.execute(
        """
        SELECT
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = %s
        ORDER BY c.ordinal_position
        """,
        (table_name,),
    )
    columns = cursor.fetchall()

    print("Columns:")
    for column_name, data_type, is_nullable, column_default in columns:
        nullable_text = "NULL" if is_nullable == "YES" else "NOT NULL"
        default_text = f" DEFAULT {column_default}" if column_default else ""
        print(f"  - {column_name} {data_type} {nullable_text}{default_text}")

    cursor.execute(
        """
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = %s
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
        """,
        (table_name,),
    )
    pk_columns = [row[0] for row in cursor.fetchall()]
    print(f"Primary key: {', '.join(pk_columns) if pk_columns else '<none>'}")

    cursor.execute(
        """
        SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = %s
          AND tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.constraint_name
        """,
        (table_name,),
    )
    fk_rows = cursor.fetchall()

    print("Foreign keys:")
    if not fk_rows:
        print("  - <none>")
    else:
        for constraint_name, column_name, referenced_table, referenced_column in fk_rows:
            print(
                f"  - {constraint_name}: {column_name} -> "
                f"{referenced_table}.{referenced_column}"
            )


def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable not set. "
            "Please configure your Supabase PostgreSQL connection string."
        )

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cursor:
            for table_name in ("users", "pets"):
                print_table_schema(cursor, table_name)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
