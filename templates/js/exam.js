async function submitAnswer(qid) {
    const ans = userAnswers[qid] || '';
    if (!ans) return alert('请先选择答案');
    const res = await api('/api/exam/submit_answer', 'POST', { question_id: qid, answer: ans });
    const span = document.getElementById(`result-${qid}`);

    answeredStatus[qid] = true;
    answerResults[qid] = { correct: res.is_correct, correctAnswer: res.correct_answer };

    if (res.is_correct) {
        span.innerHTML = '<span style="color:#0f7b4e; font-weight:500;">✅ 正确</span>';
    } else {
        span.innerHTML = `<span style="color:#dc2626; font-weight:500;">❌ 错误 (正确答案: ${res.correct_answer})</span>`;
    }

    updateStats();

    const questionBox = document.querySelector(`#question-${qid}`);
    if (questionBox) {
        const titleEl = questionBox.querySelector('strong');
        if (titleEl && !titleEl.innerHTML.includes('✓ 已答')) {
            titleEl.innerHTML += ' <span style="color:#0f7b4e; font-size:13px; margin-left:8px;">✓ 已答</span>';
        }
        const inputs = questionBox.querySelectorAll('input');
        inputs.forEach(input => input.disabled = true);
        const submitBtn = questionBox.querySelector('button.btn-primary');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
        }
    }
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

async function editQuestionInExam(qid) {
    const question = currentQuestions.find(q => q.id === qid);
    if (!question) {
        alert('题目不存在');
        return;
    }

    const questionData = await getQuestion(qid);
    if (!questionData.success) {
        alert('获取题目失败');
        return;
    }

    window.currentEditingExamQuestion = questionData.question;
    
    document.getElementById('reimportModalTitle').innerText = '编辑题目';
    const txt = questionToTxt(questionData.question);
    document.getElementById('reimportContent').value = txt;
    document.getElementById('reimportModal').style.display = 'flex';
}

async function deleteQuestionInExam(qid) {
    if (!confirm('确定要删除这道题吗？删除后无法恢复。')) return;

    const res = await deleteQuestion(qid);
    if (res.success) {
        alert('题目已删除');
        currentQuestions = currentQuestions.filter(q => q.id !== qid);
        if (currentQuestions.length === 0) {
            alert('没有更多题目了');
            exitExam(false);
        } else {
            if (currentPage > getTotalPages()) {
                currentPage = getTotalPages();
            }
            renderExamContent();
        }
    } else {
        alert(res.message || '删除失败');
    }
}