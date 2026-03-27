"""
Tests for Supabase JWT auth on /api/custom/* endpoints.

Strategy:
- Mock _admin_client().auth.get_user() so no real Supabase calls are made
- Mock api.utils.storage so no Supabase Storage calls are made
- Cover: missing token, invalid token, valid token (200),
         cross-user ownership (403), legacy dataset (403)
"""
import os
import uuid
import pytest
from unittest.mock import patch, MagicMock

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app, raise_server_exceptions=False)

# ── Test users & sessions ──────────────────────────────────────────────────────

USER_A = str(uuid.uuid4())
USER_B = str(uuid.uuid4())
SESSION_A = str(uuid.uuid4())


def _mock_user(user_id: str):
    """Return a mock Supabase user object."""
    u = MagicMock()
    u.id = user_id
    u.email = f"{user_id[:8]}@test.com"
    return u


def _mock_get_user(user_id: str):
    """Return a mock get_user response for the given user."""
    resp = MagicMock()
    resp.user = _mock_user(user_id)
    return resp


def _admin_client_for(user_id: str):
    """Patch _admin_client so get_user returns user_id."""
    admin = MagicMock()
    admin.auth.get_user.return_value = _mock_get_user(user_id)
    return admin


def _admin_client_invalid():
    """Patch _admin_client so get_user raises (invalid token)."""
    admin = MagicMock()
    admin.auth.get_user.side_effect = Exception("Invalid token")
    return admin


# ── Storage helpers ────────────────────────────────────────────────────────────

def _meta(user_id: str) -> dict:
    return {
        "session_id": SESSION_A,
        "dataset_name": "test",
        "original_filename": "test.csv",
        "file_size_bytes": 100,
        "created_at": "2024-01-01T00:00:00+00:00",
        "user_id": user_id,
    }

def _status() -> dict:
    return {"status": "complete", "progress_pct": 100, "message": "Done"}


def storage_for(user_id: str):
    m = MagicMock()
    m.path_exists.return_value = True
    m.read_json.side_effect = lambda path: (
        _meta(user_id) if "dataset_meta" in path else _status()
    )
    return m


# ── 1. Missing Authorization header ───────────────────────────────────────────

class TestMissingToken:
    ENDPOINTS = [
        ("GET",    f"/api/custom/{SESSION_A}/status"),
        ("GET",    f"/api/custom/{SESSION_A}/meta"),
        ("GET",    f"/api/custom/{SESSION_A}/overview"),
        ("GET",    f"/api/custom/{SESSION_A}/history"),
        ("GET",    f"/api/custom/{SESSION_A}/transitions"),
        ("GET",    f"/api/custom/{SESSION_A}/performance"),
        ("GET",    f"/api/custom/{SESSION_A}/features"),
        ("GET",    f"/api/custom/{SESSION_A}/predictions"),
        ("GET",    f"/api/custom/{SESSION_A}/predict"),
        ("GET",    f"/api/custom/{SESSION_A}/predict/trajectory"),
        ("GET",    "/api/custom/list"),
        ("DELETE", f"/api/custom/{SESSION_A}"),
    ]

    @pytest.mark.parametrize("method,url", ENDPOINTS)
    def test_returns_401(self, method, url):
        resp = client.request(method, url)
        assert resp.status_code == 401, f"{method} {url} → {resp.status_code}"

    def test_upload_returns_401(self):
        resp = client.post(
            "/api/custom/upload",
            files={"file": ("test.csv", b"date,close\n2024-01-01,100", "text/csv")},
            data={"dataset_name": "test"},
        )
        assert resp.status_code == 401


# ── 2. Invalid token ───────────────────────────────────────────────────────────

class TestInvalidToken:
    def test_bad_token_returns_401(self):
        with patch("api.dependencies.auth._admin_client", return_value=_admin_client_invalid()):
            resp = client.get(
                f"/api/custom/{SESSION_A}/status",
                headers={"Authorization": "Bearer bad.token.here"},
            )
        assert resp.status_code == 401


# ── 3. Valid token + owner ─────────────────────────────────────────────────────

