import os
import re
import sqlite3
import json
import argparse
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, session
from werkzeug.utils import secure_filename
from routes.question import question_bp
from config import Config

# 解析命令行参数
parser = argparse.ArgumentParser(description='模拟考试系统')
parser.add_argument('config_file', type=str, help='配置文件路径')
args = parser.parse_args()

# 加载配置
config = Config(args.config_file)

app = Flask(__name__, static_folder='templates')
app.secret_key = 'exam_system_secret_key_2026'

app.register_blueprint(question_bp)

# 初始化 services.question_service
import services.question_service as qs_module
qs_module.init(config)

# 创建别名，让 app.py 中的 get_db() 调用 qs_module.get_db()
get_db = qs_module.get_db

# 上传文件夹
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# 确保templates目录存在
os.makedirs('templates', exist_ok=True)


# ------------------ 辅助函数 ------------------
def init_db():
    """初始化数据库，创建必要的表结构"""
    conn = qs_module.get_db()
    conn.commit()
    conn.close()


init_db()


def to_beijing_time(time_str):
    """将UTC时间字符串转换为北京时间字符串"""
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
    """标准化答案"""
    answer = answer.strip()
    if answer in ['正确', '对', '✓', '√', '是', 'T', 't', 'True', 'true']:
        return '正确'
    elif answer in ['错误', '错', '✗', '×', '否', 'F', 'f', 'False', 'false']:
        return '错误'
    return answer.upper()


def parse_uploaded_txt(content):
    """解析上传的TXT文件，支持题干换行和中文逗号选项"""
    questions = []
    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        match = re.match(r'^([A-Z\u0410-\u042f]+|正确|错误|对|错|✓|√|是|否|T|F|True|False)[\t\s]+(.+)$', line)
        if not match:
            i += 1
            continue

        answer_part = match.group(1)
        answer_part = answer_part.replace('А', 'A').replace('В', 'B').replace('С', 'C').replace('Е', 'E').replace('М',
                                                                                                                  'M').replace(
            'Т', 'T')
        question_content = match.group(2).strip()

        j = i + 1
        while j < len(lines):
            next_line = lines[j].strip()
            if not next_line:
                j += 1
                continue
            if re.match(r'^([A-Z\u0410-\u042f]+|正确|错误|对|错|✓|√|是|否|T|F|True|False)[\t\s]+.+$', next_line):
                break
            if re.match(r'^[A-Z\u0410-\u042f]\s*[、.\s，]', next_line):
                break
            question_content += '\n' + next_line
            j += 1

        if answer_part in ['正确', '错误', '对', '错', '✓', '√', '是', '否', 'T', 'F', 'True', 'False']:
            q_type = 'judge'
            correct = normalize_answer(answer_part)
            options_json = json.dumps(['正确', '错误'], ensure_ascii=False)
            i = j
        else:
            q_type = 'multiple' if len(answer_part) > 1 else 'single'
            correct = answer_part.upper()

            options = []
            while j < len(lines):
                opt_line = lines[j].strip()
                if not opt_line:
                    j += 1
                    continue
                if re.match(r'^([A-Z\u0410-\u042f]+|正确|错误|对|错)[\t\s]+.+$', opt_line):
                    break
                if re.match(r'^[A-Z\u0410-\u042f]\s*[、.\s，]', opt_line):
                    opt_line = opt_line.replace('А', 'A').replace('В', 'B').replace('С', 'C').replace('Е', 'E').replace(
                        'М', 'M').replace('Т', 'T')
                    options.append(opt_line)
                    j += 1
                else:
                    j += 1
            options_json = json.dumps(options, ensure_ascii=False)
            i = j

        questions.append({
            'type': q_type,
            'content': question_content,
            'options': options_json,
            'correct': correct,
            'explanation': ''
        })

    return questions


# ------------------ 路由 ------------------
@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')


@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('templates', path)


# ------------------ API 接口 ------------------

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    if not username:
        return jsonify({'success': False, 'message': '用户名不能为空'})

    conn = get_db()
    c = conn.cursor()
    c.execute('INSERT OR IGNORE INTO users (username) VALUES (?)', (username,))
    conn.commit()
    user_id = c.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()['id']
    conn.close()

    session['user_id'] = user_id
    session['username'] = username
    return jsonify({'success': True, 'user_id': user_id, 'username': username})


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/api/current_user', methods=['GET'])
def current_user():
    if 'user_id' in session:
        return jsonify({'logged_in': True, 'username': session.get('username'), 'user_id': session.get('user_id')})
    return jsonify({'logged_in': False})


