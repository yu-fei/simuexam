let currentUser = null;
let currentQuestions = [];
let userAnswers = {};
let subjectsList = [];

let currentPage = 1;
const pageSize = 50;
let answeredStatus = {};
let answerResults = {};

let isExamMode = false;
let examSubjectId = null;
let examSubjectName = '';
let currentSessionId = null;

window.onload = async () => {
    const res = await api('/api/current_user');
    if (res.logged_in) {
        currentUser = res;
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('usernameDisplay').innerText = `👤 ${res.username}`;
        document.getElementById('examUsernameDisplay').innerText = `👤 ${res.username}`;
        await loadSubjects();
        await checkInProgressExam();
    } else {
        document.getElementById('loginPage').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }
    onModeChange();
};

async function api(url, method = 'GET', data = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) opts.body = JSON.stringify(data);
    const resp = await fetch(url, opts);
    return await resp.json();
}

async function checkInProgressExam() {
    const res = await api('/api/exam/in_progress');
    if (res.success && res.session) {
        const session = res.session;
        const shouldResume = confirm(
            `检测到您有一场未完成的考试：\n` +
            `科目：${session.subject_name}\n` +
            `进度：${session.answered_count}/${session.total_questions} 题\n\n` +
            `是否继续考试？\n` +
            `点击"确定"继续考试，点击"取消"放弃考试。`
        );

        if (shouldResume) {
            await resumeExam(session.id);
        } else {
            await api('/api/exam/abandon', 'POST', { session_id: session.id });
        }
    }
}

async function resumeExam(sessionId) {
    const res = await api('/api/exam/restore', 'POST', { session_id: sessionId });
    if (!res.success) {
        alert(res.message);
        return;
    }

    currentQuestions = res.questions;
    userAnswers = {};
    answeredStatus = {};
    answerResults = {};

    res.answered_details.forEach(d => {
        userAnswers[d.question_id] = d.user_answer;
        answeredStatus[d.question_id] = true;
        answerResults[d.question_id] = {
            correct: d.is_correct,
            correctAnswer: res.questions.find(q => q.id === d.question_id)?.correct_answer || null
        };
    });

    currentPage = 1;
    examSubjectId = res.subject_id;
    currentSessionId = sessionId;

    enterExamMode(res.subject_name);
    renderExam();
}

function onModeChange() {
    const mode = document.getElementById('examMode').value;
    const countInput = document.getElementById('randomCount');
    countInput.style.display = mode === 'random' ? 'inline-block' : 'none';
}

function onSubjectSelectChange() {
    const select = document.getElementById('subjectSelectUpload');
    if (select.value) document.getElementById('newSubjectName').value = '';
}

function onNewSubjectInput() {
    const input = document.getElementById('newSubjectName');
    if (input.value.trim()) document.getElementById('subjectSelectUpload').value = '';
}

function getSelectedSubjectName() {
    const select = document.getElementById('subjectSelectUpload');
    const newName = document.getElementById('newSubjectName').value.trim();
    if (select.value) return select.options[select.selectedIndex].text.split(' (')[0];
    else if (newName) return newName;
    else return '';
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    if (!username) return alert('请输入账号');
    const res = await api('/api/login', 'POST', { username });
    if (res.success) {
        currentUser = res;
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('usernameDisplay').innerText = `👤 ${res.username}`;
        document.getElementById('examUsernameDisplay').innerText = `👤 ${res.username}`;
        await loadSubjects();
        await checkInProgressExam();
        onModeChange();
    } else alert(res.message);
}

async function handleLogout() {
    await api('/api/logout', 'POST');
    currentUser = null;
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginUsername').value = '';
}

function switchTab(tabId) {
    if (isExamMode) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById('examPanel').classList.toggle('hidden', tabId !== 'exam');
    document.getElementById('historyPanel').classList.toggle('hidden', tabId !== 'history');
    document.getElementById('adminPanel').classList.toggle('hidden', tabId !== 'admin');

    if (tabId === 'admin') {
        document.getElementById('examSettings').style.display = 'none';
        document.getElementById('examArea').innerHTML = '';
        loadSubjects();
    } else if (tabId === 'history') {
        document.getElementById('examSettings').style.display = 'none';
        document.getElementById('examArea').innerHTML = '';
        loadHistoryList();
    } else {
        document.getElementById('examSettings').style.display = 'flex';
    }
}