class TestValidToken:
    def test_status_passes_auth(self):
        with patch("api.dependencies.auth._admin_client", return_value=_admin_client_for(USER_A)), \
             patch("api.routers.custom_data.storage", storage_for(USER_A)):
            resp = client.get(
                f"/api/custom/{SESSION_A}/status",
                headers={"Authorization": "Bearer valid-token"},
            )
        assert resp.status_code not in (401, 403)

    def test_meta_passes_auth(self):
        with patch("api.dependencies.auth._admin_client", return_value=_admin_client_for(USER_A)), \
             patch("api.routers.custom_data.storage", storage_for(USER_A)):
            resp = client.get(
                f"/api/custom/{SESSION_A}/meta",
                headers={"Authorization": "Bearer valid-token"},
            )
        assert resp.status_code not in (401, 403)

    def test_list_passes_auth(self):
        with patch("api.dependencies.auth._admin_client", return_value=_admin_client_for(USER_A)), \
             patch("api.routers.custom_data.storage", storage_for(USER_A)):
            resp = client.get(
                f"/api/custom/list?ids={SESSION_A}",
                headers={"Authorization": "Bearer valid-token"},
            )
        assert resp.status_code not in (401, 403)

    def test_delete_passes_auth(self):
        with patch("api.dependencies.auth._admin_client", return_value=_admin_client_for(USER_A)), \
             patch("api.routers.custom_data.storage", storage_for(USER_A)):
            resp = client.delete(
                f"/api/custom/{SESSION_A}",
                headers={"Authorization": "Bearer valid-token"},
            )
        assert resp.status_code not in (401, 403)


# ── 4. Ownership enforcement ───────────────────────────────────────────────────

class TestOwnership:
    ENDPOINTS = [
        ("GET",    f"/api/custom/{SESSION_A}/status"),
        ("GET",    f"/api/custom/{SESSION_A}/meta"),
        ("GET",    f"/api/custom/{SESSION_A}/overview"),
        ("GET",    f"/api/custom/{SESSION_A}/history"),
        ("GET",    f"/api/custom/{SESSION_A}/transitions"),
        ("GET",    f"/api/custom/{SESSION_A}/performance"),
        ("GET",    f"/api/custom/{SESSION_A}/features"),
        ("GET",    f"/api/custom/{SESSION_A}/predictions"),
        ("GET",    f"/api/custom/{SESSION_A}/predict"),
        ("GET",    f"/api/custom/{SESSION_A}/predict/trajectory"),
        ("DELETE", f"/api/custom/{SESSION_A}"),
    ]

    @pytest.mark.parametrize("method,url", ENDPOINTS)
    def test_cross_user_returns_403(self, method, url):
        # Dataset owned by USER_A, accessed by USER_B
        with patch("api.dependencies.auth._admin_client", return_value=_admin_client_for(USER_B)), \
             patch("api.routers.custom_data.storage", storage_for(USER_A)):
            resp = client.request(method, url, headers={"Authorization": "Bearer token-b"})
        assert resp.status_code == 403, f"{method} {url} → {resp.status_code}"

    def test_list_hides_other_users_dataset(self):
        with patch("api.dependencies.auth._admin_client", return_value=_admin_client_for(USER_B)), \
             patch("api.routers.custom_data.storage", storage_for(USER_A)):
            resp = client.get(
                f"/api/custom/list?ids={SESSION_A}",
                headers={"Authorization": "Bearer token-b"},
            )
        assert resp.status_code == 200
        assert resp.json()[0]["exists"] is False

    def test_owner_can_access(self):
        with patch("api.dependencies.auth._admin_client", return_value=_admin_client_for(USER_A)), \
             patch("api.routers.custom_data.storage", storage_for(USER_A)):
            resp = client.get(
                f"/api/custom/{SESSION_A}/status",
                headers={"Authorization": "Bearer token-a"},
            )
        assert resp.status_code not in (401, 403)


# ── 5. Legacy dataset (no user_id) ────────────────────────────────────────────

class TestLegacyDataset:
    def test_legacy_returns_403(self):
        m = MagicMock()
        m.path_exists.return_value = True
        m.read_json.side_effect = lambda path: (
            {"session_id": SESSION_A, "dataset_name": "legacy"}  # no user_id
            if "dataset_meta" in path else _status()
        )
        with patch("api.dependencies.auth._admin_client", return_value=_admin_client_for(USER_A)), \
             patch("api.routers.custom_data.storage", m):
            resp = client.get(
                f"/api/custom/{SESSION_A}/status",
                headers={"Authorization": "Bearer valid-token"},
            )
        assert resp.status_code == 403


# ── 6. Open endpoints stay open ───────────────────────────────────────────────

class TestOpenEndpoints:
    @pytest.mark.parametrize("url", [
        "/api/regimes/current",
        "/api/regimes/history",
        "/api/predictions/summary",
    ])
    def test_no_auth_required(self, url):
        resp = client.get(url)
        assert resp.status_code not in (401, 403)
