import os
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import AiInstance, Alert, User
from app.security import hash_password
from app.services.risk import assess_risk, enrich_features


RAW_COLUMNS = [
    "instance_sn", "role", "app_name", "cpu_request", "cpu_limit", "gpu_request", "gpu_limit",
    "rdma_request", "rdma_limit", "memory_request", "memory_limit", "disk_request", "disk_limit",
    "max_instance_per_node", "creation_time", "scheduled_time", "deletion_time",
]


def clean_float(value):
    return None if pd.isna(value) else float(value)


def import_trace(csv_path: Path | None = None):
    csv_path = csv_path or settings.data_path
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV 不存在: {csv_path}")

    print(f"[load] {csv_path}")
    df = pd.read_csv(csv_path)
    missing = set(RAW_COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(f"CSV 缺少字段: {sorted(missing)}")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.query(Alert).delete()
        db.query(AiInstance).delete()
        db.query(User).filter(User.username == "admin").delete()

        admin = User(username="admin", email="admin@example.com", password_hash=hash_password("admin123"))
        db.add(admin)

        batch = []
        alerts = []
        for _, row in df.iterrows():
            raw = {col: clean_float(row[col]) if col not in ("instance_sn", "role", "app_name") else str(row[col]) for col in RAW_COLUMNS}
            raw["max_instance_per_node"] = int(raw["max_instance_per_node"] or 0)
            enriched = enrich_features(raw)
            risk = assess_risk(enriched)
            item = AiInstance(
                **raw,
                schedule_delay=enriched["schedule_delay"],
                running_duration=enriched["running_duration"],
                cpu_ratio=enriched["cpu_ratio"],
                gpu_ratio=enriched["gpu_ratio"],
                rdma_ratio=enriched["rdma_ratio"],
                memory_ratio=enriched["memory_ratio"],
                disk_ratio=enriched["disk_ratio"],
                resource_density=enriched["resource_density"],
                risk_score=risk.risk_score,
                risk_level=risk.risk_level,
            )
            batch.append(item)
            if len(batch) >= 1000:
                db.add_all(batch)
                db.flush()
                alerts.extend(make_alerts(batch))
                db.add_all(alerts)
                db.commit()
                print(f"[import] {len(batch)} rows committed")
                batch = []
                alerts = []

        if batch:
            db.add_all(batch)
            db.flush()
            db.add_all(make_alerts(batch))
            db.commit()

        total = db.query(AiInstance).count()
        alert_count = db.query(Alert).count()
        print(f"[done] instances={total}, alerts={alert_count}, default user=admin/admin123")
    finally:
        db.close()


def make_alerts(items: list[AiInstance]) -> list[Alert]:
    rows: list[Alert] = []
    for item in items:
        if item.risk_level == "正常":
            continue
        if item.schedule_delay > 3600:
            rows.append(Alert(instance_id=item.id, alert_type="调度延迟", level=item.risk_level, message="调度等待超过 1 小时"))
        if item.resource_density > 120:
            rows.append(Alert(instance_id=item.id, alert_type="资源密度", level=item.risk_level, message="资源请求密度较高"))
        if item.gpu_ratio >= 1 and item.memory_ratio >= 1:
            rows.append(Alert(instance_id=item.id, alert_type="资源上限", level=item.risk_level, message="GPU 与内存请求接近或达到上限"))
        if not rows and item.risk_level != "正常":
            rows.append(Alert(instance_id=item.id, alert_type="综合风险", level=item.risk_level, message="综合风险评分达到预警阈值"))
    return rows


if __name__ == "__main__":
    import_trace()
