"""
PostgreSQL Database Connection Manager for Sambast
Provides connection pooling and Dictionary Cursor support for Flask app
"""

import logging
import os
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from flask import g

# Connection pool instance (will be initialized on first use)
_connection_pool = None
logger = logging.getLogger(__name__)


def _format_psycopg2_error(exc):
    details = []
    pgcode = getattr(exc, 'pgcode', None)
    if pgcode:
        details.append(f'pgcode={pgcode}')

    diag = getattr(exc, 'diag', None)
    if diag is not None:
        for attribute, label in (
            ('schema_name', 'schema'),
            ('table_name', 'table'),
            ('column_name', 'column'),
            ('constraint_name', 'constraint'),
        ):
            value = getattr(diag, attribute, None)
            if value:
                details.append(f'{label}={value}')

        message_primary = getattr(diag, 'message_primary', None)
        if message_primary:
            details.append(message_primary)

    pgerror = getattr(exc, 'pgerror', None)
    if pgerror:
        cleaned_error = pgerror.strip()
        if cleaned_error and cleaned_error not in details:
            details.append(cleaned_error)

    return '; '.join(details) if details else str(exc)


def _raise_logged_psycopg2_error(exc, query=None):
    details = _format_psycopg2_error(exc)
    if query is not None:
        query_preview = ' '.join(str(query).split())
        logger.exception('PostgreSQL query failed: %s | query=%s', details, query_preview)
    else:
        logger.exception('PostgreSQL operation failed: %s', details)
    raise RuntimeError(f'PostgreSQL error: {details}') from exc


class DbConnectionAdapter:
    """Adapter to keep sqlite-like db.execute(...) behavior for existing app code."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, query, params=None):
        cur = self._conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(query, params or ())
            return cur
        except psycopg2.Error as exc:
            self._conn.rollback()
            try:
                cur.close()
            except Exception:
                pass
            _raise_logged_psycopg2_error(exc, query)

    def cursor(self):
        # Keep default cursor behavior for migration/admin code that uses index access.
        return self._conn.cursor()

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        # No-op here; pool handles connection lifecycle.
        return None

    def __getattr__(self, item):
        return getattr(self._conn, item)

def get_connection_pool():
    """Get or create the PostgreSQL connection pool"""
    global _connection_pool
    
    if _connection_pool is None:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise RuntimeError(
                'DATABASE_URL environment variable not set. '
                'Please configure your Supabase PostgreSQL connection string.'
            )
        
        # Create a connection pool
        _connection_pool = psycopg2.pool.SimpleConnectionPool(
            1,  # minimum connections
            20,  # maximum connections
            database_url,
            connect_timeout=5
        )
    
    return _connection_pool

def get_db_connection():
    """Get a connection from the pool"""
    pool = get_connection_pool()
    return pool.getconn()

def return_db_connection(conn):
    """Return a connection to the pool"""
    pool = get_connection_pool()
    pool.putconn(conn)

def get_db():
    """
    Get a database connection for Flask request context.
    Returns a connection with RealDictCursor enabled.
    """
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = DbConnectionAdapter(get_db_connection())
    
    return db

def close_db(e=None):
    """Close the database connection for Flask request context"""
    db = getattr(g, '_database', None)
    if db is not None:
        return_db_connection(db._conn)
        g._database = None

def execute_query(query, params=None):
    """
    Execute a query and return results as dictionaries.
    Useful for one-off queries outside of Flask context.
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            try:
                cur.execute(query, params or ())
            except psycopg2.Error as exc:
                conn.rollback()
                _raise_logged_psycopg2_error(exc, query)
            return cur.fetchall()
    finally:
        return_db_connection(conn)

def execute_query_single(query, params=None):
    """
    Execute a query and return a single result as a dictionary.
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            try:
                cur.execute(query, params or ())
            except psycopg2.Error as exc:
                conn.rollback()
                _raise_logged_psycopg2_error(exc, query)
            return cur.fetchone()
    finally:
        return_db_connection(conn)

def execute_update(query, params=None):
    """
    Execute an INSERT, UPDATE, or DELETE query.
    Returns the number of affected rows.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            try:
                cur.execute(query, params or ())
            except psycopg2.Error as exc:
                conn.rollback()
                _raise_logged_psycopg2_error(exc, query)
            conn.commit()
            return cur.rowcount
    except Exception:
        if conn.status != psycopg2.extensions.STATUS_READY:
            conn.rollback()
        raise
    finally:
        return_db_connection(conn)
