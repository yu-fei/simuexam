import pytest
import sqlite3
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))



@ pytest.fixture(scope="function")
def db():
    # 使用命名的内存数据库，每个测试函数使用一个独立的数据库实例
    import services.question_service as qs_module
    import importlib
    import random
    import string
    
    # 生成一个随机的数据库名称
    db_name = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
    db_path = f'file:{db_name}?mode=memory&cache=shared'
    
    # 保存原始的DB_PATH
    original_db_path = qs_module.DB_PATH
    
    # 更新DB_PATH为命名内存数据库
    qs_module.DB_PATH = db_path
    importlib.reload(qs_module)
    
    # 创建数据库连接并初始化表结构
    conn = qs_module.get_db()
    
    # 插入测试数据（使用INSERT OR IGNORE避免用户名重复）
    conn.execute("INSERT OR IGNORE INTO users (username) VALUES ('test_user')")
    conn.commit()

    # 验证表结构是否创建成功
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='questions'")
    assert cursor.fetchone() is not None, "questions table should exist"

    yield conn

    # 恢复原始的DB_PATH
    qs_module.DB_PATH = original_db_path
    
    # 关闭连接
    conn.close()
    
    # 重新加载question_service模块，使其使用原始的DB_PATH
    importlib.reload(qs_module)
