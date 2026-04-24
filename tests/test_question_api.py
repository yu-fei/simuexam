import pytest
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.question_service import (
    get_questions_by_subject,
    get_question_by_id,
    create_question,
    update_question,
    delete_question
)


class TestQuestionAPI:
    def test_create_and_get_question(self, db):
        cursor = db.execute("SELECT COUNT(*) FROM subjects")
        before_count = cursor.fetchone()[0]

        cursor = db.execute("INSERT OR IGNORE INTO subjects (name) VALUES ('测试科目') RETURNING id")
        result = cursor.fetchone()
        if result:
            subject_id = result[0]
        else:
            # 如果科目已存在，获取其ID
            cursor = db.execute("SELECT id FROM subjects WHERE name = '测试科目'")
            subject_id = cursor.fetchone()[0]
        db.commit()

        data = {
            'content': '这是一道测试题',
            'question_type': 'single',
            'options': ['A、选项1', 'B、选项2', 'C、选项3', 'D、选项4'],
            'correct_answer': 'A',
            'explanation': '测试解析'
        }
        question_id = create_question(subject_id, data)
        assert question_id > 0

        question = get_question_by_id(question_id)
        assert question is not None
        assert question['content'] == '这是一道测试题'
        assert question['question_type'] == 'single'
        assert question['correct_answer'] == 'A'

    def test_get_questions_by_subject(self, db):
        cursor = db.execute("SELECT COUNT(*) FROM subjects")
        before_subjects = cursor.fetchone()[0]

        # 使用随机科目名称，确保每次测试都使用新科目
        import random
        import string
        subject_name = '测试科目' + ''.join(random.choices(string.ascii_letters + string.digits, k=5))

        cursor = db.execute("INSERT INTO subjects (name) VALUES (?) RETURNING id", (subject_name,))
        subject_id = cursor.fetchone()[0]
        db.commit()

        data = {
            'content': '题目1',
            'question_type': 'judge',
            'options': ['正确', '错误'],
            'correct_answer': '正确',
            'explanation': ''
        }
        create_question(subject_id, data)

        data['content'] = '题目2'
        create_question(subject_id, data)

        questions = get_questions_by_subject(subject_id)
        assert len(questions) == 2

    def test_update_question(self, db):
        cursor = db.execute("INSERT OR IGNORE INTO subjects (name) VALUES ('测试科目3') RETURNING id")
        result = cursor.fetchone()
        if result:
            subject_id = result[0]
        else:
            # 如果科目已存在，获取其ID
            cursor = db.execute("SELECT id FROM subjects WHERE name = '测试科目3'")
            subject_id = cursor.fetchone()[0]
        db.commit()

        data = {
            'content': '原始题目',
            'question_type': 'single',
            'options': ['A、选项1', 'B、选项2', 'C、选项3', 'D、选项4'],
            'correct_answer': 'A',
            'explanation': ''
        }
        question_id = create_question(subject_id, data)

        update_data = {
            'content': '修改后的题目',
            'question_type': 'multiple',
            'options': ['A、修改选项1', 'B、修改选项2', 'C、修改选项3', 'D、修改选项4'],
            'correct_answer': 'AB',
            'explanation': '修改后的解析'
        }
        success = update_question(question_id, update_data)
        assert success is True

        question = get_question_by_id(question_id)
        assert question['content'] == '修改后的题目'
        assert question['question_type'] == 'multiple'
        assert question['correct_answer'] == 'AB'

    def test_delete_question_cleans_session_records(self, db):
        cursor = db.execute("INSERT OR IGNORE INTO subjects (name) VALUES ('测试科目4') RETURNING id")
        result = cursor.fetchone()
        if result:
            subject_id = result[0]
        else:
            # 如果科目已存在，获取其ID
            cursor = db.execute("SELECT id FROM subjects WHERE name = '测试科目4'")
            subject_id = cursor.fetchone()[0]

        cursor = db.execute("SELECT id FROM users WHERE username = 'test_user'")
        user_id = cursor.fetchone()[0]
        db.commit()

        data = {
            'content': '将被删除的题目',
            'question_type': 'judge',
            'options': ['正确', '错误'],
            'correct_answer': '正确',
            'explanation': ''
        }
        question_id = create_question(subject_id, data)

        cursor = db.execute("""
            INSERT INTO exam_sessions (user_id, subject_id, subject_name, question_ids, total_questions, status, exam_mode)
            VALUES (?, ?, ?, ?, ?, 'in_progress', 'full')
        """, (user_id, subject_id, '测试科目', str([question_id]), 1))
        session_id = cursor.lastrowid
        db.commit()

        cursor = db.execute("""
            INSERT INTO exam_session_details (session_id, question_id, user_answer, is_correct)
            VALUES (?, ?, '正确', 1)
        """, (session_id, question_id))
        db.commit()

        success = delete_question(question_id)
        assert success is True

        cursor = db.execute("SELECT question_ids FROM exam_sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        assert row is not None
        question_ids_list = json.loads(row[0])
        assert question_id not in question_ids_list

        cursor = db.execute("SELECT COUNT(*) FROM exam_session_details WHERE question_id = ?", (question_id,))
        count = cursor.fetchone()[0]
        assert count == 0

    def test_get_nonexistent_question(self, db):
        question = get_question_by_id(99999)
        assert question is None

    def test_update_nonexistent_question(self, db):
        data = {
            'content': '修改内容',
            'question_type': 'single',
            'options': [],
            'correct_answer': 'A',
            'explanation': ''
        }
        success = update_question(99999, data)
        assert success is False

    def test_delete_nonexistent_question(self, db):
        success = delete_question(99999)
        assert success is False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
