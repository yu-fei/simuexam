import pytest
import sqlite3
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))



@ pytest.fixture(scope="function")
def db():
    import services.question_service as qs_module
    import tempfile
    
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name
    
    qs_module.db.init(db_path)
    conn = qs_module.db.get_db()
    
    conn.execute("INSERT OR IGNORE INTO users (username) VALUES ('test_user')")
    conn.commit()

    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='questions'")
    assert cursor.fetchone() is not None, "questions table should exist"

    yield conn

    conn.close()
    os.unlink(db_path)
