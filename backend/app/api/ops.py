from __future__ import annotations

import os
import subprocess
from pathlib import Path

from flask import Blueprint, jsonify

from app.deps import auth_required

bp = Blueprint("ops", __name__, url_prefix="/api/ops")

ROOT_DIR = Path(os.getenv("PROJECT_ROOT", "/app"))
AGENTS_FILE = os.getenv("AGENTS_FILE", "scripts/agents.txt")


def run_script(script_name: str) -> dict:
    script_path = ROOT_DIR / "scripts" / script_name
    agents_path = ROOT_DIR / AGENTS_FILE
    if not script_path.exists():
        return {"ok": False, "detail": f"脚本不存在: {script_path}"}
    if not agents_path.exists():
        return {"ok": False, "detail": f"Agent 列表不存在: {agents_path}"}

    env = os.environ.copy()
    env.setdefault("SSH_OPTS", "-o BatchMode=yes -o StrictHostKeyChecking=accept-new")
    result = subprocess.run(
        ["bash", str(script_path), str(agents_path)],
        cwd=str(ROOT_DIR),
        env=env,
        text=True,
        capture_output=True,
        timeout=90,
        check=False,
    )
    return {
        "ok": result.returncode == 0,
        "returncode": result.returncode,
        "stdout": result.stdout[-4000:],
        "stderr": result.stderr[-4000:],
    }


@bp.post("/load/start")
@auth_required
def start_load():
    result = run_script("deploy_load_simulators.sh")
    status = 200 if result["ok"] else 500
    return jsonify(result), status


@bp.post("/load/stop")
@auth_required
def stop_load():
    result = run_script("stop_load_simulators.sh")
    status = 200 if result["ok"] else 500
    return jsonify(result), status
