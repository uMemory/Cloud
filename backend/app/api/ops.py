from __future__ import annotations

import os
import subprocess
from pathlib import Path

from flask import Blueprint, jsonify, request

from app.deps import auth_required

bp = Blueprint("ops", __name__, url_prefix="/api/ops")

ROOT_DIR = Path(os.getenv("PROJECT_ROOT", "/app"))
AGENTS_FILE = os.getenv("AGENTS_FILE", "scripts/agents.txt")


def run_script(script_name: str, extra_env: dict[str, str] | None = None) -> dict:
    script_path = ROOT_DIR / "scripts" / script_name
    agents_path = ROOT_DIR / AGENTS_FILE
    if not script_path.exists():
        return {"ok": False, "detail": f"脚本不存在: {script_path}"}
    if not agents_path.exists():
        return {"ok": False, "detail": f"Agent 列表不存在: {agents_path}"}

    env = os.environ.copy()
    env.setdefault("SSH_OPTS", "-o BatchMode=yes -o StrictHostKeyChecking=accept-new")
    if extra_env:
        env.update(extra_env)
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
    payload = request.get_json(silent=True) or {}
    mode = payload.get("mode") or "normal"
    if mode not in {"normal", "warning", "danger"}:
        return jsonify({"ok": False, "detail": "模拟模式无效"}), 400
    result = run_script("deploy_load_simulators.sh", {"LOAD_MODE": mode})
    status = 200 if result["ok"] else 500
    return jsonify(result), status


@bp.post("/load/stop")
@auth_required
def stop_load():
    result = run_script("stop_load_simulators.sh")
    status = 200 if result["ok"] else 500
    return jsonify(result), status
