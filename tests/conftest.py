"""Shared Selenium setup: browser, waits, login helpers, screenshots."""
import os
import time

import pytest
from selenium import webdriver
from selenium.common.exceptions import NoAlertPresentException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

import config

SHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SHOT_DIR, exist_ok=True)


# ---------------- browser ----------------
@pytest.fixture
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--window-size=1400,900")
    if os.environ.get("HEADLESS") == "1":
        options.add_argument("--headless=new")
    drv = webdriver.Chrome(options=options)  # Selenium Manager downloads the driver
    yield drv
    drv.quit()


# ---------------- small helpers ----------------
def pause(sec=None):
    time.sleep(config.DEMO_DELAY if sec is None else sec)


def wait(driver, sec=15):
    return WebDriverWait(driver, sec)


def find(driver, css, sec=15):
    return wait(driver, sec).until(EC.visibility_of_element_located((By.CSS_SELECTOR, css)))


def find_x(driver, xpath, sec=15):
    return wait(driver, sec).until(EC.element_to_be_clickable((By.XPATH, xpath)))


def type_into(el, text):
    el.clear()
    el.send_keys(text)
    pause()


def snap(driver, name):
    path = os.path.join(SHOT_DIR, f"{name}.png")
    driver.save_screenshot(path)
    return path


def alert_text(driver, sec=2):
    """Return the text of a JS alert if one pops up (and close it), else None."""
    try:
        WebDriverWait(driver, sec).until(EC.alert_is_present())
        alert = driver.switch_to.alert
        text = alert.text
        alert.accept()
        return text
    except (TimeoutException, NoAlertPresentException):
        return None


def toast_error(driver):
    """Text of a red error toast on screen (the app shows toasts, not alert popups), else None."""
    items = driver.find_elements(By.CSS_SELECTOR, ".toast-error .toast-body span")
    return items[0].text if items else None


# ---------------- staff side ----------------
def staff_login(driver, email, password):
    driver.get(config.BASE_URL)
    type_into(find(driver, "#email"), email)
    type_into(find(driver, "#password"), password)
    driver.find_element(By.CSS_SELECTOR, "form.login-form button[type=submit]").click()


def wait_for_panel(driver):
    """Wait until the staff control panel is shown (sidebar visible)."""
    try:
        find(driver, ".sidebar-nav", 20)
    except TimeoutException:
        body = driver.find_element(By.TAG_NAME, "body").text
        if "Face Registration" in body:
            pytest.fail("This account must register its face once before testing (see README step 2).")
        if "Salary Account" in body:
            pytest.fail("This account must set its salary account once before testing (see README step 2).")
        raise
    pause()


def menu_labels(driver):
    items = driver.find_elements(By.CSS_SELECTOR, ".sidebar-nav .nav-btn span:last-child")
    return [i.text.strip() for i in items]


def open_menu(driver, label):
    find_x(driver, f"//nav[contains(@class,'sidebar-nav')]//button[.//span[normalize-space()='{label}']]").click()
    pause()


# ---------------- customer side ----------------
def customer_login(driver, phone, password):
    driver.get(config.BASE_URL)
    find_x(driver, "//button[contains(., 'Customer Loyalty Login')]").click()
    pause()
    type_into(find(driver, "form.customer-auth-form input"), phone)
    type_into(find(driver, "form.customer-auth-form input[type=password]"), password)
    driver.find_element(By.CSS_SELECTOR, "form.customer-auth-form button[type=submit]").click()
    find(driver, ".customer-portal-header h1", 20)
    pause()


def open_customer_tab(driver, label):
    find_x(driver, f"//nav[contains(@class,'customer-portal-nav')]//button[normalize-space()='{label}']").click()
    pause()


# ---------------- screenshot on failure (added to HTML report) ----------------
@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when != "call":
        return
    drv = item.funcargs.get("driver")
    if drv is None:
        return
    try:
        snap(drv, f"{item.name}_{'PASS' if report.passed else 'FAIL'}")
        import pytest_html
        extras = getattr(report, "extras", [])
        extras.append(pytest_html.extras.image(drv.get_screenshot_as_base64(), "Screenshot"))
        report.extras = extras
    except Exception:
        # Browser was closed/crashed — skip the screenshot, keep the test result
        pass
