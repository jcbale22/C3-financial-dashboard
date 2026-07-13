"""Shared pytest configuration. Adds the backend root to sys.path so
`from app.xxx import ...` works without installing the package."""
import sys
import os

# backend/ is two levels above this file (backend/tests/conftest.py)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
