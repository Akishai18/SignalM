"""
Shared pytest configuration and fixtures.
"""
import sys
import os
from pathlib import Path

# Ensure project root is on the path for all tests
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "src"))

# Prevent tests from accidentally hitting real Supabase
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-key-do-not-use")
