# ==========================================================
# Test settings — only the Admin login is needed
# The real password lives in tests/config_local.py (not pushed to GitHub).
# ==========================================================

BASE_URL = "http://localhost:3000"

ADMIN_EMAIL = "admin@pos.com"
ADMIN_PASSWORD = "CHANGE_ME"

# Feature 2 creates products named "Selenium Test <time>"
TEST_PRODUCT_PREFIX = "Selenium Test"

# Seconds to pause between steps so the teacher can follow (0 = full speed)
DEMO_DELAY = 0.8

# Local overrides (password etc.) — this file is in .gitignore
try:
    from config_local import *  # noqa: F401,F403
except ImportError:
    pass
