import os
import traceback
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

security = HTTPBearer(auto_error=False)

# Module-level singleton — created once on first use
_supabase_admin: Client | None = None

def _admin_client() -> Client:
    global _supabase_admin
    if _supabase_admin is None:
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
        if not url or not key:
            missing = []
            if not url: missing.append("SUPABASE_URL")
            if not key: missing.append("SUPABASE_SERVICE_KEY")
            raise HTTPException(
                status_code=500,
                detail=f"Supabase auth not configured. Missing env vars: {', '.join(missing)}"
            )
        _supabase_admin = create_client(url, key)
    return _supabase_admin


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authorization header required.")

    try:
        response = _admin_client().auth.get_user(credentials.credentials)
        user = response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token.")
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[auth] get_user failed: {type(exc).__name__}: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    return {"user_id": user.id, "email": user.email}
