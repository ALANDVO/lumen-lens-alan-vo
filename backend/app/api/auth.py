from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()

security = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    sub: str
    email: str
    roles: list[str] = []
    aud: str | list[str] = ""
    iss: str = ""
    exp: int = 0
    iat: int = 0


class User(BaseModel):
    id: str
    email: str
    roles: list[str]


_jwks_cache: dict | None = None


async def get_jwks() -> dict:
    global _jwks_cache
    import httpx

    if _jwks_cache is None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(settings.effective_oidc_jwks_url)
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


async def validate_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> TokenPayload:
    if not settings.oidc_enabled:
        # Demo mode: return a synthetic user
        return TokenPayload(
            sub="demo-user",
            email="demo@lumen-lens.local",
            roles=["admin", "operator", "viewer"],
            aud=settings.oidc_audience,
            iss=settings.oidc_issuer_url,
        )

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        jwks = await get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            raise JWTError("Token missing kid header")

        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if not key:
            raise JWTError("Unable to find matching key")

        from jose.utils import base64url_decode
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization

        n = base64url_decode(key["n"].encode())
        e = base64url_decode(key["e"].encode())
        public_numbers = rsa.RSAPublicNumbers(int.from_bytes(e, "big"), int.from_bytes(n, "big"))
        public_key = public_numbers.public_key()

        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=settings.oidc_audience,
            issuer=settings.oidc_issuer_url,
        )
        return TokenPayload(**payload)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_role(required_roles: list[str]):
    async def role_checker(payload: TokenPayload = Depends(validate_token)) -> TokenPayload:
        user_roles = set(payload.roles)
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {required_roles}",
            )
        return payload

    return role_checker


async def get_current_user(payload: TokenPayload = Depends(validate_token)) -> User:
    return User(id=payload.sub, email=payload.email, roles=payload.roles)


@router.get("/me", response_model=User)
async def get_me(user: User = Depends(get_current_user)) -> User:
    return user