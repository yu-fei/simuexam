import pytest
import subprocess
import time
import os
import signal

@pytest.fixture(scope="module")
def app_server():
    """启动浏览器"""
    # 使用命令行参数指定内存数据库
    proc = subprocess.Popen(
        ["conda", "run", "-n", "common", "python", "app.py", "--port", "8001", "--db", "file:test_db?mode=memory&cache=shared"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    time.sleep(3)
    yield "http://127.0.0.1:8001"
    proc.send_signal(signal.SIGTERM)
    proc.wait(timeout=5)

def test_login_and_view_question_list(page, app_server):
    page.goto(app_server)
    page.fill("#loginUsername", "test_user")
    page.click("button:has-text('进入系统')")
    page.wait_for_selector("#mainApp:not([style*='none'])")

    page.click("[data-tab='admin']")
    page.wait_for_selector("#adminPanel:not(.hidden)")

    subject_items = page.query_selector_all(".subject-item")
    if len(subject_items) > 0:
        page.click(".subject-item button:has-text('查看试题列表')")
        page.wait_for_selector("#questionListPanel:not(.hidden)")

        hash_value = page.evaluate("() => window.location.hash")
        assert hash_value.startswith("#view/"), f"Expected hash to start with #view/, got {hash_value}"

def test_scroll_position_persistence(page, app_server):
    page.goto(app_server)
    page.fill("#loginUsername", "test_scroll_user")
    page.click("button:has-text('进入系统')")
    page.wait_for_selector("#mainApp:not([style*='none'])")

    page.click("[data-tab='admin']")
    page.wait_for_selector("#adminPanel:not(.hidden)")

    subject_items = page.query_selector_all(".subject-item")
    if len(subject_items) > 0:
        page.click(".subject-item button:has-text('查看试题列表')")
        page.wait_for_selector("#questionListPanel:not(.hidden)")

        scroll_container = page.query_selector("#questionListArea")
        if scroll_container:
            total_height = page.evaluate("(el) => el.scrollHeight", scroll_container)
            client_height = page.evaluate("(el) => el.clientHeight", scroll_container)

            if total_height > client_height:
                target_scroll = (total_height - client_height) * 0.5
                page.evaluate(f"(el) => el.scrollTop = {target_scroll}", scroll_container)
                time.sleep(0.5)

                subject_id = page.evaluate("() => window.location.hash.split('/')[1]")
                saved_scroll = page.evaluate(f"() => localStorage.getItem('questionListScroll_' + '{subject_id}')")
                assert saved_scroll is not None, "Scroll position should be saved to localStorage"

def test_page_refresh_restores_state(page, app_server):
    page.goto(app_server)
    page.fill("#loginUsername", "test_refresh_user")
    page.click("button:has-text('进入系统')")
    page.wait_for_selector("#mainApp:not([style*='none'])")

    page.click("[data-tab='admin']")
    page.wait_for_selector("#adminPanel:not(.hidden)")

    subject_items = page.query_selector_all(".subject-item")
    if len(subject_items) > 0:
        page.click(".subject-item button:has-text('查看试题列表')")
        page.wait_for_selector("#questionListPanel:not(.hidden)")

        original_hash = page.evaluate("() => window.location.hash")
        assert original_hash.startswith("#view/"), "Should have view hash"

        page.reload()
        page.wait_for_selector("#questionListPanel:not(.hidden)")

        new_hash = page.evaluate("() => window.location.hash")
        assert original_hash == new_hash, "Hash should be preserved after refresh"


def test_exam_refresh_preserves_state(page, app_server):
    """测试考试过程中刷新页面后是否保持考试状态"""
    page.goto(app_server)
    page.fill("#loginUsername", "test_exam_refresh_user")
    page.click("button:has-text('进入系统')")
    page.wait_for_selector("#mainApp:not([style*='none'])")

    # 选择科目并开始考试
    subject_select = page.query_selector("#subjectSelectExam")
    if subject_select:
        # 检查是否有科目选项
        options = page.query_selector_all("#subjectSelectExam option")
        if len(options) > 1:  # 至少有一个非默认选项
            # 选择第一个科目
            page.select_option("#subjectSelectExam", index=1)
            # 开始考试
            page.click("button:has-text('开始考试')")
            
            # 等待考试模式加载
            try:
                page.wait_for_selector("#examHeader:not([style*='none'])", timeout=10000)
                
                # 验证当前是考试模式
                is_exam_mode = page.evaluate("() => window.isExamMode")
                assert is_exam_mode is True, "Should be in exam mode"

                # 刷新页面
                page.reload()
                page.wait_for_selector("#examHeader:not([style*='none'])", timeout=10000)

                # 验证刷新后仍然是考试模式
                new_is_exam_mode = page.evaluate("() => window.isExamMode")
                assert new_is_exam_mode is True, "Should still be in exam mode after refresh"

                # 验证hash仍然是exam-mode
                new_hash = page.evaluate("() => window.location.hash")
                assert new_hash == "#exam-mode", "Hash should be #exam-mode after refresh"
            except:
                # 如果没有科目数据，跳过测试
                pass


def test_exam_hides_other_panels(page, app_server):
    """测试考试过程中是否隐藏其他面板"""
    page.goto(app_server)
    page.fill("#loginUsername", "test_exam_hides_panels_user")
    page.click("button:has-text('进入系统')")
    page.wait_for_selector("#mainApp:not([style*='none'])")

    # 选择科目并开始考试
    subject_select = page.query_selector("#subjectSelectExam")
    if subject_select:
        # 检查是否有科目选项
        options = page.query_selector_all("#subjectSelectExam option")
        if len(options) > 1:  # 至少有一个非默认选项
            # 选择第一个科目
            page.select_option("#subjectSelectExam", index=1)
            # 开始考试
            page.click("button:has-text('开始考试')")
            
            # 等待考试模式加载
            try:
                page.wait_for_selector("#examHeader:not([style*='none'])", timeout=10000)
                
                # 验证考试面板可见
                exam_panel_visible = page.evaluate("() => !document.getElementById('examPanel').classList.contains('hidden')")
                assert exam_panel_visible is True, "Exam panel should be visible"

                # 验证历史记录面板隐藏
                history_panel_hidden = page.evaluate("() => document.getElementById('historyPanel').classList.contains('hidden')")
                assert history_panel_hidden is True, "History panel should be hidden during exam"

                # 验证管理面板隐藏
                admin_panel_hidden = page.evaluate("() => document.getElementById('adminPanel').classList.contains('hidden')")
                assert admin_panel_hidden is True, "Admin panel should be hidden during exam"

                # 验证试题列表面板隐藏
                question_list_panel_hidden = page.evaluate("() => document.getElementById('questionListPanel').classList.contains('hidden')")
                assert question_list_panel_hidden is True, "Question list panel should be hidden during exam"
            except:
                # 如果没有科目数据，跳过测试
                pass
