from datetime import datetime

from flask import Blueprint, g, jsonify, request

from app.database import SessionLocal
from app.deps import auth_required
from app.models import User
from app.security import create_token, hash_password, verify_password

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }


@bp.post("/register")
def register():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    email = payload.get("email") or None

    if len(username) < 3 or len(password) < 4:
        return jsonify({"detail": "用户名至少3位，密码至少4位"}), 400

    db = SessionLocal()
    try:
        exists = db.query(User).filter(User.username == username).first()
        if exists:
            return jsonify({"detail": "用户名已存在"}), 409
        user = User(username=username, email=email, password_hash=hash_password(password))
        db.add(user)
        db.commit()
        db.refresh(user)
        return jsonify({"message": "注册成功", "user": user_dict(user)}), 201
    finally:
        db.close()


@bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user or not verify_password(password, user.password_hash):
            return jsonify({"detail": "用户名或密码错误"}), 401
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)
        return jsonify({"access_token": create_token(user.id), "user": user_dict(user)})
    finally:
        db.close()


@bp.get("/me")
@auth_required
def me():
    return jsonify({"user": user_dict(g.current_user)})
