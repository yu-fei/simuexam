async function loadHistoryList() {
    const historyDiv = document.getElementById('historyList');
    const detailDiv = document.getElementById('historyDetail');
    historyDiv.style.display = 'block';
    detailDiv.style.display = 'none';
    detailDiv.innerHTML = '';

    const res = await api('/api/exam/sessions');
    if (!res.success) { historyDiv.innerHTML = '<p class="empty-state">加载失败</p>'; return; }
    const sessions = res.sessions;
    if (sessions.length === 0) {
        historyDiv.innerHTML = '<div class="empty-state"><p>📭 暂无考试记录</p><p style="font-size:14px; margin-top:8px;">完成考试后记录会显示在这里</p></div>';
        return;
    }

    let html = '<div class="history-list">';
    sessions.forEach(s => {
        const date = s.start_time;
        const modeText = { 'all': '全量考题', 'random': '随机数量', 'wrong': '错题集', 'new': '未考过题', 'custom': '自定义' }[s.exam_mode] || s.exam_mode;
        const isInProgress = s.status === 'in_progress';

        html += `<div class="history-item" onclick="viewSessionDetail(${s.id})">
            <div class="history-info">
                <div class="history-title">
                    ${s.subject_name} · ${modeText}
                    ${isInProgress ? '<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:20px; font-size:12px; margin-left:8px;">进行中</span>' : ''}
                </div>
                <div class="history-meta"><span>📅 ${date}</span><span>📝 ${s.answered_count}/${s.total_questions} 题</span><span>✅ 答对 ${s.correct_count} 题</span></div>
            </div>
            <div class="history-stats">
                ${isInProgress ?
                    `<button class="btn btn-success btn-sm" onclick="event.stopPropagation(); resumeExam(${s.id})">继续考试</button>` :
                    `<div class="history-score ${s.correct_count > 0 ? 'correct' : ''}"><div class="score-number">${s.correct_count}/${s.answered_count}</div><div class="history-accuracy">正确率 ${s.accuracy}%</div></div>`
                }
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteSession(${s.id})">删除</button>
            </div>
        </div>`;
    });
    html += '</div>';
    historyDiv.innerHTML = html;
}

async function deleteSession(sessionId) {
    if (!confirm('确定要删除这条考试记录吗？')) return;
    const res = await api(`/api/exam/sessions/${sessionId}`, 'DELETE');
    if (res.success) loadHistoryList(); else alert('删除失败');
}

async function viewSessionDetail(sessionId) {
    const res = await api(`/api/exam/sessions/${sessionId}`);
    if (!res.success) { alert(res.message); return; }

    const session = res.session;
    const historyDiv = document.getElementById('historyList');
    const detailDiv = document.getElementById('historyDetail');
    historyDiv.style.display = 'none';
    detailDiv.style.display = 'block';

    const date = session.start_time;
    const modeText = { 'all': '全量考题', 'random': '随机数量', 'wrong': '错题集', 'new': '未考过题', 'custom': '自定义' }[session.exam_mode] || session.exam_mode;
    const wrongCount = session.wrong_count;
    const unansweredCount = session.unanswered_count;

    let html = `
        <div class="back-btn"><button class="btn btn-sm" onclick="backToHistoryList()">← 返回列表</button></div>
        <div style="margin-bottom: 20px;"><h3 style="margin-bottom: 8px;">${session.subject_name} · ${modeText}</h3>
        <div style="color: #64748b; font-size: 14px;">📅 ${date} | 📝 本次考试 ${session.total_questions} 题</div></div>
        <div class="stat-cards">
            <div class="stat-card"><div class="stat-label">已答题数</div><div class="stat-value">${session.answered_count}</div></div>
            <div class="stat-card green"><div class="stat-label">答对数</div><div class="stat-value">${session.correct_count}</div></div>
            <div class="stat-card red"><div class="stat-label">答错数</div><div class="stat-value">${wrongCount}</div></div>
            <div class="stat-card yellow"><div class="stat-label">未答数</div><div class="stat-value">${unansweredCount}</div></div>
            <div class="stat-card blue"><div class="stat-label">正确率</div><div class="stat-value">${session.accuracy}%</div></div>
        </div>
        <div class="retake-buttons">
            <button class="btn btn-primary" onclick="retakeExam(${session.subject_id}, '${session.subject_name}', 'all', ${sessionId})">📝 再考一次（全量）</button>
            <button class="btn btn-warning" onclick="retakeExam(${session.subject_id}, '${session.subject_name}', 'wrong', ${sessionId})" ${wrongCount === 0 ? 'disabled' : ''}>❌ 只考错题 (${wrongCount}题)</button>
            <button class="btn btn-info" onclick="retakeExam(${session.subject_id}, '${session.subject_name}', 'unanswered', ${sessionId})" ${unansweredCount === 0 ? 'disabled' : ''}>📋 只考未答题 (${unansweredCount}题)</button>
            <button class="btn btn-success" onclick="retakeExam(${session.subject_id}, '${session.subject_name}', 'wrong_unanswered', ${sessionId})" ${(wrongCount + unansweredCount) === 0 ? 'disabled' : ''}>🔄 错题+未答题 (${wrongCount + unansweredCount}题)</button>
        </div>
        <div class="filter-bar">
            <label>筛选：</label>
            <select id="detailFilter" onchange="filterDetailQuestions()">
                <option value="all">全部题目</option>
                <option value="wrong">只看错题</option>
                <option value="correct">只看正确</option>
                <option value="unanswered">只看未答</option>
            </select>
            <span style="margin-left: auto; color: #64748b;" id="filterCount"></span>
        </div>
        <div id="detailQuestionsContainer"></div>
    `;
    detailDiv.innerHTML = html;
    window.currentDetailQuestions = session.questions;
    window.currentSessionData = session;
    renderDetailQuestions('all');
}

