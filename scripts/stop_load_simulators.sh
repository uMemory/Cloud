#!/usr/bin/env bash
set -euo pipefail

AGENTS_FILE="${1:-scripts/agents.txt}"
SSH_USER="${SSH_USER:-root}"
SSH_OPTS="${SSH_OPTS:--o BatchMode=yes -o StrictHostKeyChecking=accept-new}"

if [[ ! -f "${AGENTS_FILE}" ]]; then
  echo "Agent list not found: ${AGENTS_FILE}"
  exit 1
fi

while read -r HOST; do
  [[ -z "${HOST}" || "${HOST}" =~ ^# ]] && continue
  echo "Stopping load simulator on ${HOST}"
  ssh -n ${SSH_OPTS} "${SSH_USER}@${HOST}" "systemctl disable --now cloud-monitor-load || true"
  echo "Load simulator stopped on ${HOST}"
done < "${AGENTS_FILE}"
