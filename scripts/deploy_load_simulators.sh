#!/usr/bin/env bash
set -euo pipefail

AGENTS_FILE="${1:-scripts/agents.txt}"
SSH_USER="${SSH_USER:-root}"
SSH_OPTS="${SSH_OPTS:--o BatchMode=yes -o StrictHostKeyChecking=accept-new}"
CENTER_IP="${CENTER_IP:-$(hostname -I | awk '{print $1}')}"
NETWORK_URL="${LOAD_NETWORK_URL:-http://${CENTER_IP}/vendor/echarts/echarts.min.js}"
MODE="${LOAD_MODE:-normal}"
CPU_MIN="${LOAD_CPU_MIN:-}"
CPU_MAX="${LOAD_CPU_MAX:-}"
WORKERS="${LOAD_WORKERS:-}"
MEMORY_MIN_MB="${LOAD_MEMORY_MIN_MB:-}"
MEMORY_MAX_MB="${LOAD_MEMORY_MAX_MB:-}"
DISK_WRITE_MB="${LOAD_DISK_WRITE_MB:-}"
DISK_INTERVAL="${LOAD_DISK_INTERVAL:-}"
NETWORK_INTERVAL="${LOAD_NETWORK_INTERVAL:-}"

if [[ ! -f "${AGENTS_FILE}" ]]; then
  echo "Agent list not found: ${AGENTS_FILE}"
  exit 1
fi

if [[ "${MODE}" != "normal" && "${MODE}" != "warning" && "${MODE}" != "danger" ]]; then
  echo "Unsupported LOAD_MODE: ${MODE}. Use normal, warning or danger."
  exit 1
fi

INDEX=0
while read -r HOST; do
  [[ -z "${HOST}" || "${HOST}" =~ ^# ]] && continue
  INDEX=$((INDEX + 1))
  PROFILE=$(( (INDEX - 1) % 3 ))
  if [[ "${PROFILE}" -eq 0 ]]; then
    if [[ "${MODE}" == "danger" ]]; then
      NODE_CPU_MIN="${CPU_MIN:-0.88}"
      NODE_CPU_MAX="${CPU_MAX:-0.98}"
      NODE_WORKERS="${WORKERS:-4}"
    elif [[ "${MODE}" == "warning" ]]; then
      NODE_CPU_MIN="${CPU_MIN:-0.64}"
      NODE_CPU_MAX="${CPU_MAX:-0.84}"
      NODE_WORKERS="${WORKERS:-3}"
    else
      NODE_CPU_MIN="${CPU_MIN:-0.18}"
      NODE_CPU_MAX="${CPU_MAX:-0.56}"
      NODE_WORKERS="${WORKERS:-1}"
    fi
    NODE_MEMORY_MIN_MB="${MEMORY_MIN_MB:-96}"
    NODE_MEMORY_MAX_MB="${MEMORY_MAX_MB:-384}"
    NODE_DISK_WRITE_MB="${DISK_WRITE_MB:-6}"
    NODE_DISK_INTERVAL="${DISK_INTERVAL:-2.5}"
    NODE_NETWORK_INTERVAL="${NETWORK_INTERVAL:-1.5}"
  elif [[ "${PROFILE}" -eq 1 ]]; then
    if [[ "${MODE}" == "danger" ]]; then
      NODE_CPU_MIN="${CPU_MIN:-0.90}"
      NODE_CPU_MAX="${CPU_MAX:-0.98}"
      NODE_WORKERS="${WORKERS:-4}"
    elif [[ "${MODE}" == "warning" ]]; then
      NODE_CPU_MIN="${CPU_MIN:-0.60}"
      NODE_CPU_MAX="${CPU_MAX:-0.80}"
      NODE_WORKERS="${WORKERS:-3}"
    else
      NODE_CPU_MIN="${CPU_MIN:-0.12}"
      NODE_CPU_MAX="${CPU_MAX:-0.46}"
      NODE_WORKERS="${WORKERS:-1}"
    fi
    NODE_MEMORY_MIN_MB="${MEMORY_MIN_MB:-128}"
    NODE_MEMORY_MAX_MB="${MEMORY_MAX_MB:-512}"
    NODE_DISK_WRITE_MB="${DISK_WRITE_MB:-8}"
    NODE_DISK_INTERVAL="${DISK_INTERVAL:-3.0}"
    NODE_NETWORK_INTERVAL="${NETWORK_INTERVAL:-1.9}"
  else
    if [[ "${MODE}" == "danger" ]]; then
      NODE_CPU_MIN="${CPU_MIN:-0.92}"
      NODE_CPU_MAX="${CPU_MAX:-0.98}"
      NODE_WORKERS="${WORKERS:-4}"
    elif [[ "${MODE}" == "warning" ]]; then
      NODE_CPU_MIN="${CPU_MIN:-0.68}"
      NODE_CPU_MAX="${CPU_MAX:-0.88}"
      NODE_WORKERS="${WORKERS:-3}"
    else
      NODE_CPU_MIN="${CPU_MIN:-0.24}"
      NODE_CPU_MAX="${CPU_MAX:-0.68}"
      NODE_WORKERS="${WORKERS:-1}"
    fi
    NODE_MEMORY_MIN_MB="${MEMORY_MIN_MB:-160}"
    NODE_MEMORY_MAX_MB="${MEMORY_MAX_MB:-640}"
    NODE_DISK_WRITE_MB="${DISK_WRITE_MB:-10}"
    NODE_DISK_INTERVAL="${DISK_INTERVAL:-3.5}"
    NODE_NETWORK_INTERVAL="${NETWORK_INTERVAL:-2.3}"
  fi
  echo "Deploying load simulator to ${HOST}"
  echo "Mode ${MODE}, profile ${INDEX}: cpu=${NODE_CPU_MIN}-${NODE_CPU_MAX}, workers=${NODE_WORKERS}, memory=${NODE_MEMORY_MIN_MB}-${NODE_MEMORY_MAX_MB}MB, network=${NETWORK_URL}"

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
ExecStart=/usr/bin/python3 /opt/cloud-monitor-agent/load_simulator.py --cpu-min ${NODE_CPU_MIN} --cpu-max ${NODE_CPU_MAX} --workers ${NODE_WORKERS} --memory-min-mb ${NODE_MEMORY_MIN_MB} --memory-max-mb ${NODE_MEMORY_MAX_MB} --disk-write-mb ${NODE_DISK_WRITE_MB} --disk-interval ${NODE_DISK_INTERVAL} --network-url ${NETWORK_URL} --network-interval ${NODE_NETWORK_INTERVAL}
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
