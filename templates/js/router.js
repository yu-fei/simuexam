// 路由管理器
class Router {
    constructor() {
        this.routes = {
            'exam': this.handleExam,
            'history': this.handleHistory,
            'admin': this.handleAdmin,
            'view': this.handleView
        };
        this.currentRoute = null;
        this.state = this.loadState();
        
        window.addEventListener('hashchange', () => this.handleHashChange());
        window.addEventListener('scroll', () => this.saveScrollPosition());
    }

    loadState() {
        const savedState = localStorage.getItem('appState');
        return savedState ? JSON.parse(savedState) : {
            activeTab: 'exam',
            scrollPositions: {},
            currentViewingSubject: null
        };
    }

    saveState() {
        localStorage.setItem('appState', JSON.stringify(this.state));
    }

    saveScrollPosition() {
        if (this.currentRoute) {
            this.state.scrollPositions[this.currentRoute] = window.scrollY;
            this.saveState();
        }
    }

    restoreScrollPosition() {
        const scrollPosition = this.state.scrollPositions[this.currentRoute];
        if (scrollPosition !== undefined) {
            setTimeout(() => {
                window.scrollTo(0, scrollPosition);
            }, 100);
        }
    }

    handleHashChange() {
        const hash = window.location.hash.slice(1) || 'exam';
        
        if (isExamMode || hash === 'exam-mode') {
            // 如果是考试模式，调用handleExamMode函数恢复考试状态
            if (typeof handleExamMode === 'function') {
                handleExamMode();
            }
            return;
        }

        let route, params;
        if (hash.startsWith('view/')) {
            route = 'view';
            params = hash.split('/').slice(1);
        } else {
            route = hash;
            params = [];
        }

        if (this.routes[route]) {
            this.currentRoute = route;
            this.routes[route].call(this, params);
            this.state.activeTab = route === 'view' ? 'admin' : route;
            this.saveState();
            // 对于view路由，不在这里恢复滚动位置，因为handleView会处理
            if (route !== 'view') {
                this.restoreScrollPosition();
            }
        }
    }

    handleExam() {
        switchTab('exam');
    }

    handleHistory() {
        switchTab('history');
    }

    handleAdmin() {
        switchTab('admin');
    }

    handleView(params) {
        if (params.length >= 2) {
            const subjectId = params[0];
            const subjectName = decodeURIComponent(params.slice(1).join('/'));
            
            if (currentUser && document.getElementById('adminPanel')) {
                // 激活试题管理标签（只添加active类，不设置hash）
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelector('[data-tab="admin"]').classList.add('active');
                
                document.getElementById('adminPanel').classList.add('hidden');
                
                // 直接显示试题列表，通过API获取数据
                getQuestionsBySubject(subjectId).then(res => {
                    if (res.success) {
                        currentSubjectQuestions = res.questions;
                        currentViewingSubject = { id: subjectId, name: subjectName };
                        questionListPage = 1;

                        // 显示试题列表面板
                        if (typeof panelManager !== 'undefined' && panelManager) {
                            panelManager.showQuestionList();
                        } else {
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
                });
                
                this.state.currentViewingSubject = { id: subjectId, name: subjectName };
                this.saveState();
            }
        }
    }

    init() {
        this.handleHashChange();
    }
}

// 状态管理器
class StateManager {
    constructor() {
        this.state = {
            currentUser: null,
            currentQuestions: [],
            userAnswers: {},
            subjectsList: [],
            currentPage: 1,
            answeredStatus: {},
            answerResults: {},
            isExamMode: false,
            examSubjectId: null,
            examSubjectName: '',
            currentSessionId: null,
            currentViewingSubject: null,
            currentSubjectQuestions: [],
            currentEditingQuestion: null,
            questionListPage: 1
        };
        this.loadState();
    }

    loadState() {
        const savedState = localStorage.getItem('appState');
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            Object.assign(this.state, parsedState);
        }
    }

    saveState() {
        localStorage.setItem('appState', JSON.stringify(this.state));
    }

    updateState(newState) {
        Object.assign(this.state, newState);
        this.saveState();
    }

    getState() {
        return this.state;
    }
}

// 面板管理器
class PanelManager {
    constructor() {
        this.panels = {
            exam: document.getElementById('examPanel'),
            history: document.getElementById('historyPanel'),
            admin: document.getElementById('adminPanel'),
            questionList: document.getElementById('questionListPanel')
        };
    }

    showPanel(panelId) {
        Object.keys(this.panels).forEach(key => {
            if (this.panels[key]) {
                this.panels[key].classList.add('hidden');
            }
        });
        
        if (this.panels[panelId]) {
            this.panels[panelId].classList.remove('hidden');
        }
    }

    showQuestionList() {
        this.showPanel('questionList');
    }

    showAdmin() {
        this.showPanel('admin');
    }

    showExam() {
        this.showPanel('exam');
    }

    showHistory() {
        this.showPanel('history');
    }
}

// 全局实例
let router = null;
let stateManager = null;
let panelManager = null;

// 初始化
function initApp() {
    router = new Router();
    stateManager = new StateManager();
    panelManager = new PanelManager();
    router.init();
}

// 重写现有函数
function switchTab(tabId) {
    if (isExamMode) return;
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    panelManager.showPanel(tabId);
    
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

function backToAdmin() {
    panelManager.showAdmin();
    currentViewingSubject = null;
    stateManager.updateState({ currentViewingSubject: null });
    window.location.hash = 'admin';
}

function loadSubjectQuestions(subjectId, subjectName) {
    return getQuestionsBySubject(subjectId).then(res => {
        if (res.success) {
            currentSubjectQuestions = res.questions;
            currentViewingSubject = { id: subjectId, name: subjectName };
            questionListPage = 1;

            // 设置正确的hash，这样刷新后能保持状态
            window.location.hash = `view/${subjectId}/${encodeURIComponent(subjectName)}`;
            
            // 显示试题列表面板
            if (typeof panelManager !== 'undefined' && panelManager) {
                panelManager.showQuestionList();
            } else {
                // 备用：直接操作DOM
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
    });
}

function saveQuestionListScroll() {
    if (currentViewingSubject) {
        const maxScroll = document.body.scrollHeight - window.innerHeight;
        if (maxScroll > 0) {
            const scrollPercent = window.scrollY / maxScroll;
            // 确保滚动百分比在0-1之间
            const clampedScrollPercent = Math.max(0, Math.min(1, scrollPercent));
            localStorage.setItem(`questionListScroll_${currentViewingSubject.id}`, clampedScrollPercent.toString());
        }
    }
}

// 监听滚动事件
window.addEventListener('scroll', saveQuestionListScroll);

// 初始化应用
window.addEventListener('load', () => {
    initApp();
});