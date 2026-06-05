from flask import Blueprint, jsonify, request

from app.database import SessionLocal
from app.deps import auth_required
from app.models import Alert

bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")


@bp.get("")
@auth_required
def list_alerts():
    page = max(request.args.get("page", 1, type=int), 1)
    limit = min(max(request.args.get("limit", 20, type=int), 1), 100)
    level = request.args.get("level") or None

    db = SessionLocal()
    try:
        query = db.query(Alert).order_by(Alert.created_at.desc())
        if level:
            query = query.filter(Alert.level == level)
        total = query.count()
        items = query.offset((page - 1) * limit).limit(limit).all()
        return jsonify({
            "data": [
                {
                    "id": a.id,
                    "instance_id": a.instance_id,
                    "instance_sn": a.instance.instance_sn if a.instance else None,
                    "app_name": a.instance.app_name if a.instance else None,
                    "alert_type": a.alert_type,
                    "level": a.level,
                    "message": a.message,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in items
            ],
            "total": total,
            "page": page,
            "pages": max(1, (total + limit - 1) // limit),
            "limit": limit,
        })
    finally:
        db.close()