@app.route('/api/subjects', methods=['GET'])
def get_subjects():
    conn = get_db()
    subjects = conn.execute('''
                            SELECT s.id, s.name, COUNT(q.id) as question_count
                            FROM subjects s
                                     LEFT JOIN questions q ON s.id = q.subject_id
                            GROUP BY s.id
                            ORDER BY s.name
                            ''').fetchall()
    conn.close()
    return jsonify([dict(s) for s in subjects])


@app.route('/api/subjects/<int:subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
    conn = get_db()
    c = conn.cursor()
    c.execute(
        'DELETE FROM exam_session_details WHERE session_id IN (SELECT id FROM exam_sessions WHERE subject_id = ?)',
        (subject_id,))
    c.execute('DELETE FROM exam_sessions WHERE subject_id = ?', (subject_id,))
    c.execute('DELETE FROM exam_records WHERE subject_id = ?', (subject_id,))
    c.execute('DELETE FROM questions WHERE subject_id = ?', (subject_id,))
    c.execute('DELETE FROM subjects WHERE id = ?', (subject_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': '科目已删除'})


@app.route('/api/upload_questions', methods=['POST'])
def upload_questions():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '没有文件'})

    file = request.files['file']
    subject_name = request.form.get('subject_name', '').strip()
    import_mode = request.form.get('import_mode', 'append')

    if not subject_name:
        return jsonify({'success': False, 'message': '请填写科目名称'})

    if file.filename == '':
        return jsonify({'success': False, 'message': '文件名为空'})

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    questions = parse_uploaded_txt(content)
    if not questions:
        return jsonify({'success': False, 'message': '未能解析到有效试题'})

    conn = get_db()
    c = conn.cursor()

    c.execute('SELECT id FROM subjects WHERE name = ?', (subject_name,))
    existing_subject = c.fetchone()

    if existing_subject:
        subject_id = existing_subject['id']
        if import_mode == 'overwrite':
            c.execute(
                'DELETE FROM exam_session_details WHERE session_id IN (SELECT id FROM exam_sessions WHERE subject_id = ?)',
                (subject_id,))
            c.execute('DELETE FROM exam_sessions WHERE subject_id = ?', (subject_id,))
            c.execute('DELETE FROM exam_records WHERE subject_id = ?', (subject_id,))
            c.execute('DELETE FROM questions WHERE subject_id = ?', (subject_id,))
            action_msg = '覆盖导入'
        else:
            action_msg = '追加导入'
    else:
        c.execute('INSERT INTO subjects (name) VALUES (?)', (subject_name,))
        subject_id = c.lastrowid
        action_msg = '新建导入'

    count = 0
    for q in questions:
        c.execute('''INSERT INTO questions (subject_id, question_type, content, options, correct_answer)
                     VALUES (?, ?, ?, ?, ?)''',
                  (subject_id, q['type'], q['content'], q['options'], q['correct']))
        count += 1

    conn.commit()
    conn.close()
    os.remove(filepath)

    return jsonify({'success': True, 'message': f'[{action_msg}] 成功导入 {count} 道试题', 'subject_id': subject_id})


@app.route('/api/exam/start', methods=['POST'])
def start_exam():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '请先登录'})

    data = request.json
    subject_id = data.get('subject_id')
    mode = data.get('mode', 'all')
    count = data.get('count', 0)

    user_id = session['user_id']
    conn = get_db()

    subject = conn.execute('SELECT name FROM subjects WHERE id = ?', (subject_id,)).fetchone()
    subject_name = subject['name'] if subject else ''

    if mode == 'all':
        query = '''SELECT id, question_type, content, options, correct_answer \
                   FROM questions \
                   WHERE subject_id = ?'''
        params = [subject_id]
    elif mode == 'wrong':
        query = '''SELECT DISTINCT q.id, q.question_type, q.content, q.options, q.correct_answer
                   FROM questions q
                            INNER JOIN (SELECT question_id, MAX(id) as max_id \
                                        FROM exam_records \
                                        WHERE user_id = ? AND subject_id = ? \
                                        GROUP BY question_id) latest ON q.id = latest.question_id
                            INNER JOIN exam_records r ON latest.max_id = r.id
                   WHERE r.is_correct = 0'''
        params = [user_id, subject_id]
    elif mode == 'new':
        query = '''SELECT q.id, q.question_type, q.content, q.options, q.correct_answer
                   FROM questions q
                   WHERE q.subject_id = ? \
                     AND q.id NOT IN (SELECT question_id FROM exam_records WHERE user_id = ? AND subject_id = ?)'''
        params = [subject_id, user_id, subject_id]
    elif mode == 'random':
        query = '''SELECT id, question_type, content, options, correct_answer \
                   FROM questions \
                   WHERE subject_id = ? \
                   ORDER BY RANDOM() LIMIT ?'''
        params = [subject_id, count]
    else:
        return jsonify({'success': False, 'message': '未知模式'})

    questions = conn.execute(query, params).fetchall()
    question_ids = [q['id'] for q in questions]
    total_questions = len(question_ids)

    c = conn.cursor()
    c.execute('''INSERT INTO exam_sessions (user_id, subject_id, subject_name, exam_mode, total_questions, question_ids,
                                            status)
                 VALUES (?, ?, ?, ?, ?, ?, 'in_progress')''',
              (user_id, subject_id, subject_name, mode, total_questions, json.dumps(question_ids)))
    session_id = c.lastrowid
    conn.commit()
    conn.close()

    exam_questions = []
    for q in questions:
        q_dict = dict(q)
        q_dict['options'] = json.loads(q_dict['options']) if q_dict['options'] else []
        exam_questions.append({
            'id': q_dict['id'],
            'type': q_dict['question_type'],
            'content': q_dict['content'],
            'options': q_dict['options']
        })

    session['exam_session_id'] = session_id
    session['exam_questions'] = question_ids
    session['exam_subject_id'] = subject_id

    return jsonify({'success': True, 'questions': exam_questions, 'session_id': session_id})


