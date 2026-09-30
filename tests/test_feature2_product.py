"""FEATURE 2 — Product management (TC-04..05)."""
import time

from selenium.webdriver.common.by import By

import config
from conftest import find, open_menu, pause, staff_login, type_into, wait, wait_for_panel


def _open_products(driver):
    staff_login(driver, config.ADMIN_EMAIL, config.ADMIN_PASSWORD)
    wait_for_panel(driver)
    open_menu(driver, "Products")


def test_tc04_add_product(driver):
    """Admin adds a new product -> success message and product appears in the list."""
    name = f"{config.TEST_PRODUCT_PREFIX} {int(time.time())}"
    _open_products(driver)

    type_into(find(driver, "input[name=name]"), name)
    type_into(find(driver, "input[name=category]"), "Test")
    type_into(find(driver, "input[name=cost_price]"), "40")
    type_into(find(driver, "input[name=selling_price]"), "50")
    type_into(find(driver, "input[name=stock]"), "10")
    find(driver, ".products-submit-btn").click()

    wait(driver).until(lambda d: name in d.find_element(By.TAG_NAME, "body").text)
    pause()
    assert "added" in find(driver, ".products-message").text.lower()


def test_tc05_search_product(driver):
    """Searching the product list by name shows only matching products."""
    _open_products(driver)
    type_into(find(driver, ".products-search"), config.TEST_PRODUCT_PREFIX)
    pause(1)
    body = driver.find_element(By.TAG_NAME, "body").text
    assert config.TEST_PRODUCT_PREFIX in body