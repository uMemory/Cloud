from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.config import settings
from app.database import SessionLocal
from app.deps import auth_required
from app.models import Server, ServerAlert, ServerMetric
from app.services.host_metrics import collect_local_metrics

bp = Blueprint("metrics", __name__, url_prefix="/api")


def agent_allowed() -> bool:
    token = request.headers.get("X-Agent-Token") or (request.get_json(silent=True) or {}).get("agent_token")
    return token == settings.agent_token


def metric_alerts(metric: dict) -> list[dict]:
    alerts = []
    checks = [
        ("CPU", metric.get("cpu_percent", 0), 90, 75, "检查高 CPU 进程或降低计算任务并发"),
        ("Memory", metric.get("memory_percent", 0), 90, 80, "释放无用进程或增加内存规格"),
        ("Disk", metric.get("disk_percent", 0), 90, 80, "清理日志、缓存或扩容磁盘"),
        ("Swap", metric.get("swap_percent", 0), 60, 30, "检查内存压力，避免频繁换页"),
    ]
    for name, value, danger, warning, suggestion in checks:
        if value >= danger:
            alerts.append({"alert_type": name, "level": "高危", "message": f"{name} 使用率 {value:.1f}%", "suggestion": suggestion})
        elif value >= warning:
            alerts.append({"alert_type": name, "level": "预警", "message": f"{name} 使用率 {value:.1f}%", "suggestion": suggestion})
    return alerts


def upsert_server(db, server_payload: dict) -> Server:
    server_key = server_payload.get("server_key") or f"{server_payload.get('hostname')}-{server_payload.get('ip_address')}"
    server = db.query(Server).filter(Server.server_key == server_key).first()
    if not server:
        server = Server(server_key=server_key, hostname=server_payload.get("hostname") or "unknown", ip_address=server_payload.get("ip_address") or "0.0.0.0")
        db.add(server)
    server.hostname = server_payload.get("hostname") or server.hostname
    server.ip_address = server_payload.get("ip_address") or server.ip_address
    server.os_name = server_payload.get("os_name")
    server.agent_version = server_payload.get("agent_version")
    server.cpu_cores = server_payload.get("cpu_cores")
    server.memory_total_gb = server_payload.get("memory_total_gb")
    server.disk_total_gb = server_payload.get("disk_total_gb")
    server.status = "online"
    server.last_seen = datetime.utcnow()
    return server


def save_metric(db, server: Server, metric_payload: dict) -> ServerMetric:
    metric = ServerMetric(
        server=server,
        cpu_percent=float(metric_payload.get("cpu_percent", 0)),
        memory_percent=float(metric_payload.get("memory_percent", 0)),
        disk_percent=float(metric_payload.get("disk_percent", 0)),
        swap_percent=float(metric_payload.get("swap_percent", 0)),
        network_recv_mb_s=float(metric_payload.get("network_recv_mb_s", 0)),
        network_send_mb_s=float(metric_payload.get("network_send_mb_s", 0)),
        disk_read_mb_s=float(metric_payload.get("disk_read_mb_s", 0)),
        disk_write_mb_s=float(metric_payload.get("disk_write_mb_s", 0)),
        process_count=int(metric_payload.get("process_count", 0)),
        risk_level=metric_payload.get("risk_level") or "正常",
        raw=metric_payload.get("raw"),
    )
    server.risk_level = metric.risk_level
    server.last_seen = datetime.utcnow()
    db.add(metric)
    db.flush()
    create_alerts(db, server, metric)
    return metric


def create_alerts(db, server: Server, metric: ServerMetric) -> None:
    values = {
        "cpu_percent": metric.cpu_percent,
        "memory_percent": metric.memory_percent,
        "disk_percent": metric.disk_percent,
        "swap_percent": metric.swap_percent,
    }
    recent_since = datetime.utcnow() - timedelta(minutes=5)
    for alert in metric_alerts(values):
        exists = (
            db.query(ServerAlert)
            .filter(
                ServerAlert.server_id == server.id,
                ServerAlert.alert_type == alert["alert_type"],
                ServerAlert.status != "已解决",
                ServerAlert.created_at >= recent_since,
            )
            .first()
        )
        if exists:
            continue
        db.add(ServerAlert(server=server, **alert))


def metric_dict(metric: ServerMetric | None) -> dict | None:
    if not metric:
        return None
    return {
        "id": metric.id,
        "server_id": metric.server_id,
        "cpu_percent": metric.cpu_percent,
        "memory_percent": metric.memory_percent,
        "disk_percent": metric.disk_percent,
        "swap_percent": metric.swap_percent,
        "network_recv_mb_s": metric.network_recv_mb_s,
        "network_send_mb_s": metric.network_send_mb_s,
        "disk_read_mb_s": metric.disk_read_mb_s,
        "disk_write_mb_s": metric.disk_write_mb_s,
        "process_count": metric.process_count,
        "risk_level": metric.risk_level,
        "created_at": metric.created_at.isoformat() if metric.created_at else None,
    }


def is_docker_local_collector(server: Server) -> bool:
    ip = server.ip_address or ""
    first_parts = ip.split(".")
    is_bridge_ip = len(first_parts) == 4 and first_parts[0] == "172" and first_parts[1].isdigit() and 16 <= int(first_parts[1]) <= 31
    return server.agent_version == "local-collector" and is_bridge_ip