@app.route('/api/exam/start_custom', methods=['POST'])
def start_exam_custom():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '请先登录'})

    data = request.json
    subject_id = data.get('subject_id')
    question_ids = data.get('question_ids', [])

    if not question_ids:
        return jsonify({'success': False, 'message': '没有题目'})

    question_ids = list(set([int(qid) for qid in question_ids]))
    user_id = session['user_id']
    conn = get_db()

    subject = conn.execute('SELECT name FROM subjects WHERE id = ?', (subject_id,)).fetchone()
    subject_name = subject['name'] if subject else ''

    placeholders = ','.join('?' * len(question_ids))
    query = f'''SELECT id, question_type, content, options, correct_answer 
                FROM questions WHERE subject_id = ? AND id IN ({placeholders})'''
    params = [subject_id] + question_ids
    questions = conn.execute(query, params).fetchall()

    total_questions = len([q for q in questions])
    c = conn.cursor()
    c.execute('''INSERT INTO exam_sessions (user_id, subject_id, subject_name, exam_mode, total_questions, question_ids,
                                            status)
                 VALUES (?, ?, ?, ?, ?, ?, 'in_progress')''',
              (user_id, subject_id, subject_name, 'custom', total_questions, json.dumps(question_ids)))
    session_id = c.lastrowid
    conn.commit()
    conn.close()

    exam_questions = []
    for q in questions:
        q_dict = dict(q)
        q_dict['options'] = json.loads(q_dict['options']) if q_dict['options'] else []
        exam_questions.append({
            'id': q_dict['id'],
            'type': q_dict['question_type'],
            'content': q_dict['content'],
            'options': q_dict['options']
        })

    session['exam_session_id'] = session_id
    session['exam_questions'] = [q['id'] for q in questions]
    session['exam_subject_id'] = subject_id

    return jsonify({'success': True, 'questions': exam_questions, 'session_id': session_id})


