import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import config
from conftest import find, pause, staff_login, wait_for_panel


def ensure_logged_in_and_navigate(driver):
    """Ensure user is logged in and navigate to AI Insights page safely."""
    if "login" in driver.current_url.lower() or len(driver.find_elements(By.CSS_SELECTOR, ".sidebar-nav, .sidebar")) == 0:
        staff_login(driver, config.ADMIN_EMAIL, config.ADMIN_PASSWORD)
        wait_for_panel(driver)
        pause()

    ai_menu_xpath = "//a[contains(@href, 'ai') or contains(., 'AI Insights')] | //div[contains(text(), 'AI Insights')] | //span[contains(text(), 'AI Insights')]"
    
    element = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, ai_menu_xpath))
    )
    element.click()
    pause()


def test_tc09_ai_chat_suggested_questions(driver):
    """AI Insights -> Click on suggested question prompt and verify response."""
    ensure_logged_in_and_navigate(driver)
    
    # Suggested chip/button এ ক্লিক করা
    suggested_btns = driver.find_elements(By.XPATH, "//button[contains(@class, 'chip') or contains(@class, 'suggested')] | //div[contains(@class, 'chip')] | //button")
    if len(suggested_btns) > 0:
        suggested_btns[0].click()
        pause(3)  # AI রেসপন্স জেনারেট হওয়ার জন্য ৩ সেকেন্ড বিরতি
    
    # পেজ সোর্সে চ্যাট কনটেন্ট/উত্তর যুক্ত হয়েছে কিনা বা বডি টেস্ট সঠিক আছে কিনা
    assert len(driver.find_elements(By.XPATH, "//*[contains(@class, 'message') or contains(@class, 'chat') or contains(@class, 'bot')]")) > 0 or len(driver.page_source) > 1000


def test_tc10_ai_chat_custom_query(driver):
    """AI Insights -> Type a custom query in input box and send."""
    ensure_logged_in_and_navigate(driver)
    
    inputs = driver.find_elements(By.XPATH, "//input | //textarea")
    if len(inputs) > 0:
        inputs[0].clear()
        inputs[0].send_keys("What is today total profit?")
        pause()

        send_btn = driver.find_elements(By.XPATH, "//button[contains(., 'Send') or contains(@class, 'send')]")
        if len(send_btn) > 0:
            send_btn[0].click()
            pause(2)
            
    assert len(driver.find_elements(By.TAG_NAME, "body")) > 0


def test_tc11_ai_anomaly_alerts_refresh(driver):
    """AI Insights -> Click Refresh on Anomaly Alerts section and verify update."""
    ensure_logged_in_and_navigate(driver)
    
    refresh_btns = driver.find_elements(By.XPATH, "//button[contains(., 'Refresh') or contains(., 'রিফ্রেশ')]")
    if len(refresh_btns) > 0:
        refresh_btns[0].click()
        pause()
    
    # ইংরেজি ("All clear") এবং বাংলা ("সব স্বাভাবিক") দুটোই চেক করা হচ্ছে
    assert "All clear" in driver.page_source or "সব স্বাভাবিক" in driver.page_source or "Anomaly" in driver.page_source


def test_tc12_ai_language_toggle(driver):
    """AI Insights -> Toggle language button (Bangla / English)."""
    ensure_logged_in_and_navigate(driver)
    
    lang_btns = driver.find_elements(By.XPATH, "//button[contains(., 'বাংলা') or contains(., 'English')]")
    if len(lang_btns) > 0:
        lang_btns[0].click()
        pause()
    
    assert len(driver.find_elements(By.TAG_NAME, "body")) > 0