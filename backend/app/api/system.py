from flask import Blueprint, jsonify

from app.deps import auth_required
from app.services.host_metrics import collect_local_metrics

bp = Blueprint("system", __name__, url_prefix="/api/system")


@bp.get("/live")
@auth_required
def live_metrics():
    payload = collect_local_metrics()
    raw = payload["metric"]["raw"]
    raw["risk_level"] = payload["risk_level"]
    raw["reasons"] = payload["reasons"]
    raw["suggestions"] = payload["suggestions"]
    return jsonify(raw)