@app.route('/api/exam/submit_answer', methods=['POST'])
def submit_answer():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '请先登录'})

    data = request.json
    question_id = data.get('question_id')
    user_answer = data.get('answer', '').strip()

    user_id = session['user_id']
    subject_id = session.get('exam_subject_id')
    session_id = session.get('exam_session_id')

    conn = get_db()
    q = conn.execute('SELECT correct_answer, question_type FROM questions WHERE id = ?', (question_id,)).fetchone()
    if not q:
        conn.close()
        return jsonify({'success': False, 'message': '题目不存在'})

    correct = q['correct_answer'].strip()
    q_type = q['question_type']

    if q_type == 'judge':
        user_normalized = normalize_answer(user_answer)
        is_correct = 1 if user_normalized == correct else 0
    else:
        user_sorted = ''.join(sorted(user_answer.upper()))
        correct_sorted = ''.join(sorted(correct))
        is_correct = 1 if user_sorted == correct_sorted else 0

    c = conn.cursor()
    c.execute('''INSERT INTO exam_records (user_id, subject_id, question_id, user_answer, is_correct)
                 VALUES (?, ?, ?, ?, ?)''',
              (user_id, subject_id, question_id, user_answer, is_correct))

    if session_id:
        existing = c.execute('SELECT id FROM exam_session_details WHERE session_id = ? AND question_id = ?',
                             (session_id, question_id)).fetchone()
        if existing:
            c.execute('''UPDATE exam_session_details
                         SET user_answer = ?,
                             is_correct  = ?,
                             submit_time = CURRENT_TIMESTAMP
                         WHERE session_id = ?
                           AND question_id = ?''',
                      (user_answer, is_correct, session_id, question_id))
        else:
            c.execute('''INSERT INTO exam_session_details (session_id, question_id, user_answer, is_correct)
                         VALUES (?, ?, ?, ?)''',
                      (session_id, question_id, user_answer, is_correct))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'is_correct': bool(is_correct), 'correct_answer': correct})


@app.route('/api/exam/finish', methods=['POST'])
def finish_exam():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '请先登录'})

    session_id = session.get('exam_session_id')
    if not session_id:
        return jsonify({'success': False, 'message': '没有进行中的考试'})

    data = request.json or {}
    answered_count = data.get('answered_count', 0)
    correct_count = data.get('correct_count', 0)

    conn = get_db()
    c = conn.cursor()
    c.execute('''UPDATE exam_sessions
                 SET end_time       = CURRENT_TIMESTAMP,
                     status         = 'completed',
                     answered_count = ?,
                     correct_count  = ?
                 WHERE id = ?''',
              (answered_count, correct_count, session_id))
    conn.commit()
    conn.close()

    session.pop('exam_session_id', None)
    session.pop('exam_questions', None)
    session.pop('exam_subject_id', None)

    return jsonify({'success': True, 'message': '考试已完成'})


