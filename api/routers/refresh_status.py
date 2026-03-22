"""
GET /api/refresh/status — serves the last_refresh.json written by refresh_pipeline.py
"""
import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/api/refresh", tags=["refresh"])

_STATUS_PATH = Path("data/last_refresh.json")


@router.get("/status")
def get_refresh_status():
    if not _STATUS_PATH.exists():
        return {"status": "unknown", "last_refresh_utc": None, "data_through": None}
    return json.loads(_STATUS_PATH.read_text())
