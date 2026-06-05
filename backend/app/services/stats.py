from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import AiInstance, Alert


def summary(db: Session) -> dict:
    total = db.query(func.count(AiInstance.id)).scalar() or 0
    apps = db.query(func.count(func.distinct(AiInstance.app_name))).scalar() or 0
    roles = db.query(func.count(func.distinct(AiInstance.role))).scalar() or 0
    alerts = db.query(func.count(Alert.id)).scalar() or 0
    avg_score = db.query(func.avg(AiInstance.risk_score)).scalar() or 0
    high_risk = db.query(func.count(AiInstance.id)).filter(AiInstance.risk_level == "高危").scalar() or 0
    unscheduled = db.query(func.count(AiInstance.id)).filter(AiInstance.scheduled_time.is_(None)).scalar() or 0
    return {
        "total_instances": total,
        "app_count": apps,
        "role_count": roles,
        "alert_count": alerts,
        "avg_risk_score": round(float(avg_score), 2),
        "high_risk_count": high_risk,
        "unscheduled_count": unscheduled,
    }


def risk_distribution(db: Session) -> list[dict]:
    rows = db.query(AiInstance.risk_level, func.count(AiInstance.id)).group_by(AiInstance.risk_level).all()
    return [{"name": name, "value": count} for name, count in rows]


def app_resource_rank(db: Session, limit: int = 12) -> list[dict]:
    rows = (
        db.query(
            AiInstance.app_name,
            func.count(AiInstance.id),
            func.avg(AiInstance.cpu_request),
            func.avg(AiInstance.gpu_request),
            func.avg(AiInstance.memory_request),
            func.avg(AiInstance.risk_score),
        )
        .group_by(AiInstance.app_name)
        .order_by(func.avg(AiInstance.risk_score).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "app_name": r[0],
            "instance_count": r[1],
            "avg_cpu": round(float(r[2] or 0), 2),
            "avg_gpu": round(float(r[3] or 0), 2),
            "avg_memory": round(float(r[4] or 0), 2),
            "avg_risk": round(float(r[5] or 0), 2),
        }
        for r in rows
    ]


def resource_overview(db: Session) -> dict:
    row = db.query(
        func.avg(AiInstance.cpu_request),
        func.avg(AiInstance.gpu_request),
        func.avg(AiInstance.rdma_request),
        func.avg(AiInstance.memory_request),
        func.avg(AiInstance.disk_request),
        func.max(AiInstance.cpu_request),
        func.max(AiInstance.memory_request),
        func.max(AiInstance.disk_request),
    ).one()
    return {
        "avg": {
            "cpu": round(float(row[0] or 0), 2),
            "gpu": round(float(row[1] or 0), 2),
            "rdma": round(float(row[2] or 0), 2),
            "memory": round(float(row[3] or 0), 2),
            "disk": round(float(row[4] or 0), 2),
        },
        "max": {
            "cpu": round(float(row[5] or 0), 2),
            "memory": round(float(row[6] or 0), 2),
            "disk": round(float(row[7] or 0), 2),
        },
    }
