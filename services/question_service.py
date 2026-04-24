import sqlite3
import json
from datetime import datetime, timedelta
from services.database import Database


db = Database()


def init(config=None, db_path=None):
    db.init(config, db_path)


def get_db():
    return db.get_db()


def to_beijing_time(time_str):
    if not time_str:
        return None
    try:
        if 'T' in time_str:
            dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
        else:
            dt = datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
        beijing_dt = dt + timedelta(hours=8)
        return beijing_dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return time_str


def normalize_answer(answer):
    answer = answer.strip()
    if answer in ['正确', '对', '✓', '√', '是', 'T', 't', 'True', 'true']:
        return '正确'
    elif answer in ['错误', '错', '✗', '×', '否', 'F', 'f', 'False', 'false']:
        return '错误'
    return answer.upper()


def get_questions_by_subject(subject_id):
    conn = get_db()
    questions = conn.execute(
        'SELECT id, question_type, content, options, correct_answer, explanation FROM questions WHERE subject_id = ?',
        (subject_id,)
    ).fetchall()
    conn.close()
    result = []
    for q in questions:
        q_dict = dict(zip(q.keys(), q))
        q_dict['options'] = json.loads(q_dict['options']) if q_dict['options'] else []
        result.append(q_dict)
    return result


def get_question_by_id(question_id):
    conn = get_db()
    q = conn.execute(
        'SELECT id, subject_id, question_type, content, options, correct_answer, explanation FROM questions WHERE id = ?',
        (question_id,)
    ).fetchone()
    conn.close()
    if not q:
        return None
    q_dict = dict(zip(q.keys(), q))
    q_dict['options'] = json.loads(q_dict['options']) if q_dict['options'] else []
    return q_dict


def update_question(question_id, data):
    conn = get_db()
    c = conn.cursor()

    content = data.get('content')
    question_type = data.get('question_type')
    options = data.get('options', [])
    correct_answer = data.get('correct_answer')
    explanation = data.get('explanation', '')

    if question_type == 'judge':
        options = ['正确', '错误']

    options_json = json.dumps(options, ensure_ascii=False)

    c.execute('''
        UPDATE questions
        SET content = ?, question_type = ?, options = ?, correct_answer = ?, explanation = ?
        WHERE id = ?
    ''', (content, question_type, options_json, correct_answer, explanation, question_id))

    conn.commit()
    affected = c.rowcount
    conn.close()
    return affected > 0


def create_question(subject_id, data):
    conn = get_db()
    c = conn.cursor()

    content = data.get('content')
    question_type = data.get('question_type')
    options = data.get('options', [])
    correct_answer = data.get('correct_answer')
    explanation = data.get('explanation', '')

    if question_type == 'judge':
        options = ['正确', '错误']

    options_json = json.dumps(options, ensure_ascii=False)

    c.execute('''
        INSERT INTO questions (subject_id, question_type, content, options, correct_answer, explanation)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (subject_id, question_type, content, options_json, correct_answer, explanation))

    question_id = c.lastrowid
    conn.commit()
    conn.close()
    return question_id


def delete_question(question_id):
    conn = get_db()
    c = conn.cursor()

    c.execute('SELECT subject_id FROM questions WHERE id = ?', (question_id,))
    question = c.fetchone()
    if not question:
        conn.close()
        return False

    subject_id = question['subject_id']

    sessions = c.execute('SELECT id, question_ids FROM exam_sessions').fetchall()

    for session in sessions:
        if not session['question_ids']:
            continue
        question_ids = json.loads(session['question_ids'])
        if question_id in question_ids:
            question_ids.remove(question_id)
            new_question_ids = json.dumps(question_ids)
            new_total = len(question_ids)
            c.execute('UPDATE exam_sessions SET question_ids = ?, total_questions = ? WHERE id = ?',
                     (new_question_ids, new_total, session['id']))

    c.execute('DELETE FROM exam_session_details WHERE question_id = ?', (question_id,))

    c.execute('DELETE FROM questions WHERE id = ?', (question_id,))

    conn.commit()
    conn.close()
    return True


def parse_single_question(content):
    import re

    lines = content.split('\n')
    i = 0

    judge_patterns = ['正确', '错误', '对', '错', '✓', '√', '是', '否', 'True', 'False', 'T', 'F']
    judge_pattern = '|'.join(re.escape(p) for p in judge_patterns)

    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        match = re.match(rf'^({judge_pattern}|[A-Z\u0410-\u042f]+)[\t\s]+(.+)$', line)
        if not match:
            i += 1
            continue

        answer_part = match.group(1)
        answer_part = answer_part.replace('А', 'A').replace('В', 'B').replace('С', 'C').replace('Е', 'E').replace('М', 'M').replace('Т', 'T')
        question_content = match.group(2).strip()

        if answer_part in judge_patterns:
            q_type = 'judge'
            correct = normalize_answer(answer_part)
            options = ['正确', '错误']
            i += 1
        else:
            q_type = 'multiple' if len(answer_part) > 1 else 'single'
            correct = answer_part.upper()

            options = []
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1

            while j < len(lines):
                opt_line = lines[j].strip()
                if not opt_line:
                    j += 1
                    continue
                if re.match(rf'^({judge_pattern}|[A-Z\u0410-\u042f]+)[\t\s]+.+$', opt_line):
                    break
                if re.match(r'^[A-Z\u0410-\u042f]\s*[、.\s，]', opt_line):
                    opt_line = opt_line.replace('А', 'A').replace('В', 'B').replace('С', 'C').replace('Е', 'E').replace('М', 'M').replace('Т', 'T')
                    options.append(opt_line)
                    j += 1
                else:
                    j += 1
            i = j

        return {
            'type': q_type,
            'content': question_content,
            'options': options,
            'correct': correct,
            'explanation': ''
        }

    return None