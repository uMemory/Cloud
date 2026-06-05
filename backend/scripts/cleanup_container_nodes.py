from app.database import SessionLocal
from app.models import Server


def is_docker_local_collector(server: Server) -> bool:
    ip = server.ip_address or ""
    parts = ip.split(".")
    is_bridge_ip = len(parts) == 4 and parts[0] == "172" and parts[1].isdigit() and 16 <= int(parts[1]) <= 31
    return server.agent_version == "local-collector" and is_bridge_ip


def main() -> None:
    db = SessionLocal()
    try:
        rows = db.query(Server).all()
        targets = [server for server in rows if is_docker_local_collector(server)]
        for server in targets:
            print(f"delete docker local collector: {server.hostname} {server.ip_address}")
            db.delete(server)
        db.commit()
        print(f"deleted {len(targets)} docker local collector node(s)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
