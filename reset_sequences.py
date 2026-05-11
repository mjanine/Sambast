"""Reset PostgreSQL sequences to match existing table data.

This script is idempotent and safe to run multiple times. It updates each target
sequence to MAX(primary_key) + 1 so subsequent inserts do not collide with
manually migrated rows.
"""

from __future__ import annotations

import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2 import sql


TARGETS = [
    ("orders", "order_id"),
    ("order_items", "item_id"),
    ("audit_logs", "log_id"),
    ("products", "product_id"),
    ("users", "user_id"),
    ("pets", "id"),
]


def reset_sequence(cursor, table_name: str, primary_key: str) -> bool:
    cursor.execute(
        "SELECT pg_get_serial_sequence(%s, %s)",
        (f"public.{table_name}", primary_key),
    )
    sequence_name = cursor.fetchone()[0]
    if not sequence_name:
        print(f"SKIP {table_name}.{primary_key}: no serial/identity sequence found")
        return False

    statement = sql.SQL(
        "SELECT setval(%s, COALESCE((SELECT MAX({primary_key}) FROM {table_name}), 0) + 1, false)"
    ).format(
        primary_key=sql.Identifier(primary_key),
        table_name=sql.SQL("public.") + sql.Identifier(table_name),
    )
    cursor.execute(statement, (sequence_name,))
    next_value = cursor.fetchone()[0]
    print(f"RESET {table_name}.{primary_key}: {sequence_name} -> next value {next_value}")
    return True


def main() -> int:
    load_dotenv(dotenv_path=Path(__file__).with_name(".env"))
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable not set.")

    connection = psycopg2.connect(database_url)
    try:
        connection.autocommit = False
        with connection.cursor() as cursor:
            for table_name, primary_key in TARGETS:
                reset_sequence(cursor, table_name, primary_key)
        connection.commit()
        print("Sequence reset completed successfully.")
        return 0
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