@app.route('/api/exam/in_progress', methods=['GET'])
def get_in_progress_exam():
    """获取当前用户进行中的考试"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '请先登录'})

    user_id = session['user_id']
    conn = get_db()

    session_info = conn.execute('''
                                SELECT id,
                                       subject_id,
                                       subject_name,
                                       exam_mode,
                                       total_questions,
                                       question_ids,
                                       answered_count,
                                       correct_count,
                                       start_time,
                                       status,
                                       current_page
                                FROM exam_sessions
                                WHERE user_id = ?
                                  AND status = 'in_progress'
                                ORDER BY start_time DESC LIMIT 1
                                ''', (user_id,)).fetchone()

    if not session_info:
        conn.close()
        return jsonify({'success': False, 'message': '没有进行中的考试'})

    question_ids = json.loads(session_info['question_ids'] or '[]')

    exam_questions = []
    if question_ids:
        placeholders = ','.join('?' * len(question_ids))
        query = f'''SELECT id, question_type, content, options, correct_answer
                    FROM questions WHERE id IN ({placeholders})'''
        questions = conn.execute(query, question_ids).fetchall()

        for q in questions:
            q_dict = dict(q)
            q_dict['options'] = json.loads(q_dict['options']) if q_dict['options'] else []
            exam_questions.append({
                'id': q_dict['id'],
                'type': q_dict['question_type'],
                'content': q_dict['content'],
                'options': q_dict['options'],
                'correct_answer': q_dict['correct_answer']
            })

    details = conn.execute('''
                           SELECT question_id, user_answer, is_correct
                           FROM exam_session_details
                           WHERE session_id = ?
                           ''', (session_info['id'],)).fetchall()
    conn.close()

    answered_map = {}
    answer_results = {}
    for d in details:
        answered_map[d['question_id']] = d['user_answer']
        # 先不设置 correct 值，后面根据最新的题目信息重新计算
        answer_results[d['question_id']] = {
            'correct': False,
            'correctAnswer': None
        }

    # 根据最新的题目信息重新计算答案的正确性
    question_dict = {q['id']: q for q in exam_questions}
    for q in exam_questions:
        if q['id'] in answer_results:
            answer_results[q['id']]['correctAnswer'] = q['correct_answer']
            # 重新计算正确性
            user_answer = answered_map.get(q['id'])
            if user_answer:
                answer_results[q['id']]['correct'] = (user_answer == q['correct_answer'])

    result = dict(session_info)
    result.pop('question_ids', None)
    result['start_time'] = to_beijing_time(result['start_time'])
    result['questions'] = exam_questions
    result['user_answers'] = answered_map
    result['answered_status'] = list(answered_map.keys())
    result['answer_results'] = answer_results

    return jsonify({'success': True, 'session': result})


@app.route('/api/exam/restore', methods=['POST'])
def restore_exam():
    """恢复进行中的考试"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '请先登录'})

    data = request.json
    session_id = data.get('session_id')

    if not session_id:
        return jsonify({'success': False, 'message': '缺少会话ID'})

    user_id = session['user_id']
    conn = get_db()

    session_info = conn.execute('''
                                SELECT id, subject_id, subject_name, question_ids, current_page
                                FROM exam_sessions
                                WHERE id = ?
                                  AND user_id = ?
                                  AND status = 'in_progress'
                                ''', (session_id, user_id)).fetchone()

    if not session_info:
        conn.close()
        return jsonify({'success': False, 'message': '考试会话不存在或已完成'})

    question_ids = json.loads(session_info['question_ids'] or '[]')

    exam_questions = []
    if question_ids:
        placeholders = ','.join('?' * len(question_ids))
        query = f'''SELECT id, question_type, content, options, correct_answer
                    FROM questions WHERE id IN ({placeholders})'''
        questions = conn.execute(query, question_ids).fetchall()

        for q in questions:
            q_dict = dict(q)
            q_dict['options'] = json.loads(q_dict['options']) if q_dict['options'] else []
            exam_questions.append({
                'id': q_dict['id'],
                'type': q_dict['question_type'],
                'content': q_dict['content'],
                'options': q_dict['options'],
                'correct_answer': q_dict['correct_answer']
            })

    details = conn.execute('''
                           SELECT question_id, user_answer, is_correct
                           FROM exam_session_details
                           WHERE session_id = ?
                           ''', (session_id,)).fetchall()
    conn.close()

    # 根据最新的题目信息重新计算答案的正确性
    question_dict = {q['id']: q for q in exam_questions}
    updated_details = []
    for d in details:
        detail_dict = dict(d)
        # 重新计算正确性
        question = question_dict.get(detail_dict['question_id'])
        if question and detail_dict['user_answer']:
            detail_dict['is_correct'] = (detail_dict['user_answer'] == question['correct_answer'])
        updated_details.append(detail_dict)

    session['exam_session_id'] = session_id
    session['exam_questions'] = question_ids
    session['exam_subject_id'] = session_info['subject_id']

    return jsonify({
        'success': True,
        'session_id': session_id,
        'subject_id': session_info['subject_id'],
        'subject_name': session_info['subject_name'],
        'questions': exam_questions,
        'current_page': session_info['current_page'],
        'answered_details': updated_details
    })


@app.route('/api/exam/save_page', methods=['POST'])
def save_exam_page():
    """保存考试当前页码"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '请先登录'})

    data = request.json
    session_id = data.get('session_id')
    current_page = data.get('current_page', 1)

    if not session_id:
        return jsonify({'success': False, 'message': '缺少会话ID'})

    conn = get_db()
    conn.execute('UPDATE exam_sessions SET current_page = ? WHERE id = ?', (current_page, session_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True})


@app.route('/api/exam/abandon', methods=['POST'])
def abandon_exam():
    """放弃进行中的考试"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '请先登录'})

    data = request.json
    session_id = data.get('session_id')

    if not session_id:
        return jsonify({'success': False, 'message': '缺少会话ID'})

    user_id = session['user_id']
    conn = get_db()
    c = conn.cursor()

    c.execute('''UPDATE exam_sessions
                 SET status   = 'abandoned',
                     end_time = CURRENT_TIMESTAMP
                 WHERE id = ?
                   AND user_id = ?
                   AND status = 'in_progress' ''',
              (session_id, user_id))
    conn.commit()
    conn.close()

    session.pop('exam_session_id', None)
    session.pop('exam_questions', None)
    session.pop('exam_subject_id', None)

    return jsonify({'success': True, 'message': '考试已放弃'})


