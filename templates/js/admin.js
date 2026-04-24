let currentSubjectQuestions = [];
let currentEditingQuestion = null;
let currentViewingSubject = null;
let questionListPage = 1;
const questionListPageSize = 50;

async function loadSubjectQuestions(subjectId, subjectName) {
    const res = await getQuestionsBySubject(subjectId);
    if (res.success) {
        currentSubjectQuestions = res.questions;
        currentViewingSubject = { id: subjectId, name: subjectName };
        questionListPage = 1;

        window.location.hash = `view/${subjectId}/${encodeURIComponent(subjectName)}`;
        
        // 使用面板管理器
        if (typeof panelManager !== 'undefined' && panelManager) {
            panelManager.showQuestionList();
        } else {
            // 备用：使用旧逻辑
            document.getElementById('adminPanel').classList.add('hidden');
            document.getElementById('questionListPanel').classList.remove('hidden');
        }
        
        document.getElementById('questionListTitle').innerText = `📚 ${subjectName} - 试题列表`;
        renderQuestionList();

        // 恢复滚动位置
        const savedScroll = localStorage.getItem(`questionListScroll_${subjectId}`);
        if (savedScroll !== null) {
            const scrollPercent = parseFloat(savedScroll);
            setTimeout(() => {
                const maxScroll = document.body.scrollHeight - window.innerHeight;
                window.scrollTo(0, maxScroll * scrollPercent);
            }, 100);
        }
    }
}

function saveQuestionListScroll() {
    if (currentViewingSubject) {
        const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        localStorage.setItem(`questionListScroll_${currentViewingSubject.id}`, scrollPercent.toString());
    }
}

function showQuestionListPage(subjectName) {
    // 此函数已被loadSubjectQuestions整合
    document.getElementById('questionListTitle').innerText = `📚 ${subjectName} - 试题列表`;
    renderQuestionList();
}

function backToAdmin() {
    // 使用面板管理器
    if (typeof panelManager !== 'undefined' && panelManager) {
        panelManager.showAdmin();
    } else {
        // 备用：使用旧逻辑
        document.getElementById('questionListPanel').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
    }
    currentViewingSubject = null;
    
    // 使用状态管理器
    if (typeof stateManager !== 'undefined' && stateManager) {
        stateManager.updateState({ currentViewingSubject: null });
    }
    
    window.location.hash = 'admin';
}

function renderQuestionList() {
    const container = document.getElementById('questionListArea');
    if (!container) return;

    if (currentSubjectQuestions.length === 0) {
        container.innerHTML = '<p style="color:#64748b; padding:12px;">暂无试题</p>';
        return;
    }

    const totalPages = Math.ceil(currentSubjectQuestions.length / questionListPageSize);
    const startIndex = (questionListPage - 1) * questionListPageSize;
    const endIndex = Math.min(startIndex + questionListPageSize, currentSubjectQuestions.length);
    const pageQuestions = currentSubjectQuestions.slice(startIndex, endIndex);

    let html = '<div class="question-list">';
    pageQuestions.forEach((q, idx) => {
        const typeLabel = q.question_type === 'judge' ? '判断' : (q.question_type === 'multiple' ? '多选' : '单选');
        const typeClass = q.question_type === 'judge' ? 'type-judge' : (q.question_type === 'multiple' ? 'type-multiple' : 'type-single');
        const globalIndex = startIndex + idx + 1;
        html += `<div class="question-item">
            <div class="question-info">
                <span class="question-num">${globalIndex}.</span>
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

    if (totalPages > 1) {
        html += '<div class="pagination">';
        html += `<span class="page-info">${startIndex + 1}-${endIndex} / 共 ${currentSubjectQuestions.length} 题</span>`;
        html += `<button class="btn btn-sm" onclick="goToQuestionPage(${questionListPage - 1})" ${questionListPage === 1 ? 'disabled' : ''}>‹ 上一页</button>`;

        const maxVisible = 5;
        let startPage = Math.max(1, questionListPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

        if (startPage > 1) {
            html += `<button class="btn btn-sm" onclick="goToQuestionPage(1)">1</button>`;
            if (startPage > 2) html += '<span style="padding:0 4px;">...</span>';
        }
        for (let i = startPage; i <= endPage; i++) {
            html += i === questionListPage ? `<button class="btn btn-primary btn-sm" disabled>${i}</button>` : `<button class="btn btn-sm" onclick="goToQuestionPage(${i})">${i}</button>`;
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += '<span style="padding:0 4px;">...</span>';
            html += `<button class="btn btn-sm" onclick="goToQuestionPage(${totalPages})"></button>`;
        }

        html += `<button class="btn btn-sm" onclick="goToQuestionPage(${questionListPage + 1})" ${questionListPage === totalPages ? 'disabled' : ''}>下一页 ›</button>`;
        html += '</div>';
    }

    container.innerHTML = html;
}

function goToQuestionPage(page) {
    const totalPages = Math.ceil(currentSubjectQuestions.length / questionListPageSize);
    if (page < 1 || page > totalPages) return;
    questionListPage = page;
    renderQuestionList();
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
        if (!currentViewingSubject) {
            alert('请先选择科目');
            return;
        }
        saveRes = await createQuestion({ subject_id: currentViewingSubject.id, ...data });
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
            closeReimportModal();
            if (currentViewingSubject) {
                loadSubjectQuestions(currentViewingSubject.id, currentViewingSubject.name);
            }
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
        if (currentViewingSubject) {
            loadSubjectQuestions(currentViewingSubject.id, currentViewingSubject.name);
        }
    } else {
        alert(res.message || '删除失败');
    }
}