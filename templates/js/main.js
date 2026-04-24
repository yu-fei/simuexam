// 引入路由管理器
const script = document.createElement('script');
script.src = '/static/js/router.js';
document.head.appendChild(script);

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
        
        // 初始化应用（使用新的路由管理器）
        setTimeout(() => {
            if (typeof initApp === 'function') {
                initApp();
            } else {
                // 备用：如果router.js加载失败，使用旧逻辑
                const hash = window.location.hash.slice(1);
                if (hash === 'exam-mode') {
                    handleExamMode();
                } else {
                    handleHashChange();
                }
            }
        }, 100);
    } else {
        document.getElementById('loginPage').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }
    onModeChange();
};

// 处理考试模式
async function handleExamMode() {
    const examRes = await api('/api/exam/in_progress');
    if (examRes.success && examRes.session) {
        await resumeExam(examRes.session.id);
    } else {
        window.location.hash = 'exam';
        handleHashChange();
    }
}

// 监听滚动事件，保存滚动位置
window.addEventListener('scroll', () => {
    if (isExamMode) {
        localStorage.setItem('examScrollPosition', window.scrollY.toString());
    }
});

// 旧的hash处理函数（备用）
function handleHashChange() {
    const hash = window.location.hash.slice(1) || 'exam';

    if (isExamMode || hash === 'exam-mode') return;

    if (hash.startsWith('view/')) {
        const parts = hash.split('/');
        if (parts.length >= 3) {
            const subjectId = parts[1];
            const subjectName = decodeURIComponent(parts.slice(2).join('/'));

            if (currentUser && document.getElementById('adminPanel')) {
                document.getElementById('adminPanel').classList.add('hidden');
                loadSubjectQuestions(subjectId, subjectName);
            }
        }
        return;
    }

    if (hash === 'exam' || hash === 'history' || hash === 'admin') {
        switchTab(hash);
    } else if (hash === 'exam') {
        switchTab('exam');
    }
}

async function api(url, method = 'GET', data = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) opts.body = JSON.stringify(data);
    const resp = await fetch(url, opts);
    return await resp.json();
}

async function checkInProgressExam() {
    try {
        const res = await api('/api/exam/in_progress');
        console.log('checkInProgressExam:', res);
        if (res.success && res.session) {
            // 只有在考试模式下才自动恢复考试
            // 这样点击考试标签时显示设置页面，刷新时也不会强制进入考试
            // 只有从历史记录点击继续考试时才进入考试模式
        }
    } catch (error) {
        console.error('checkInProgressExam error:', error);
    }
}

async function resumeExam(sessionId) {
    try {
        const res = await api('/api/exam/restore', 'POST', { session_id: sessionId });
        console.log('resumeExam:', res);
        if (!res.success) {
            console.error('resumeExam failed:', res.message);
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

        currentPage = res.current_page || 1;
        examSubjectId = res.subject_id;
        currentSessionId = sessionId;

        enterExamMode(res.subject_name);
        renderExam();
        
        // 恢复滚动位置
        const scrollPosition = localStorage.getItem('examScrollPosition');
        if (scrollPosition) {
            setTimeout(() => {
                window.scrollTo(0, parseInt(scrollPosition));
            }, 100);
        }
    } catch (error) {
        console.error('resumeExam error:', error);
    }
}

function onModeChange() {
    const mode = document.getElementById('examMode').value;
    const countInput = document.getElementById('randomCount');
    countInput.style.display = mode === 'random' ? 'inline-block' : 'none';
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
        // 使用新的路由管理器
        if (typeof initApp === 'function') {
            initApp();
        } else {
            handleHashChange();
        }
        onModeChange();
    } else alert(res.message);
}

async function handleLogout() {
    await api('/api/logout', 'POST');
    currentUser = null;
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginUsername').value = '';
    window.location.hash = '';
}

function switchTab(tabId) {
    if (isExamMode) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    // 使用面板管理器
    if (typeof panelManager !== 'undefined' && panelManager) {
        panelManager.showPanel(tabId);
    } else {
        // 备用：使用旧逻辑
        document.getElementById('examPanel').classList.toggle('hidden', tabId !== 'exam');
        document.getElementById('historyPanel').classList.toggle('hidden', tabId !== 'history');
        document.getElementById('adminPanel').classList.toggle('hidden', tabId !== 'admin');
    }

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

    window.location.hash = tabId;
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
            <button class="btn btn-sm" onclick="loadSubjectQuestions(${s.id}, '${s.name}')">查看试题列表</button>
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
    isExamMode = true;
    examSubjectName = subjectName;
    window.location.hash = 'exam-mode';

    document.getElementById('normalHeader').style.display = 'none';
    document.getElementById('examHeader').style.display = 'block';
    document.getElementById('examSettings').style.display = 'none';
    document.getElementById('examPanel').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('exam-mode');
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

    window.location.hash = 'exam';

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

    window.location.hash = 'exam';
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
    if (currentSessionId) {
        saveExamPage(currentSessionId, currentPage);
    }
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

        html += `<div style="margin-top:8px;">
            <button class="btn btn-sm" onclick="editQuestionInExam(${q.id})">编辑</button>
            <button class="btn btn-danger btn-sm" onclick="deleteQuestionInExam(${q.id})">删除</button>
        </div>`;

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