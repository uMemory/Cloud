import os
import socket
import time

import requests
import psutil

from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
if not BACKEND_DIR.exists():
    BACKEND_DIR = BASE_DIR.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))
from app.services.host_metrics import collect_local_metrics  # noqa: E402


CENTER_URL = os.getenv("CENTER_URL", "http://127.0.0.1:8000").rstrip("/")
AGENT_TOKEN = os.getenv("AGENT_TOKEN", "cloud-monitor-agent-token")
INTERVAL = int(os.getenv("COLLECT_INTERVAL", "3"))


def center_host() -> str:
    host = CENTER_URL.removeprefix("http://").removeprefix("https://").split("/", 1)[0].split(":", 1)[0]
    return host or "127.0.0.1"


def post(path: str, payload: dict) -> dict:
    response = requests.post(
        CENTER_URL + path,
        json=payload,
        headers={"X-Agent-Token": AGENT_TOKEN},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    server_id = None
    print(f"cloud-monitor-agent started on {socket.gethostname()}, center={CENTER_URL}")
    psutil.cpu_percent(interval=None)
    time.sleep(0.2)
    while True:
        try:
            payload = collect_local_metrics(center_host())
            if not server_id:
                registered = post("/api/agents/register", payload["server"])
                server_id = registered["server_id"]
                print(f"registered server_id={server_id}")
            report = {"server_id": server_id, "server": payload["server"], "metric": payload["metric"]}
            result = post("/api/metrics/report", report)
            print(f"reported metric_id={result['metric_id']} risk={result['risk_level']}")
        except Exception as exc:
            print(f"agent report failed: {exc}")
            server_id = None
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
