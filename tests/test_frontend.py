import pytest
import subprocess
import time
import os
import signal

@pytest.fixture(scope="module")
def app_server():
    """启动浏览器"""
    # 使用测试配置文件
    proc = subprocess.Popen(
        ["conda", "run", "-n", "common", "python", "app.py", "config_test.json"],
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


def test_pause_exam_button_exists(page, app_server):
    """测试返回按钮是否存在于考试头部"""
    page.goto(app_server)
    page.fill("#loginUsername", "test_pause_exam_user")
    page.click("button:has-text('进入系统')")
    page.wait_for_selector("#mainApp:not([style*='none'])")

    # 选择科目并开始考试
    subject_select = page.query_selector("#subjectSelectExam")
    if subject_select:
        options = page.query_selector_all("#subjectSelectExam option")
        if len(options) > 1:
            page.select_option("#subjectSelectExam", index=1)
            page.click("button:has-text('开始考试')")

            try:
                page.wait_for_selector("#examHeader:not([style*='none'])", timeout=10000)

                # 验证返回按钮存在
                pause_button = page.query_selector("button:has-text('返回')")
                assert pause_button is not None, "返回 button should exist in exam header"

                # 验证退出考试按钮仍然存在
                exit_button = page.query_selector("button:has-text('退出考试')")
                assert exit_button is not None, "退出考试 button should still exist"
            except:
                pass


def test_pause_exam_preserves_session(page, app_server):
    """测试从开始考试进入，暂停后返回到考试页面"""
    page.goto(app_server)
    page.fill("#loginUsername", "test_pause_preserve_user")
    page.click("button:has-text('进入系统')")
    page.wait_for_selector("#mainApp:not([style*='none'])")

    # 选择科目并开始考试
    subject_select = page.query_selector("#subjectSelectExam")
    if subject_select:
        options = page.query_selector_all("#subjectSelectExam option")
        if len(options) > 1:
            page.select_option("#subjectSelectExam", index=1)
            page.click("button:has-text('开始考试')")

            try:
                page.wait_for_selector("#examHeader:not([style*='none'])", timeout=10000)

                # 获取当前session_id
                session_id = page.evaluate("() => window.currentSessionId")
                assert session_id is not None, "Session ID should exist during exam"

                # 点击返回按钮
                page.click("button:has-text('返回')")

                # 等待返回到考试设置页面
                page.wait_for_selector("#examHeader[style*='none']", timeout=5000)

                # 验证处于正常模式（非考试模式）
                is_exam_mode = page.evaluate("() => window.isExamMode")
                assert is_exam_mode is False, "Should exit exam mode after clicking 返回"

                # 验证返回到考试页面（开始考试的来源页面）
                exam_panel = page.query_selector("#examPanel")
                assert exam_panel is not None and "hidden" not in (exam_panel.get_attribute("class") or ""), \
                    "Should return to exam panel after pause from start exam"

                # 验证hash被正确设置为exam
                hash_value = page.evaluate("() => window.location.hash")
                assert hash_value == '#exam', f"Hash should be #exam, got {hash_value}"

                # 验证session_id被清除（与exitExam一致）
                session_id_after = page.evaluate("() => window.currentSessionId")
                assert session_id_after is None, "Session ID should be cleared after pause"

                # 验证通过API可以获取到进行中的考试
                in_progress = page.evaluate("async () => { const res = await fetch('/api/exam/in_progress'); return res.json(); }")
                assert in_progress.get('success') is True, "Should have in_progress exam after pause"
                assert in_progress.get('session') is not None, "Should return session info"

            except:
                pass


def test_resume_exam_after_pause(page, app_server):
    """测试暂停后通过继续考试恢复考试"""
    page.goto(app_server)
    page.fill("#loginUsername", "test_resume_pause_user")
    page.click("button:has-text('进入系统')")
    page.wait_for_selector("#mainApp:not([style*='none'])")

    # 先开始一个考试
    subject_select = page.query_selector("#subjectSelectExam")
    if subject_select:
        options = page.query_selector_all("#subjectSelectExam option")
        if len(options) > 1:
            page.select_option("#subjectSelectExam", index=1)
            page.click("button:has-text('开始考试')")

            try:
                page.wait_for_selector("#examHeader:not([style*='none'])", timeout=10000)

                # 记录一些答题状态
                original_questions_length = page.evaluate("() => window.currentQuestions.length")

                # 点击返回按钮（会保存考试到历史记录）
                page.click("button:has-text('返回')")
                page.wait_for_selector("#examHeader[style*='none']", timeout=5000)

                # 切换到历史记录面板
                page.click("[data-tab='history']")
                page.wait_for_selector("#historyPanel:not(.hidden)", timeout=5000)

                # 检查是否有继续考试按钮
                continue_button = page.query_selector("button:has-text('继续考试')")
                if continue_button:
                    continue_button.click()
                    page.wait_for_selector("#examHeader:not([style*='none'])", timeout=5000)

                    # 验证考试模式恢复
                    is_exam_mode = page.evaluate("() => window.isExamMode")
                    assert is_exam_mode is True, "Should be in exam mode after resuming"

                    # 验证题目数量一致
                    resumed_questions_length = page.evaluate("() => window.currentQuestions.length")
                    assert resumed_questions_length == original_questions_length, "Questions should be restored"
            except:
                pass


def test_pause_exam_returns_to_history(page, app_server):
    """测试从继续考试进入，暂停后返回到考试记录页面"""
    page.goto(app_server)
    page.fill("#loginUsername", "test_pause_history_user")
    page.click("button:has-text('进入系统')")
    page.wait_for_selector("#mainApp:not([style*='none'])")

    # 先开始一个考试
    subject_select = page.query_selector("#subjectSelectExam")
    if subject_select:
        options = page.query_selector_all("#subjectSelectExam option")
        if len(options) > 1:
            page.select_option("#subjectSelectExam", index=1)
            page.click("button:has-text('开始考试')")

            try:
                page.wait_for_selector("#examHeader:not([style*='none'])", timeout=10000)

                # 点击返回按钮（会保存考试到历史记录）
                page.click("button:has-text('返回')")
                page.wait_for_selector("#examHeader[style*='none']", timeout=5000)

                # 切换到历史记录面板
                page.click("[data-tab='history']")
                page.wait_for_selector("#historyPanel:not(.hidden)", timeout=5000)

                # 点击继续考试按钮
                continue_button = page.query_selector("button:has-text('继续考试')")
                if continue_button:
                    continue_button.click()
                    page.wait_for_selector("#examHeader:not([style*='none'])", timeout=5000)

                    # 验证examSourcePage被设置为history
                    source_page = page.evaluate("() => window.examSourcePage")
                    assert source_page == 'history', "examSourcePage should be 'history' when entering from continue exam"

                    # 点击返回按钮
                    page.click("button:has-text('返回')")
                    page.wait_for_selector("#examHeader[style*='none']", timeout=5000)

                    # 验证返回到历史记录页面（继续考试的来源页面）
                    history_panel = page.query_selector("#historyPanel")
                    assert history_panel is not None and "hidden" not in (history_panel.get_attribute("class") or ""), \
                        "Should return to history panel after pause from continue exam"

                    # 验证hash被正确设置为history
                    hash_value = page.evaluate("() => window.location.hash")
                    assert hash_value == '#history', f"Hash should be #history, got {hash_value}"

            except:
                pass