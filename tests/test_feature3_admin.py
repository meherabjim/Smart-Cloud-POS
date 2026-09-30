"""FEATURE 3 — Admin-only pages: menu, Workers, Salary (TC-06..08)."""
from selenium.webdriver.common.by import By

import config
from conftest import alert_text, find, toast_error, menu_labels, open_menu, pause, staff_login, wait, wait_for_panel


def _admin(driver):
    staff_login(driver, config.ADMIN_EMAIL, config.ADMIN_PASSWORD)
    wait_for_panel(driver)


def test_tc06_admin_menu_shows_admin_pages(driver):
    """Admin sees every admin-only page in the menu."""
    _admin(driver)
    labels = menu_labels(driver)
    for page in ["Dashboard", "Products", "Workers", "Salary", "Stores", "Customers", "Settings"]:
        assert page in labels, f"Admin menu is missing {page}"


def test_tc07_workers_page_loads(driver):
    """Workers page loads the staff list without any error."""
    _admin(driver)
    open_menu(driver, "Workers")
    error = alert_text(driver, 4) or toast_error(driver)
    assert error is None, f"Workers page error: {error}"
    wait(driver).until(lambda d: d.find_element(By.CSS_SELECTOR, ".users-stat strong").text not in ("", "0"))
    pause()
    assert int(find(driver, ".users-stat strong").text) > 0


def test_tc08_salary_page_loads(driver):
    """Salary page loads without a database error."""
    _admin(driver)
    open_menu(driver, "Salary")
    pause(3)
    errors = driver.find_elements(By.CSS_SELECTOR, ".sal-notice.bad")
    assert not errors, f"Salary page error: {errors[0].text if errors else ''}"
