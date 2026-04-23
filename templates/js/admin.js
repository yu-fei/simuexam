let currentSubjectQuestions = [];
let currentEditingQuestion = null;

async function loadSubjectQuestions(subjectId) {
    const res = await getQuestionsBySubject(subjectId);
    if (res.success) {
        currentSubjectQuestions = res.questions;
        renderQuestionList(subjectId);
    }
}

function renderQuestionList(subjectId) {
    const container = document.getElementById('questionListContainer');
    if (!container) return;

    if (currentSubjectQuestions.length === 0) {
        container.innerHTML = '<p style="color:#64748b; padding:12px;">暂无试题</p>';
        return;
    }

    let html = '<div class="question-list">';
    currentSubjectQuestions.forEach((q, idx) => {
        const typeLabel = q.question_type === 'judge' ? '判断' : (q.question_type === 'multiple' ? '多选' : '单选');
        const typeClass = q.question_type === 'judge' ? 'type-judge' : (q.question_type === 'multiple' ? 'type-multi' : 'type-single');
        html += `<div class="question-item">
            <div class="question-info">
                <span class="question-num">${idx + 1}.</span>
                <span class="question-type ${typeClass}">${typeLabel}</span>
                <span class="question-content">${q.content.substring(0, 50)}${q.content.length > 50 ? '...' : ''}</span>
            </div>
            <div class="question-actions">
                <button class="btn btn-sm" onclick="editQuestion(${q.id})">编辑</button>
                <button class="btn btn-danger btn-sm" onclick="removeQuestion(${q.id})">删除</button>
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function questionToTxt(question) {
    let txt = question.correct_answer + ' ' + question.content;
    if (question.question_type !== 'judge' && question.options && question.options.length > 0) {
        question.options.forEach(opt => {
            txt += '\n' + opt;
        });
    }
    return txt;
}

async function editQuestion(questionId) {
    const res = await getQuestion(questionId);
    if (!res.success) {
        alert('获取题目失败');
        return;
    }
    currentEditingQuestion = res.question;
    
    document.getElementById('reimportModalTitle').innerText = '编辑题目';
    const txt = questionToTxt(res.question);
    document.getElementById('reimportContent').value = txt;
    document.getElementById('reimportModal').style.display = 'flex';
}

function showNewQuestionModal() {
    currentEditingQuestion = null;
    document.getElementById('reimportModalTitle').innerText = '新增题目';
    document.getElementById('reimportContent').value = '';
    document.getElementById('reimportModal').style.display = 'flex';
}

function closeReimportModal() {
    document.getElementById('reimportModal').style.display = 'none';
    currentEditingQuestion = null;
    window.currentEditingExamQuestion = null;
}

async function confirmReimport() {
    const content = document.getElementById('reimportContent').value.trim();
    if (!content) {
        alert('请输入题目内容');
        return;
    }

    const res = await parseQuestion(content);
    if (!res.success) {
        alert('解析失败，请检查格式');
        return;
    }

    const question = res.question;
    const data = {
        content: question.content,
        question_type: question.type,
        options: question.options,
        correct_answer: question.correct,
        explanation: question.explanation || ''
    };

    let saveRes;
    let isExamEdit = false;

    if (window.currentEditingExamQuestion) {
        isExamEdit = true;
        saveRes = await updateQuestion(window.currentEditingExamQuestion.id, data);
    } else if (currentEditingQuestion) {
        saveRes = await updateQuestion(currentEditingQuestion.id, data);
    } else {
        const subjectId = document.getElementById('subjectSelectUpload').value;
        if (!subjectId) {
            alert('请先选择科目');
            return;
        }
        saveRes = await createQuestion({ subject_id: subjectId, ...data });
    }

    if (saveRes.success) {
        if (isExamEdit && typeof currentQuestions !== 'undefined') {
            const idx = currentQuestions.findIndex(q => q.id === window.currentEditingExamQuestion.id);
            if (idx !== -1) {
                currentQuestions[idx] = {
                    ...currentQuestions[idx],
                    content: question.content,
                    question_type: question.type,
                    options: question.type === 'judge' ? ['正确', '错误'] : question.options,
                    correct_answer: question.correct
                };
                
                // 重新计算已提交答案的正确性
                if (typeof answerResults !== 'undefined' && answerResults[window.currentEditingExamQuestion.id]) {
                    const userAnswer = userAnswers[window.currentEditingExamQuestion.id];
                    if (userAnswer) {
                        const isCorrect = userAnswer === question.correct;
                        answerResults[window.currentEditingExamQuestion.id] = {
                            correct: isCorrect,
                            correctAnswer: question.correct
                        };
                    }
                }
            }
            closeReimportModal();
            if (typeof renderExamContent === 'function') {
                renderExamContent();
            }
        } else {
            const subjectId = document.getElementById('subjectSelectUpload').value;
            closeReimportModal();
            if (subjectId) loadSubjectQuestions(subjectId);
        }
    } else {
        alert(saveRes.message || '操作失败');
    }
}

async function removeQuestion(questionId) {
    if (!confirm('确定要删除这道题吗？')) return;

    const res = await deleteQuestion(questionId);
    if (res.success) {
        alert('题目已删除');
        const subjectId = document.getElementById('subjectSelectUpload').value;
        if (subjectId) loadSubjectQuestions(subjectId);
    } else {
        alert(res.message || '删除失败');
    }
}

function toggleQuestionList(subjectId, btn) {
    const container = document.getElementById('questionListContainer');
    if (container.style.display === 'none') {
        loadSubjectQuestions(subjectId);
        container.style.display = 'block';
        btn.innerText = '收起试题列表';
    } else {
        container.style.display = 'none';
        btn.innerText = '查看试题列表';
    }
}