from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import Server


DEMO_OFFLINE_NODES = [
    {
        "server_key": "demo-offline-0004",
        "hostname": "ecs2-agent1-0004",
        "ip_address": "192.168.17.250",
        "os_name": "Ubuntu 22.04 LTS",
        "agent_version": "demo-offline",
        "cpu_cores": 2,
        "memory_total_gb": 4.0,
        "disk_total_gb": 40.0,
    },
    {
        "server_key": "demo-offline-0005",
        "hostname": "ecs2-agent1-0005",
        "ip_address": "192.168.17.251",
        "os_name": "Ubuntu 22.04 LTS",
        "agent_version": "demo-offline",
        "cpu_cores": 2,
        "memory_total_gb": 4.0,
        "disk_total_gb": 40.0,
    },
]


def main() -> None:
    db = SessionLocal()
    try:
        last_seen = datetime.utcnow() - timedelta(minutes=15)
        created = 0
        updated = 0
        for payload in DEMO_OFFLINE_NODES:
            server = db.query(Server).filter(Server.server_key == payload["server_key"]).first()
            if server is None:
                server = Server(**payload)
                db.add(server)
                created += 1
            else:
                for key, value in payload.items():
                    setattr(server, key, value)
                updated += 1
            server.status = "offline"
            server.risk_level = "高危"
            server.last_seen = last_seen
        db.commit()
        print(f"seeded offline demo nodes: created={created}, updated={updated}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