@bp.post("/agents/register")
def register_agent():
    if not agent_allowed():
        return jsonify({"detail": "Agent token 无效"}), 401
    payload = request.get_json(silent=True) or {}
    db = SessionLocal()
    try:
        server = upsert_server(db, payload)
        db.commit()
        db.refresh(server)
        return jsonify({"server_id": server.id, "message": "registered"})
    finally:
        db.close()


@bp.post("/metrics/report")
def report_metric():
    if not agent_allowed():
        return jsonify({"detail": "Agent token 无效"}), 401
    payload = request.get_json(silent=True) or {}
    db = SessionLocal()
    try:
        server_payload = payload.get("server") or {}
        metric_payload = payload.get("metric") or payload
        server = db.get(Server, payload.get("server_id")) if payload.get("server_id") else None
        if not server:
            server = upsert_server(db, server_payload)
        metric = save_metric(db, server, metric_payload)
        db.commit()
        return jsonify({"metric_id": metric.id, "server_id": server.id, "risk_level": metric.risk_level})
    finally:
        db.close()


@bp.post("/metrics/collect-local")
@auth_required
def collect_local():
    payload = collect_local_metrics()
    db = SessionLocal()
    try:
        server = upsert_server(db, payload["server"])
        metric = save_metric(db, server, payload["metric"])
        db.commit()
        return jsonify({"server_id": server.id, "metric": metric_dict(metric), "risk_level": metric.risk_level})
    finally:
        db.close()


@bp.get("/servers")
@auth_required
def servers():
    db = SessionLocal()
    try:
        rows = db.query(Server).order_by(Server.last_seen.desc()).all()
        result = []
        for server in rows:
            if is_docker_local_collector(server):
                continue
            latest = db.query(ServerMetric).filter(ServerMetric.server_id == server.id).order_by(ServerMetric.created_at.desc()).first()
            if server.last_seen < datetime.utcnow() - timedelta(seconds=30):
                server.status = "offline"
            result.append({
                "id": server.id,
                "hostname": server.hostname,
                "ip_address": server.ip_address,
                "os_name": server.os_name,
                "status": server.status,
                "risk_level": server.risk_level,
                "last_seen": server.last_seen.isoformat() if server.last_seen else None,
                "latest": metric_dict(latest),
            })
        db.commit()
        return jsonify(result)
    finally:
        db.close()


@bp.get("/metrics/latest")
@auth_required
def latest_metrics():
    db = SessionLocal()
    try:
        rows = db.query(Server).all()
        visible_servers = [server for server in rows if not is_docker_local_collector(server)]
        visible_ids = [server.id for server in visible_servers]
        now = datetime.utcnow()
        for server in visible_servers:
            if server.last_seen < now - timedelta(seconds=30):
                server.status = "offline"
        total = len(visible_servers)
        online = sum(1 for server in visible_servers if server.status == "online")
        alerts = db.query(func.count(ServerAlert.id)).filter(ServerAlert.server_id.in_(visible_ids), ServerAlert.status != "已解决").scalar() if visible_ids else 0
        high = sum(1 for server in visible_servers if server.risk_level == "高危")
        db.commit()
        return jsonify({"server_count": total, "online_count": online, "active_alert_count": alerts, "high_risk_count": high})
    finally:
        db.close()


@bp.get("/metrics/trend")
@auth_required
def trend():
    server_id = request.args.get("server_id", type=int)
    limit = min(max(request.args.get("limit", 40, type=int), 1), 200)
    db = SessionLocal()
    try:
        query = db.query(ServerMetric)
        if server_id:
            query = query.filter(ServerMetric.server_id == server_id)
        else:
            rows = db.query(Server).all()
            visible_ids = [server.id for server in rows if not is_docker_local_collector(server)]
            query = query.filter(ServerMetric.server_id.in_(visible_ids)) if visible_ids else query.filter(False)
        rows = query.order_by(ServerMetric.created_at.desc()).limit(limit).all()
        return jsonify([metric_dict(x) for x in reversed(rows)])
    finally:
        db.close()


@bp.get("/server-alerts")
@auth_required
def server_alerts():
    db = SessionLocal()
    try:
        servers = db.query(Server).all()
        visible_ids = [server.id for server in servers if not is_docker_local_collector(server)]
        rows = (
            db.query(ServerAlert)
            .filter(ServerAlert.server_id.in_(visible_ids))
            .order_by(ServerAlert.created_at.desc())
            .limit(100)
            .all()
            if visible_ids else []
        )
        return jsonify([
            {
                "id": a.id,
                "server_id": a.server_id,
                "hostname": a.server.hostname if a.server else None,
                "ip_address": a.server.ip_address if a.server else None,
                "alert_type": a.alert_type,
                "level": a.level,
                "message": a.message,
                "suggestion": a.suggestion,
                "status": a.status,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in rows
        ])
    finally:
        db.close()


@bp.patch("/server-alerts/<int:alert_id>")
@auth_required
def update_server_alert(alert_id: int):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")
    allowed = {"未处理", "已确认", "已解决", "已忽略"}
    if status not in allowed:
        return jsonify({"detail": "告警状态无效"}), 400

    db = SessionLocal()
    try:
        alert = db.get(ServerAlert, alert_id)
        if not alert or is_docker_local_collector(alert.server):
            return jsonify({"detail": "告警不存在"}), 404
        alert.status = status
        db.commit()
        return jsonify({"id": alert.id, "status": alert.status})
    finally:
        db.close()
