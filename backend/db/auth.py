from db.connection import get_connection
import bcrypt
import hmac
import hashlib
import time
import base64
import json

AUTH_SECRET = "econavigators-maritime-intelligence-secret-key-2026"

def generate_session_token(user_id: int, email: str, username: str) -> str:
    """Generates a secure HMAC-SHA256 session token."""
    payload = {
        "sub": user_id,
        "email": email,
        "username": username,
        "exp": int(time.time()) + (7 * 86400)  # 7 days
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signature = hmac.new(
        AUTH_SECRET.encode(),
        payload_b64.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"{payload_b64}.{signature}"

def verify_session_token(token: str) -> dict | None:
    """Validates an HMAC-SHA256 session token."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, signature = parts
        expected_sig = hmac.new(
            AUTH_SECRET.encode(),
            payload_b64.encode(),
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        padded = payload_b64 + "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode())
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

def create_user(username, email, password):
    conn = get_connection()
    cur = conn.cursor()

    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    cur.execute("""
        INSERT INTO users (username, email, password_hash)
        VALUES (%s, %s, %s)
        RETURNING id, username, email
    """, (username, email, hashed))

    row = cur.fetchone()
    conn.commit()
    conn.close()

    return {"id": row[0], "username": row[1], "email": row[2]}


def verify_user(email, password):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, username, email, password_hash FROM users WHERE email = %s
    """, (email,))
    result = cur.fetchone()
    conn.close()

    if result is None:
        return None

    user_id, username, email_val, stored_hash = result
    if bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
        return {"id": user_id, "username": username, "email": email_val}
    else:
        return None

