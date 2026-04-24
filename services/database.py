import sqlite3


class Database:
    def __init__(self, config=None, db_path=None):
        self._db_path = None
        if config is not None or db_path is not None:
            self.init(config, db_path)
    
    def init(self, config=None, db_path=None):
        if db_path is not None:
            self._db_path = db_path
        elif config is not None:
            if isinstance(config, str):
                self._db_path = config
            else:
                self._db_path = config.db_path
        else:
            raise ValueError("必须提供 config 或 db_path 参数")
    
    def get_db(self):
        if self._db_path is None:
            raise ValueError("数据库路径未设置，请先调用 init() 函数")
        
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        
        def create_tables():
            conn.execute('''CREATE TABLE IF NOT EXISTS subjects
                         (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
            conn.execute('''CREATE TABLE IF NOT EXISTS questions
            (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL, question_type TEXT NOT NULL, content TEXT NOT NULL, options TEXT, correct_answer TEXT NOT NULL, explanation TEXT,
            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE)''')
            conn.execute('''CREATE TABLE IF NOT EXISTS users
                         (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
            conn.execute('''CREATE TABLE IF NOT EXISTS exam_records
            (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, subject_id INTEGER NOT NULL, question_id INTEGER NOT NULL, user_answer TEXT, is_correct INTEGER, exam_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE, FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE)''')
            conn.execute('''CREATE TABLE IF NOT EXISTS exam_sessions
            (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, subject_id INTEGER NOT NULL, subject_name TEXT NOT NULL, exam_mode TEXT NOT NULL, total_questions INTEGER NOT NULL, question_ids TEXT, answered_count INTEGER DEFAULT 0, correct_count INTEGER DEFAULT 0, start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, end_time TIMESTAMP, current_page INTEGER DEFAULT 1, status TEXT DEFAULT 'in_progress',
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE)''')
            try:
                conn.execute('ALTER TABLE exam_sessions ADD COLUMN question_ids TEXT')
            except sqlite3.OperationalError:
                pass
            try:
                conn.execute('ALTER TABLE exam_sessions ADD COLUMN current_page INTEGER DEFAULT 1')
            except sqlite3.OperationalError:
                pass
            conn.execute('''CREATE TABLE IF NOT EXISTS exam_session_details
            (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, question_id INTEGER NOT NULL, user_answer TEXT, is_correct INTEGER, submit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE, FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE)''')
        
        create_tables()
        return conn