import joblib
import pandas as pd
from flask import Blueprint, g, jsonify, request

from app.config import settings
from app.database import SessionLocal
from app.deps import auth_required
from app.models import Prediction
from app.services.risk import MODEL_FEATURES, assess_risk, enrich_features

bp = Blueprint("model", __name__, url_prefix="/api/model")


def number(payload: dict, name: str, default: float = 0.0) -> float:
    try:
        return float(payload.get(name, default))
    except (TypeError, ValueError):
        return default


def prediction_payload(payload: dict) -> dict:
    return {
        "role": payload.get("role") or "HN",
        "app_name": payload.get("app_name") or "manual",
        "cpu_request": number(payload, "cpu_request"),
        "cpu_limit": number(payload, "cpu_limit", 1),
        "gpu_request": number(payload, "gpu_request"),
        "gpu_limit": number(payload, "gpu_limit", 1),
        "rdma_request": number(payload, "rdma_request"),
        "rdma_limit": number(payload, "rdma_limit", 1),
        "memory_request": number(payload, "memory_request"),
        "memory_limit": number(payload, "memory_limit", 1),
        "disk_request": number(payload, "disk_request"),
        "disk_limit": number(payload, "disk_limit", 1),
        "max_instance_per_node": int(number(payload, "max_instance_per_node", 1)),
        "schedule_delay": number(payload, "schedule_delay"),
        "running_duration": number(payload, "running_duration"),
    }


@bp.get("/features")
@auth_required
def features():
    return jsonify(MODEL_FEATURES)


@bp.post("/predict")
@auth_required
def predict():
    features_dict = prediction_payload(request.get_json(silent=True) or {})
    result = assess_risk(features_dict)
    ml_level = None
    if settings.model_path.exists():
        model = joblib.load(settings.model_path)
        row = pd.DataFrame([enrich_features(features_dict)])
        ml_level = str(model.predict(row)[0])

    db = SessionLocal()
    try:
        prediction = Prediction(
            user_id=g.current_user.id,
            input_features=features_dict,
            risk_score=result.risk_score,
            risk_level=ml_level or result.risk_level,
            reasons=result.reasons,
            suggestions=result.suggestions,
        )
        db.add(prediction)
        db.commit()
    finally:
        db.close()

    return jsonify({
        "risk_score": result.risk_score,
        "risk_level": ml_level or result.risk_level,
        "model_level": ml_level,
        "reasons": result.reasons,
        "suggestions": result.suggestions,
    })


@bp.get("/history")
@auth_required
def history():
    page = max(request.args.get("page", 1, type=int), 1)
    limit = min(max(request.args.get("limit", 20, type=int), 1), 100)

    db = SessionLocal()
    try:
        query = db.query(Prediction).filter(Prediction.user_id == g.current_user.id).order_by(Prediction.created_at.desc())
        total = query.count()
        items = query.offset((page - 1) * limit).limit(limit).all()
        return jsonify({
            "data": [
                {
                    "id": i.id,
                    "input_features": i.input_features,
                    "risk_score": i.risk_score,
                    "risk_level": i.risk_level,
                    "reasons": i.reasons,
                    "suggestions": i.suggestions,
                    "created_at": i.created_at.isoformat() if i.created_at else None,
                }
                for i in items
            ],
            "total": total,
            "page": page,
            "pages": max(1, (total + limit - 1) // limit),
            "limit": limit,
        })
    finally:
        db.close()
