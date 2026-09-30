"""FEATURE 1 — Staff login (TC-01..03)."""
from selenium.webdriver.common.by import By

import config
from conftest import find, pause, staff_login, wait_for_panel


def test_tc01_admin_login_success(driver):
    """Admin logs in with the correct password -> control panel opens."""
    staff_login(driver, config.ADMIN_EMAIL, config.ADMIN_PASSWORD)
    wait_for_panel(driver)
    assert "Admin" in find(driver, ".topbar-user").text


def test_tc02_login_wrong_password(driver):
    """Wrong password -> error message is shown and the panel does not open."""
    staff_login(driver, config.ADMIN_EMAIL, "wrong-password-123")
    msg = find(driver, ".form-message.show").text
    pause()
    assert msg.strip() != ""
    assert not driver.find_elements(By.CSS_SELECTOR, ".sidebar-nav")


def test_tc03_logout(driver):
    """Logout -> user goes back to the login form."""
    staff_login(driver, config.ADMIN_EMAIL, config.ADMIN_PASSWORD)
    wait_for_panel(driver)
    find(driver, ".logout-btn").click()
    pause()
    assert find(driver, "#email").is_displayed()