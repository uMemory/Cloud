FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app/backend

RUN . /etc/os-release \
    && rm -f /etc/apt/sources.list.d/debian.sources \
    && printf '%s\n' \
    "deb https://repo.huaweicloud.com/debian ${VERSION_CODENAME} main contrib non-free non-free-firmware" \
    "deb https://repo.huaweicloud.com/debian ${VERSION_CODENAME}-updates main contrib non-free non-free-firmware" \
    "deb https://repo.huaweicloud.com/debian-security ${VERSION_CODENAME}-security main contrib non-free non-free-firmware" \
    > /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends bash openssh-client \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --default-timeout=120 \
    -i https://repo.huaweicloud.com/repository/pypi/simple \
    --trusted-host repo.huaweicloud.com \
    -r /app/backend/requirements.txt

COPY backend /app/backend
COPY agent /app/agent
COPY scripts /app/scripts
RUN mkdir -p /app/data

CMD ["gunicorn", "--preload", "-w", "2", "-b", "0.0.0.0:8000", "--chdir", "/app/backend", "app.main:app"]
