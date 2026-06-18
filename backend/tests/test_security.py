import pytest
from datetime import timedelta
from app.core import security


def test_password_hash_roundtrip():
    h = security.hash_password("s3cret")
    assert h != "s3cret"
    assert security.verify_password("s3cret", h) is True
    assert security.verify_password("wrong", h) is False


def test_jwt_encode_decode():
    token = security.create_access_token({"sub": "user-123", "role": "admin"})
    payload = security.decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["role"] == "admin"


def test_jwt_expired_raises():
    token = security.create_access_token({"sub": "u"}, expires_delta=timedelta(seconds=-1))
    with pytest.raises(security.TokenError):
        security.decode_token(token)
