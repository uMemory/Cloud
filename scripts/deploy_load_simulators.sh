#!/usr/bin/env bash
set -euo pipefail

AGENTS_FILE="${1:-scripts/agents.txt}"
SSH_USER="${SSH_USER:-root}"
SSH_OPTS="${SSH_OPTS:--o BatchMode=yes -o StrictHostKeyChecking=accept-new}"
CPU_MIN="${LOAD_CPU_MIN:-}"
CPU_MAX="${LOAD_CPU_MAX:-}"
WORKERS="${LOAD_WORKERS:-}"
MEMORY_MIN_MB="${LOAD_MEMORY_MIN_MB:-}"
MEMORY_MAX_MB="${LOAD_MEMORY_MAX_MB:-}"
DISK_WRITE_MB="${LOAD_DISK_WRITE_MB:-}"
DISK_INTERVAL="${LOAD_DISK_INTERVAL:-}"

if [[ ! -f "${AGENTS_FILE}" ]]; then
  echo "Agent list not found: ${AGENTS_FILE}"
  exit 1
fi

INDEX=0
while read -r HOST; do
  [[ -z "${HOST}" || "${HOST}" =~ ^# ]] && continue
  INDEX=$((INDEX + 1))
  PROFILE=$(( (INDEX - 1) % 3 ))
  if [[ "${PROFILE}" -eq 0 ]]; then
    NODE_CPU_MIN="${CPU_MIN:-0.18}"
    NODE_CPU_MAX="${CPU_MAX:-0.56}"
    NODE_WORKERS="${WORKERS:-1}"
    NODE_MEMORY_MIN_MB="${MEMORY_MIN_MB:-96}"
    NODE_MEMORY_MAX_MB="${MEMORY_MAX_MB:-384}"
    NODE_DISK_WRITE_MB="${DISK_WRITE_MB:-8}"
    NODE_DISK_INTERVAL="${DISK_INTERVAL:-5}"
  elif [[ "${PROFILE}" -eq 1 ]]; then
    NODE_CPU_MIN="${CPU_MIN:-0.12}"
    NODE_CPU_MAX="${CPU_MAX:-0.46}"
    NODE_WORKERS="${WORKERS:-1}"
    NODE_MEMORY_MIN_MB="${MEMORY_MIN_MB:-128}"
    NODE_MEMORY_MAX_MB="${MEMORY_MAX_MB:-512}"
    NODE_DISK_WRITE_MB="${DISK_WRITE_MB:-12}"
    NODE_DISK_INTERVAL="${DISK_INTERVAL:-7}"
  else
    NODE_CPU_MIN="${CPU_MIN:-0.24}"
    NODE_CPU_MAX="${CPU_MAX:-0.68}"
    NODE_WORKERS="${WORKERS:-1}"
    NODE_MEMORY_MIN_MB="${MEMORY_MIN_MB:-160}"
    NODE_MEMORY_MAX_MB="${MEMORY_MAX_MB:-640}"
    NODE_DISK_WRITE_MB="${DISK_WRITE_MB:-16}"
    NODE_DISK_INTERVAL="${DISK_INTERVAL:-9}"
  fi
  echo "Deploying load simulator to ${HOST}"
  echo "Profile ${INDEX}: cpu=${NODE_CPU_MIN}-${NODE_CPU_MAX}, workers=${NODE_WORKERS}, memory=${NODE_MEMORY_MIN_MB}-${NODE_MEMORY_MAX_MB}MB"

  ssh -n ${SSH_OPTS} "${SSH_USER}@${HOST}" "mkdir -p /opt/cloud-monitor-agent"
  scp ${SSH_OPTS} agent/load_simulator.py "${SSH_USER}@${HOST}:/opt/cloud-monitor-agent/load_simulator.py"
  ssh -n ${SSH_OPTS} "${SSH_USER}@${HOST}" "cat > /etc/systemd/system/cloud-monitor-load.service <<EOF
[Unit]
Description=Cloud Monitor Demo Load Simulator
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/cloud-monitor-agent
ExecStart=/usr/bin/python3 /opt/cloud-monitor-agent/load_simulator.py --cpu-min ${NODE_CPU_MIN} --cpu-max ${NODE_CPU_MAX} --workers ${NODE_WORKERS} --memory-min-mb ${NODE_MEMORY_MIN_MB} --memory-max-mb ${NODE_MEMORY_MAX_MB} --disk-write-mb ${NODE_DISK_WRITE_MB} --disk-interval ${NODE_DISK_INTERVAL}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable cloud-monitor-load
systemctl restart cloud-monitor-load"

  echo "Load simulator deployed to ${HOST}"
done < "${AGENTS_FILE}"