@app.route('/api/exam/sessions', methods=['GET'])
def get_exam_sessions():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '请先登录'})

    user_id = session['user_id']
    conn = get_db()

    sessions = conn.execute('''
                            SELECT id,
                                   subject_id,
                                   subject_name,
                                   exam_mode,
                                   total_questions,
                                   answered_count,
                                   correct_count,
                                   start_time,
                                   end_time,
                                   status
                            FROM exam_sessions
                            WHERE user_id = ?
                              AND status IN ('completed', 'in_progress')
                            ORDER BY start_time DESC
                            ''', (user_id,)).fetchall()
    conn.close()

    result = []
    for s in sessions:
        s_dict = dict(s)
        s_dict['start_time'] = to_beijing_time(s_dict['start_time'])
        s_dict['end_time'] = to_beijing_time(s_dict['end_time'])
        if s_dict['answered_count'] > 0:
            s_dict['accuracy'] = round(s_dict['correct_count'] / s_dict['answered_count'] * 100, 1)
        else:
            s_dict['accuracy'] = 0
        result.append(s_dict)

    return jsonify({'success': True, 'sessions': result})


@app.route('/api/exam/sessions/<int:session_id>', methods=['GET'])
def get_exam_session_detail(session_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '请先登录'})

    user_id = session['user_id']
    conn = get_db()

    session_info = conn.execute('''
                                SELECT id,
                                       subject_id,
                                       subject_name,
                                       exam_mode,
                                       total_questions,
                                       question_ids,
                                       answered_count,
                                       correct_count,
                                       start_time,
                                       end_time,
                                       status
                                FROM exam_sessions
                                WHERE id = ?
                                  AND user_id = ?
                                ''', (session_id, user_id)).fetchone()

    if not session_info:
        conn.close()
        return jsonify({'success': False, 'message': '考试记录不存在'})

    question_ids = json.loads(session_info['question_ids'] or '[]')

    if question_ids:
        placeholders = ','.join('?' * len(question_ids))
        query = f'''SELECT id, question_type, content, options, correct_answer
                    FROM questions WHERE id IN ({placeholders})'''
        all_questions = conn.execute(query, question_ids).fetchall()
    else:
        all_questions = []

    details = conn.execute('''
                           SELECT question_id, user_answer, is_correct, submit_time
                           FROM exam_session_details
                           WHERE session_id = ?
                           ''', (session_id,)).fetchall()

    conn.close()

    details_dict = {}
    correct_count = 0

    for d in details:
        details_dict[d['question_id']] = {
            'user_answer': d['user_answer'],
            'is_correct': d['is_correct'],
            'submit_time': to_beijing_time(d['submit_time'])
        }
        if d['is_correct']:
            correct_count += 1

    result = dict(session_info)
    result.pop('question_ids', None)
    result['start_time'] = to_beijing_time(result['start_time'])
    result['end_time'] = to_beijing_time(result['end_time'])
    result['correct_count'] = correct_count

    questions = []
    answered_count = 0

    for q in all_questions:
        q_dict = dict(q)
        q_dict['options'] = json.loads(q_dict['options']) if q_dict['options'] else []

        detail = details_dict.get(q_dict['id'])
        if detail:
            q_dict['user_answer'] = detail['user_answer']
            q_dict['is_correct'] = detail['is_correct']
            q_dict['submit_time'] = detail['submit_time']
            q_dict['answered'] = True
            answered_count += 1
        else:
            q_dict['user_answer'] = None
            q_dict['is_correct'] = None
            q_dict['submit_time'] = None
            q_dict['answered'] = False

        questions.append(q_dict)

    result['answered_count'] = answered_count
    result['accuracy'] = round(correct_count / answered_count * 100, 1) if answered_count > 0 else 0
    result['total_questions'] = len(questions)
    result['unanswered_count'] = len(questions) - answered_count
    result['wrong_count'] = answered_count - correct_count
    result['questions'] = questions
    result['answered_question_ids'] = list(details_dict.keys())

    return jsonify({'success': True, 'session': result})


@app.route('/api/exam/sessions/<int:session_id>', methods=['DELETE'])
def delete_exam_session(session_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '请先登录'})

    user_id = session['user_id']
    conn = get_db()
    c = conn.cursor()
    c.execute('DELETE FROM exam_session_details WHERE session_id = ?', (session_id,))
    c.execute('DELETE FROM exam_sessions WHERE id = ? AND user_id = ?', (session_id, user_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': '考试记录已删除'})


if __name__ == '__main__':
    print("✅ 模拟考试系统启动！")
    print(f"🌐 访问地址: http://127.0.0.1:{config.port}")
    print(f"📦 数据库路径: {config.db_path}")
    use_reloader = False if 'test' in config.db_path else config.debug
    app.run(debug=config.debug, host='0.0.0.0', port=config.port, use_reloader=use_reloader)