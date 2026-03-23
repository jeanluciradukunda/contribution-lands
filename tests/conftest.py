"""Shared fixtures for Contribution Lands sprite tests."""

import os
import sys
from pathlib import Path

import pytest

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from validation import config as cfg


@pytest.fixture(scope="session")
def sprites_dir():
    """Path to sprites output directory."""
    return cfg.SPRITES_DIR


@pytest.fixture(scope="session")
def api_key():
    """Google API key from environment."""
    key = os.environ.get("GOOGLE_API_KEY")
    if not key:
        pytest.skip("GOOGLE_API_KEY not set")
    return key


@pytest.fixture(scope="session")
def gemini_client(api_key):
    """Gemini API client (session-scoped, shared across all tests)."""
    from google import genai
    return genai.Client(api_key=api_key)


@pytest.fixture
def thresholds():
    """Validation thresholds config module."""
    return cfg
