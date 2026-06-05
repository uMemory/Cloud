from flask import Blueprint, jsonify, request

from app.database import SessionLocal
from app.deps import auth_required
from app.services import stats

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@bp.get("/summary")
@auth_required
def get_summary():
    db = SessionLocal()
    try:
        return jsonify(stats.summary(db))
    finally:
        db.close()


@bp.get("/risk-distribution")
@auth_required
def get_risk_distribution():
    db = SessionLocal()
    try:
        return jsonify(stats.risk_distribution(db))
    finally:
        db.close()


@bp.get("/app-rank")
@auth_required
def get_app_rank():
    db = SessionLocal()
    limit = min(request.args.get("limit", 12, type=int), 50)
    try:
        return jsonify(stats.app_resource_rank(db, limit=limit))
    finally:
        db.close()


@bp.get("/resource-overview")
@auth_required
def get_resource_overview():
    db = SessionLocal()
    try:
        return jsonify(stats.resource_overview(db))
    finally:
        db.close()
