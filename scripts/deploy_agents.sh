#!/usr/bin/env bash
set -euo pipefail

AGENTS_FILE="${1:-scripts/agents.txt}"
SSH_USER="${SSH_USER:-root}"
SSH_OPTS="${SSH_OPTS:--o BatchMode=yes -o StrictHostKeyChecking=accept-new}"
CENTER_IP="${CENTER_IP:-$(hostname -I | awk '{print $1}')}"
CENTER_URL="${CENTER_URL:-http://${CENTER_IP}}"
AGENT_TOKEN="${AGENT_TOKEN:-cloud-monitor-agent-token}"
INTERVAL="${COLLECT_INTERVAL:-3}"
DEPS_DIR="${DEPS_DIR:-/tmp/cloud-monitor-agent-deps}"
REPO_DEPS_DIR="${REPO_DEPS_DIR:-agent/deps}"

if [[ ! -f "${AGENTS_FILE}" ]]; then
  echo "Agent list not found: ${AGENTS_FILE}"
  echo "Create it from scripts/agents.txt.example"
  exit 1
fi

echo "Center URL: ${CENTER_URL}"
mkdir -p "${DEPS_DIR}"
if compgen -G "${REPO_DEPS_DIR}/python3-psutil_*.deb" > /dev/null; then
  cp "${REPO_DEPS_DIR}"/python3-psutil_*.deb "${DEPS_DIR}/"
elif ! compgen -G "${DEPS_DIR}/python3-psutil_*.deb" > /dev/null; then
  apt-get update
  apt-get download python3-psutil -o Dir::Cache="${DEPS_DIR}" -o Dir::Cache::archives="${DEPS_DIR}"
fi

while read -r HOST; do
  [[ -z "${HOST}" || "${HOST}" =~ ^# ]] && continue
  echo "Deploying agent to ${HOST}"

  ssh -n ${SSH_OPTS} "${SSH_USER}@${HOST}" "mkdir -p /opt/cloud-monitor-agent/backend/app/services /tmp/cloud-monitor-agent-deps"
  scp ${SSH_OPTS} agent/collector.py "${SSH_USER}@${HOST}:/opt/cloud-monitor-agent/collector.py"
  scp ${SSH_OPTS} agent/requirements.txt "${SSH_USER}@${HOST}:/opt/cloud-monitor-agent/requirements.txt"
  scp ${SSH_OPTS} backend/app/services/host_metrics.py "${SSH_USER}@${HOST}:/opt/cloud-monitor-agent/backend/app/services/host_metrics.py"
  scp ${SSH_OPTS} "${DEPS_DIR}"/python3-psutil_*.deb "${SSH_USER}@${HOST}:/tmp/cloud-monitor-agent-deps/"
  ssh -n ${SSH_OPTS} "${SSH_USER}@${HOST}" "touch /opt/cloud-monitor-agent/backend/__init__.py /opt/cloud-monitor-agent/backend/app/__init__.py /opt/cloud-monitor-agent/backend/app/services/__init__.py"

  ssh -n ${SSH_OPTS} "${SSH_USER}@${HOST}" "cat > /etc/systemd/system/cloud-monitor-agent.service <<EOF
[Unit]
Description=Cloud Monitor Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/cloud-monitor-agent
Environment=CENTER_URL=${CENTER_URL}
Environment=AGENT_TOKEN=${AGENT_TOKEN}
Environment=COLLECT_INTERVAL=${INTERVAL}
ExecStart=/usr/bin/python3 /opt/cloud-monitor-agent/collector.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
dpkg -i /tmp/cloud-monitor-agent-deps/python3-psutil_*.deb || apt-get install -f -y
systemctl daemon-reload
systemctl enable cloud-monitor-agent
systemctl restart cloud-monitor-agent"

  echo "Agent deployed to ${HOST}"
done < "${AGENTS_FILE}"
