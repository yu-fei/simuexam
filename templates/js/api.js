async function api(url, method = 'GET', data = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) opts.body = JSON.stringify(data);
    const resp = await fetch(url, opts);
    return await resp.json();
}

async function getQuestionsBySubject(subjectId) {
    return await api(`/api/subjects/${subjectId}/questions`);
}

async function getQuestion(questionId) {
    return await api(`/api/questions/${questionId}`);
}

async function updateQuestion(questionId, data) {
    return await api(`/api/questions/${questionId}`, 'PUT', data);
}

async function createQuestion(data) {
    return await api('/api/questions', 'POST', data);
}

async function deleteQuestion(questionId) {
    return await api(`/api/questions/${questionId}`, 'DELETE');
}

async function parseQuestion(content) {
    return await api('/api/questions/parse', 'POST', { content });
}

async function uploadQuestions(formData) {
    const resp = await fetch('/api/upload_questions', { method: 'POST', body: formData });
    return await resp.json();
}

async function saveExamPage(sessionId, page) {
    return await api('/api/exam/save_page', 'POST', { session_id: sessionId, current_page: page });
}