import sqlite3
from contextlib import contextmanager
from . import config

class Database:
    def __init__(self, con):
        self.con = con

    def execute(self, sql, params=()):
        return self.con.execute(sql.replace('?', '%s') if config.DATABASE_URL else sql, params)

    def one(self, sql, params=()):
        row = self.execute(sql, params).fetchone()
        return dict(row) if row else None

    def all(self, sql, params=()):
        return [dict(r) for r in self.execute(sql, params).fetchall()]

@contextmanager
def transaction():
    if config.DATABASE_URL:
        import psycopg
        from psycopg.rows import dict_row
        con = psycopg.connect(config.DATABASE_URL, row_factory=dict_row, connect_timeout=15)
    else:
        con = sqlite3.connect(config.SQLITE_PATH, timeout=30)
        con.row_factory = sqlite3.Row
        con.execute('PRAGMA foreign_keys=ON')
        con.execute('PRAGMA busy_timeout=30000')
        con.execute('BEGIN IMMEDIATE')
    try:
        yield Database(con)
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()

def lock_round(db, round_id):
    return db.one('SELECT * FROM rounds WHERE id=?' + (' FOR UPDATE' if config.DATABASE_URL else ''), (round_id,))
