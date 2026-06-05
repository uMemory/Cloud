from functools import wraps

from flask import g, jsonify, request

from app.database import SessionLocal
from app.models import User
from app.security import verify_token


def auth_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        token = header.removeprefix("Bearer ").strip()
        user_id = verify_token(token) if token else None
        if not user_id:
            return jsonify({"detail": "未登录或登录已过期"}), 401

        db = SessionLocal()
        try:
            user = db.get(User, user_id)
            if not user:
                return jsonify({"detail": "用户不存在"}), 401
            g.current_user = user
            return view(*args, **kwargs)
        finally:
            db.close()

    return wrapper