async function retakeExam(subjectId, subjectName, retakeMode, sessionId) {
    if (!currentUser) return alert('请先登录');
    const res = await api(`/api/exam/sessions/${sessionId}`);
    if (!res.success) { alert('获取考试记录失败'); return; }

    const session = res.session;
    const questions = session.questions;
    let questionIds = [];

    if (retakeMode === 'all') questionIds = questions.map(q => q.id);
    else if (retakeMode === 'wrong') questionIds = questions.filter(q => q.answered && !q.is_correct).map(q => q.id);
    else if (retakeMode === 'unanswered') questionIds = questions.filter(q => !q.answered).map(q => q.id);
    else if (retakeMode === 'wrong_unanswered') questionIds = questions.filter(q => !q.answered || (q.answered && !q.is_correct)).map(q => q.id);

    if (questionIds.length === 0) { alert('没有可考的题目'); return; }

    const examRes = await api('/api/exam/start_custom', 'POST', { subject_id: subjectId, question_ids: questionIds });
    if (!examRes.success) { alert(examRes.message); return; }
    if (examRes.questions.length === 0) { alert('没有可考的题目'); return; }

    currentQuestions = examRes.questions;
    userAnswers = {};
    answeredStatus = {};
    answerResults = {};
    currentPage = 1;
    examSubjectId = subjectId;
    currentSessionId = examRes.session_id;
    document.getElementById('historyDetail').style.display = 'none';
    document.getElementById('historyDetail').innerHTML = '';
    enterExamMode(subjectName);
    renderExam();
}

function backToHistoryList() {
    document.getElementById('historyList').style.display = 'block';
    document.getElementById('historyDetail').style.display = 'none';
    document.getElementById('historyDetail').innerHTML = '';
}

function filterDetailQuestions() {
    const filter = document.getElementById('detailFilter').value;
    renderDetailQuestions(filter);
}

function renderDetailQuestions(filter) {
    const questions = window.currentDetailQuestions || [];
    const container = document.getElementById('detailQuestionsContainer');
    let filteredQuestions = questions;

    if (filter === 'wrong') filteredQuestions = questions.filter(q => q.answered && !q.is_correct);
    else if (filter === 'correct') filteredQuestions = questions.filter(q => q.answered && q.is_correct);
    else if (filter === 'unanswered') filteredQuestions = questions.filter(q => !q.answered);

    document.getElementById('filterCount').innerText = `共 ${filteredQuestions.length} 题`;
    if (filteredQuestions.length === 0) { container.innerHTML = '<div class="empty-state"><p>📭 没有符合条件的题目</p></div>'; return; }

    let html = '';
    filteredQuestions.forEach((q, idx) => {
        const isAnswered = q.answered;
        const isCorrect = q.is_correct;
        let statusClass = '', statusText = '', statusColor = '';
        if (isAnswered) {
            statusClass = isCorrect ? 'correct-answer' : 'wrong-answer';
            statusText = isCorrect ? '✅ 回答正确' : '❌ 回答错误';
            statusColor = isCorrect ? 'correct' : 'wrong';
        } else {
            statusText = '⏳ 未作答';
        }
        html += `<div class="detail-question ${statusClass}"><div class="detail-header"><strong>${idx + 1}. ${q.content}</strong><span class="detail-status ${statusColor}">${statusText}</span></div>`;
        if (q.options && q.options.length > 0) {
            html += '<div style="margin: 12px 0;">';
            q.options.forEach(opt => { html += `<div style="margin: 6px 0;">${opt}</div>`; });
            html += '</div>';
        } else if (q.question_type === 'judge') html += '<div style="margin: 12px 0;">正确 / 错误</div>';

        html += `<div class="detail-answer">`;
        if (isAnswered) {
            html += `<div>你的答案：<span class="user-answer">${q.user_answer || ''}</span></div>`;
            if (!isCorrect) html += `<div>正确答案：<span class="correct-answer">${q.correct_answer}</span></div>`;
            html += `<div style="color: #94a3b8; font-size: 12px; margin-top: 8px;">提交时间：${q.submit_time || ''}</div>`;
        } else {
            html += `<div style="color: #94a3b8;">未作答</div><div>正确答案：<span class="correct-answer">${q.correct_answer}</span></div>`;
        }
        html += `</div></div>`;
    });
    container.innerHTML = html;
}