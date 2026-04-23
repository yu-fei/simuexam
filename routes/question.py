from flask import Blueprint, request, jsonify
from services.question_service import (
    get_questions_by_subject,
    get_question_by_id,
    update_question,
    create_question,
    delete_question,
    parse_single_question
)

question_bp = Blueprint('question', __name__)


@question_bp.route('/api/subjects/<int:subject_id>/questions', methods=['GET'])
def get_subject_questions(subject_id):
    questions = get_questions_by_subject(subject_id)
    return jsonify({'success': True, 'questions': questions})


@question_bp.route('/api/questions/<int:question_id>', methods=['GET'])
def get_question(question_id):
    question = get_question_by_id(question_id)
    if not question:
        return jsonify({'success': False, 'message': '题目不存在'})
    return jsonify({'success': True, 'question': question})


@question_bp.route('/api/questions/<int:question_id>', methods=['PUT'])
def modify_question(question_id):
    data = request.json
    success = update_question(question_id, data)
    if not success:
        return jsonify({'success': False, 'message': '题目不存在'})
    return jsonify({'success': True, 'message': '题目已更新'})


@question_bp.route('/api/questions', methods=['POST'])
def add_question():
    data = request.json
    subject_id = data.get('subject_id')
    if not subject_id:
        return jsonify({'success': False, 'message': '缺少科目ID'})

    question_id = create_question(subject_id, data)
    return jsonify({'success': True, 'question_id': question_id, 'message': '题目已创建'})


@question_bp.route('/api/questions/<int:question_id>', methods=['DELETE'])
def remove_question(question_id):
    success = delete_question(question_id)
    if not success:
        return jsonify({'success': False, 'message': '题目不存在'})
    return jsonify({'success': True, 'message': '题目已删除'})


@question_bp.route('/api/questions/parse', methods=['POST'])
def parse_question():
    data = request.json
    content = data.get('content', '')
    result = parse_single_question(content)
    if not result:
        return jsonify({'success': False, 'message': '未能解析题目'})
    return jsonify({'success': True, 'question': result})