async function loadSubjects() {
    const res = await api('/api/subjects');
    subjectsList = res;

    const selectExam = document.getElementById('subjectSelectExam');
    selectExam.innerHTML = '<option value="">请选择科目</option>';
    const selectUpload = document.getElementById('subjectSelectUpload');
    selectUpload.innerHTML = '<option value="">-- 选择已有科目 --</option>';
    const listDiv = document.getElementById('subjectList');
    listDiv.innerHTML = '';

    res.forEach(s => {
        selectExam.add(new Option(`${s.name} (${s.question_count}题)`, s.id));
        selectUpload.add(new Option(`${s.name} (${s.question_count}题)`, s.id));
        const item = document.createElement('div');
        item.className = 'subject-item';
        item.innerHTML = `<span class="subject-name">${s.name}</span><span class="subject-count">${s.question_count}题</span>
            <button class="btn btn-danger btn-sm" onclick="deleteSubject(${s.id}, '${s.name}')">删除</button>`;
        listDiv.appendChild(item);
    });
    if (res.length === 0) listDiv.innerHTML = '<p style="color:#64748b; width:100%;">暂无科目，请先导入试题</p>';
}

async function deleteSubject(id, name) {
    if (!confirm(`确定要删除科目"${name}"及其所有试题吗？`)) return;
    const res = await api(`/api/subjects/${id}`, 'DELETE');
    if (res.success) { alert('删除成功'); loadSubjects(); }
    else alert('删除失败');
}

async function uploadQuestions(mode) {
    if (!currentUser) return alert('请先登录');
    const subjectName = getSelectedSubjectName();
    if (!subjectName) return alert('请选择已有科目或输入新科目名称');
    const fileInput = document.getElementById('questionFile');
    if (!fileInput.files[0]) return alert('请选择要上传的文件');
    if (mode === 'overwrite' && !confirm(`确定要覆盖导入吗？\n科目"${subjectName}"的所有原有试题和错题记录将被清空！`)) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('subject_name', subjectName);
    formData.append('import_mode', mode);

    const resp = await fetch('/api/upload_questions', { method: 'POST', body: formData });
    const res = await resp.json();
    const msgDiv = document.getElementById('uploadMsg');
    msgDiv.className = 'msg ' + (res.success ? 'msg-success' : 'msg-error');
    msgDiv.innerText = res.message;
    if (res.success) {
        document.getElementById('subjectSelectUpload').value = '';
        document.getElementById('newSubjectName').value = '';
        fileInput.value = '';
        loadSubjects();
    }
}

function enterExamMode(subjectName) {
    console.log('enterExamMode called, subjectName:', subjectName);

    isExamMode = true;
    examSubjectName = subjectName;

    // 隐藏正常头部，显示考试头部
    document.getElementById('normalHeader').style.display = 'none';
    document.getElementById('examHeader').style.display = 'block';

    // 隐藏考试设置区域
    document.getElementById('examSettings').style.display = 'none';

    // 确保考试面板可见
    document.getElementById('examPanel').classList.remove('hidden');

    // 添加考试模式类
    document.getElementById('mainApp').classList.add('exam-mode');

    console.log('enterExamMode completed');
}

function exitExam(showConfirm = true) {
    if (showConfirm) {
        if (!confirm('确定要退出考试吗？未完成的答题进度将丢失。')) {
            return;
        }
    }

    if (showConfirm && currentSessionId) {
        api('/api/exam/abandon', 'POST', { session_id: currentSessionId });
    }

    isExamMode = false;
    currentQuestions = [];
    userAnswers = {};
    answeredStatus = {};
    answerResults = {};
    currentPage = 1;
    currentSessionId = null;

    document.getElementById('normalHeader').style.display = 'block';
    document.getElementById('examHeader').style.display = 'none';
    document.getElementById('examSettings').style.display = 'flex';
    document.getElementById('examArea').innerHTML = '';
    document.getElementById('mainApp').classList.remove('exam-mode');

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="exam"]').classList.add('active');
    document.getElementById('examPanel').classList.remove('hidden');
    document.getElementById('historyPanel').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
}

