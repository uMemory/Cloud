from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from app.database import SessionLocal
from app.deps import auth_required
from app.models import AiInstance

bp = Blueprint("instances", __name__, url_prefix="/api/instances")


def instance_dict(item: AiInstance) -> dict:
    return {c.name: getattr(item, c.name) for c in item.__table__.columns}


@bp.get("")
@auth_required
def list_instances():
    page = max(request.args.get("page", 1, type=int), 1)
    limit = min(max(request.args.get("limit", 20, type=int), 1), 100)
    role = request.args.get("role") or None
    app_name = request.args.get("app_name") or None
    risk_level = request.args.get("risk_level") or None
    search = request.args.get("search") or None
    sort_by = request.args.get("sort_by", "risk_score")
    order = request.args.get("order", "desc")

    db = SessionLocal()
    try:
        query = db.query(AiInstance)
        if role:
            query = query.filter(AiInstance.role == role)
        if app_name:
            query = query.filter(AiInstance.app_name == app_name)
        if risk_level:
            query = query.filter(AiInstance.risk_level == risk_level)
        if search:
            pattern = f"%{search}%"
            query = query.filter(or_(AiInstance.instance_sn.like(pattern), AiInstance.app_name.like(pattern)))

        allowed = {c.name for c in AiInstance.__table__.columns}
        sort_col = getattr(AiInstance, sort_by if sort_by in allowed else "risk_score")
        query = query.order_by(sort_col.asc() if order == "asc" else sort_col.desc())
        total = query.count()
        items = query.offset((page - 1) * limit).limit(limit).all()
        return jsonify({
            "data": [instance_dict(i) for i in items],
            "total": total,
            "page": page,
            "pages": max(1, (total + limit - 1) // limit),
            "limit": limit,
        })
    finally:
        db.close()


@bp.get("/apps")
@auth_required
def apps():
    db = SessionLocal()
    try:
        rows = db.query(AiInstance.app_name).distinct().order_by(AiInstance.app_name).all()
        return jsonify([r[0] for r in rows])
    finally:
        db.close()


@bp.get("/roles")
@auth_required
def roles():
    db = SessionLocal()
    try:
        rows = db.query(AiInstance.role).distinct().order_by(AiInstance.role).all()
        return jsonify([r[0] for r in rows])
    finally:
        db.close()


@bp.get("/<int:instance_id>")
@auth_required
def get_instance(instance_id: int):
    db = SessionLocal()
    try:
        item = db.get(AiInstance, instance_id)
        if not item:
            return jsonify({"detail": "实例不存在"}), 404
        return jsonify(instance_dict(item))
    finally:
        db.close()
