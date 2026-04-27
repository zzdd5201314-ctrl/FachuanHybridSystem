"""国家企业信用信息公示系统报告申请服务（独立模式）。

仅用于逆向登录成功后需要 Playwright 完成报告申请的场景。
正常流程（手动验证码登录）已合并到 gsxt_login_service.py 的一体化流程中。
"""

from __future__ import annotations

import asyncio
import logging
import subprocess
import threading
import time
from typing import Any

import httpx
from django.utils import timezone

logger = logging.getLogger("apps.automation")

GSXT_SEARCH_URL = "https://shiming.gsxt.gov.cn/corp-query-homepage.html"
CDP_URL = "http://localhost:9222"
CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CHROME_USER_DATA_DIR = "/tmp/chrome_gsxt_profile"
CAPTCHA_TIMEOUT = 180


class GsxtReportError(Exception):
    """报告申请失败异常。"""


def _check_cdp_available() -> bool:
    try:
        with httpx.Client(transport=httpx.HTTPTransport(http2=False)) as client:
            resp = client.get(f"{CDP_URL}/json/version", timeout=2)
            return resp.status_code == 200
    except Exception:
        return False


def _ensure_chrome_running() -> None:
    """确保 Chrome 以调试模式运行。"""
    if _check_cdp_available():
        return

    logger.info("启动 Chrome 调试模式...")
    process = subprocess.Popen(
        [CHROME_PATH, "--remote-debugging-port=9222", f"--user-data-dir={CHROME_USER_DATA_DIR}", "--no-first-run"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    for i in range(15):
        time.sleep(1)
        if _check_cdp_available():
            logger.info("Chrome 启动成功")
            return
        if process.poll() is not None:
            break

    raise GsxtReportError("Chrome 启动失败，请先关闭所有 Chrome 窗口后重试")


async def _wait_captcha_success(page: Any, captcha_selector: str, timeout: int = CAPTCHA_TIMEOUT) -> bool:
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        await asyncio.sleep(2)
        try:
            done = await page.evaluate(f"""(() => {{
                const el = document.querySelector('{captcha_selector}');
                return el ? el.className.includes('geetest_lock_success') : false;
            }})()""")
            if done:
                return True
        except Exception:
            return False
    return False


async def _click_company_detail(page: Any, company_name: str, context: Any) -> Any:
    await asyncio.sleep(2)

    href = await page.evaluate(f"""(() => {{
        const links = Array.from(document.querySelectorAll('a'));
        const match = links.find(a => a.innerText && a.innerText.trim() === '{company_name}');
        if (match) return match.href;
        const fuzzy = links.find(a => a.innerText && a.innerText.includes('{company_name}'));
        return fuzzy ? fuzzy.href : null;
    }})()""")

    if not href:
        raise GsxtReportError(f"搜索结果中未找到企业：{company_name}")

    logger.info("找到企业链接: %s", href)

    new_page = None

    async def _on_new_page(p: Any) -> None:
        nonlocal new_page
        new_page = p

    context.on("page", _on_new_page)

    try:
        link_clicked = await page.evaluate(f"""(() => {{
            const links = Array.from(document.querySelectorAll('a'));
            const match = links.find(a => a.innerText && a.innerText.trim() === '{company_name}');
            if (match) {{ match.click(); return true; }}
            const fuzzy = links.find(a => a.innerText && a.innerText.includes('{company_name}'));
            if (fuzzy) {{ fuzzy.click(); return true; }}
            return false;
        }})()""")
        if link_clicked:
            await asyncio.sleep(3)
        else:
            await page.goto(href, timeout=60000, wait_until="commit")
    except Exception:
        try:
            await page.goto(href, timeout=60000, wait_until="commit")
        except Exception:
            pass
    finally:
        context.remove_listener("page", _on_new_page)

    if new_page and not new_page.is_closed():
        try:
            await new_page.wait_for_selector("#btn_send_pdf", timeout=60000)
        except Exception:
            pass
        return new_page

    try:
        await page.wait_for_selector("#btn_send_pdf", timeout=60000)
    except Exception as e:
        if "closed" in str(e).lower() or "target" in str(e).lower():
            for p in context.pages:
                try:
                    if not p.is_closed() and "gsxt.gov.cn" in p.url and "search" not in p.url:
                        await p.wait_for_selector("#btn_send_pdf", timeout=30000)
                        return p
                except Exception:
                    continue
        raise GsxtReportError(f"详情页加载失败: {e}")

    return page


async def _run_full_flow(task_id: int) -> None:
    """独立报告流程（逆向登录成功后，需要 Playwright 搜索+申请报告）。"""
    from asgiref.sync import sync_to_async
    from playwright.async_api import async_playwright

    from apps.automation.models.gsxt_report import GsxtReportStatus, GsxtReportTask

    get_task = sync_to_async(GsxtReportTask.objects.select_related("client").get)

    def _save(t: GsxtReportTask, fields: list[str]) -> None:
        t.save(update_fields=fields)

    save_task = sync_to_async(_save)

    task = await get_task(pk=task_id)
    company_name: str = task.company_name
    credit_code: str = task.credit_code or ""

    _ensure_chrome_running()

    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        context = browser.contexts[0]
        page = await context.new_page()

        detail_page = None

        try:
            task.status = GsxtReportStatus.WAITING_CAPTCHA
            task.error_message = f"正在搜索：{company_name}，请完成验证码"
            await save_task(task, ["status", "error_message"])

            await page.goto(GSXT_SEARCH_URL, timeout=30000, wait_until="domcontentloaded")
            await asyncio.sleep(2)

            await page.fill("#keyword", company_name)
            await asyncio.sleep(0.5)
            await page.click("#btn_query")

            logger.info("已点击搜索，等待用户完成验证码...")

            search_deadline = asyncio.get_event_loop().time() + CAPTCHA_TIMEOUT
            while asyncio.get_event_loop().time() < search_deadline:
                await asyncio.sleep(2)
                try:
                    if "corp-query-search-1" in page.url:
                        break
                except Exception:
                    pass

            task.error_message = "已找到搜索结果，正在进入详情页"
            await save_task(task, ["error_message"])

            try:
                detail_page = await _click_company_detail(page, company_name, context)
            except GsxtReportError:
                if not credit_code:
                    raise
                logger.info("改用信用代码搜索: %s", credit_code)
                await page.fill("#keyword", credit_code)
                await page.click("#btn_query")
                await asyncio.sleep(5)
                detail_page = await _click_company_detail(page, company_name, context)

            task.error_message = "已进入详情页，请完成发送报告验证码"
            await save_task(task, ["error_message"])

            target = detail_page or page
            await target.wait_for_selector("#btn_send_pdf", timeout=60000)
            await target.click("#btn_send_pdf")

            done = await _wait_captcha_success(
                target, ".geetest_captcha.geetest_bind.geetest_lock_success", CAPTCHA_TIMEOUT,
            )
            if not done:
                raise GsxtReportError(f"等待发送报告验证码超时（{CAPTCHA_TIMEOUT}秒）")

            await target.wait_for_selector("#send_pdf_dialog", state="visible", timeout=10000)
            await target.click("#send_pdf_dialog div[onclick*='sendPdf']")

            dialog_msg = ""

            async def handle_dialog(dialog: object) -> None:
                nonlocal dialog_msg
                dialog_msg = getattr(dialog, "message", "")
                await dialog.accept()  # type: ignore[attr-defined]

            target.on("dialog", handle_dialog)
            await asyncio.sleep(5)
            target.remove_listener("dialog", handle_dialog)
            logger.info("发送报告结果: %s", dialog_msg)

            task.status = GsxtReportStatus.WAITING_EMAIL
            task.error_message = "报告已发送到邮箱，正在自动轮询收取…"
            await save_task(task, ["status", "error_message"])
            logger.info("任务 %d：报告申请成功，启动邮件轮询", task_id)

            from datetime import timedelta

            from django.utils import timezone
            from apps.core.tasking import ScheduleQueryService

            def _schedule_email_check() -> None:
                ScheduleQueryService().create_once_schedule(
                    func="apps.automation.tasks.gsxt_tasks.check_gsxt_report_email",
                    args=f"{task_id},{task.company_name!r}",
                    name=f"gsxt_email_first_{task_id}",
                    next_run=timezone.now() + timedelta(seconds=60),
                )

            await sync_to_async(_schedule_email_check)()

        except Exception as e:
            task.status = GsxtReportStatus.FAILED
            task.error_message = str(e)
            await save_task(task, ["status", "error_message"])
            logger.exception("任务 %d 失败: %s", task_id, e)


def start_report_flow(task_id: int) -> None:
    """非阻塞入口。"""

    def _run() -> None:
        asyncio.run(_run_full_flow(task_id))

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    logger.info("报告申请后台线程已启动，task_id=%d", task_id)


class GsxtReportService:
    """Class-based facade for GSXT report workflow."""

    def start_report_flow(self, task_id: int) -> None:
        start_report_flow(task_id)