async function startExam() {
    if (!currentUser) return alert('请登录');
    const subjectSelect = document.getElementById('subjectSelectExam');
    const subjectId = subjectSelect.value;
    if (!subjectId) return alert('请选择科目');
    const subjectName = subjectSelect.options[subjectSelect.selectedIndex].text.split(' (')[0];
    const mode = document.getElementById('examMode').value;
    const count = parseInt(document.getElementById('randomCount').value) || 10;

    const res = await api('/api/exam/start', 'POST', { subject_id: subjectId, mode, count });
    if (!res.success) return alert(res.message);

    currentQuestions = res.questions;
    userAnswers = {};
    answeredStatus = {};
    answerResults = {};
    currentPage = 1;
    examSubjectId = subjectId;
    currentSessionId = res.session_id;
    enterExamMode(subjectName);
    renderExam();
}

function getCurrentPageQuestions() {
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, currentQuestions.length);
    return currentQuestions.slice(start, end);
}

function getTotalPages() {
    return Math.ceil(currentQuestions.length / pageSize);
}

function renderPagination(top = false) {
    const totalPages = getTotalPages();
    if (totalPages <= 1) return '';
    const startNum = (currentPage - 1) * pageSize + 1;
    const endNum = Math.min(currentPage * pageSize, currentQuestions.length);
    let html = `<div class="pagination ${top ? 'pagination-top' : ''}">`;
    html += `<span class="page-info">第 ${startNum}-${endNum} 题 / 共 ${currentQuestions.length} 题</span>`;
    html += `<button class="btn btn-sm" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹ 上一页</button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    if (startPage > 1) {
        html += `<button class="btn btn-sm" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span style="padding:0 4px;">...</span>`;
    }
    for (let i = startPage; i <= endPage; i++) {
        html += i === currentPage ? `<button class="btn btn-primary btn-sm" disabled>${i}</button>` : `<button class="btn btn-sm" onclick="goToPage(${i})">${i}</button>`;
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding:0 4px;">...</span>`;
        html += `<button class="btn btn-sm" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    html += `<button class="btn btn-sm" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页 ›</button>`;
    html += '</div>';
    return html;
}

function goToPage(page) {
    const totalPages = getTotalPages();
    if (page < 1 || page > totalPages) return;
    saveCurrentPageAnswers();
    currentPage = page;
    renderExamContent();
    document.getElementById('examArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveCurrentPageAnswers() {
    const pageQuestions = getCurrentPageQuestions();
    pageQuestions.forEach(q => {
        if (answeredStatus[q.id]) return;

        if (q.type === 'judge' || q.type === 'single') {
            const selected = document.querySelector(`input[name="q${q.id}"]:checked`);
            if (selected) userAnswers[q.id] = selected.value;
        } else if (q.type === 'multiple') {
            const checked = Array.from(document.querySelectorAll(`input[name="q${q.id}"]:checked`)).map(cb => cb.value).join('');
            if (checked) userAnswers[q.id] = checked;
        }
    });
}

function renderExam() { renderExamContent(); }

function renderExamContent() {
    const area = document.getElementById('examArea');
    if (currentQuestions.length === 0) { area.innerHTML = '<p style="padding:20px; color:#64748b;">暂无题目</p>'; return; }

    const totalPages = getTotalPages();
    const pageQuestions = getCurrentPageQuestions();
    const globalIndex = (currentPage - 1) * pageSize;
    let html = `<div class="exam-header"><div class="exam-stats">📊 共 ${currentQuestions.length} 道题`;
    const answeredCount = Object.keys(answeredStatus).length;
    if (answeredCount > 0) html += ` | 已答 ${answeredCount} 题`;
    html += `</div>`;
    if (totalPages > 1) html += `<div class="exam-stats">📄 第 ${currentPage}/${totalPages} 页</div>`;
    html += `</div>`;
    if (totalPages > 1) html += renderPagination(true);

    pageQuestions.forEach((q, idx) => {
        const questionNumber = globalIndex + idx + 1;
        const savedAnswer = userAnswers[q.id] || '';
        const isAnswered = answeredStatus[q.id] || false;
        const result = answerResults[q.id];
        const disabledAttr = isAnswered ? 'disabled' : '';

        html += `<div class="question-box" id="question-${q.id}"><strong style="font-size:16px;">${questionNumber}. ${q.content}</strong>`;
        if (isAnswered) html += ` <span style="color:#0f7b4e; font-size:13px; margin-left:8px;">✓ 已答</span>`;

        if (q.type === 'judge') {
            html += `<div style="margin-top:16px;">
                <label class="option"><input type="radio" name="q${q.id}" value="正确" onchange="recordAnswer(${q.id}, '正确')" ${savedAnswer === '正确' ? 'checked' : ''} ${disabledAttr}> 正确</label>
                <label class="option"><input type="radio" name="q${q.id}" value="错误" onchange="recordAnswer(${q.id}, '错误')" ${savedAnswer === '错误' ? 'checked' : ''} ${disabledAttr}> 错误</label></div>`;
        } else {
            html += '<div style="margin-top:16px;">';
            q.options.forEach(opt => {
                const letter = opt.charAt(0);
                const inputType = q.type === 'multiple' ? 'checkbox' : 'radio';
                const checked = q.type === 'multiple' ? savedAnswer.includes(letter) : savedAnswer === letter;
                html += `<label class="option"><input type="${inputType}" name="q${q.id}" value="${letter}" onchange="handleOptionChange(${q.id}, '${letter}', '${inputType}')" ${checked ? 'checked' : ''} ${disabledAttr}> ${opt}</label>`;
            });
            html += '</div>';
        }
        html += `<div style="margin-top:16px; display:flex; align-items:center; gap:16px;">
            <button class="btn btn-primary btn-sm" onclick="submitAnswer(${q.id})" ${disabledAttr}>提交本题</button><span id="result-${q.id}">`;
        if (result) {
            html += result.correct ? '<span style="color:#0f7b4e; font-weight:500;">✅ 正确</span>' : `<span style="color:#dc2626; font-weight:500;">❌ 错误 (正确答案: ${result.correctAnswer})</span>`;
        }
        html += `</span></div></div>`;
    });

    if (totalPages > 1) html += renderPagination(false);
    html += `<div style="margin-top:24px; display:flex; gap:16px;"><button class="btn btn-success" onclick="finishExam()">完成考试</button></div>`;
    area.innerHTML = html;
}

window.recordAnswer = (qid, val) => { userAnswers[qid] = val; };
window.handleOptionChange = (qid, val, type) => {
    if (type === 'radio') userAnswers[qid] = val;
    else {
        const checked = Array.from(document.querySelectorAll(`input[name="q${qid}"]:checked`)).map(cb => cb.value).join('');
        userAnswers[qid] = checked;
    }
};

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
        const submitBtn = questionBox.querySelector('button');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
        }
    }
}

function updateStats() {
    const statsDiv = document.querySelector('.exam-stats');
    if (statsDiv) {
        const answeredCount = Object.keys(answeredStatus).length;
        statsDiv.innerHTML = `📊 共 ${currentQuestions.length} 道题 | 已答 ${answeredCount} 题`;
    }
}

async function autoSubmitUnanswered() {
    saveCurrentPageAnswers();
    const promises = [];
    for (const q of currentQuestions) {
        const ans = userAnswers[q.id];
        if (ans && !answeredStatus[q.id]) {
            promises.push((async () => {
                const res = await api('/api/exam/submit_answer', 'POST', { question_id: q.id, answer: ans });
                answeredStatus[q.id] = true;
                answerResults[q.id] = { correct: res.is_correct, correctAnswer: res.correct_answer };
            })());
        }
    }
    if (promises.length > 0) await Promise.all(promises);
}

async function finishExam() {
    await autoSubmitUnanswered();
    const totalAnswered = Object.keys(answeredStatus).length;
    const correctCount = Object.values(answerResults).filter(r => r.correct).length;
    if (currentSessionId) {
        await api('/api/exam/finish', 'POST', { answered_count: totalAnswered, correct_count: correctCount });
    }
    alert(`考试完成！\n共 ${currentQuestions.length} 题，已答 ${totalAnswered} 题，答对 ${correctCount} 题`);
    exitExam(false);
}

// ==================== 考试记录功能 ====================

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