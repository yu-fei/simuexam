import pytest
import subprocess
import time
import os
import signal

@pytest.fixture(scope="module")
def app_server():
    """启动浏览器"""
    proc = subprocess.Popen(
        ["conda", "run", "-n", "common", "python", "app.py", "--port", "8001"],
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
