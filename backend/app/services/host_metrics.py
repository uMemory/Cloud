from __future__ import annotations

import platform
import socket
import time
from datetime import datetime

import psutil


def gb(value: float) -> float:
    return round(value / 1024 / 1024 / 1024, 2)


def mb(value: float) -> float:
    return round(value / 1024 / 1024, 2)


def local_ip(target_host: str = "8.8.8.8", target_port: int = 80) -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect((target_host, target_port))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def assess_host(cpu: float, memory: float, disk: float, swap: float = 0) -> tuple[str, list[str], list[str]]:
    reasons: list[str] = []
    suggestions: list[str] = []
    score = 0

    if cpu >= 90:
        score += 35
        reasons.append("CPU 使用率超过 90%，存在计算资源拥塞风险")
        suggestions.append("检查高 CPU 进程，必要时扩容或迁移计算任务")
    elif cpu >= 75:
        score += 20
        reasons.append("CPU 使用率偏高")

    if memory >= 90:
        score += 35
        reasons.append("内存使用率超过 90%，可能触发交换或 OOM")
        suggestions.append("释放无用进程，降低服务并发或增加内存规格")
    elif memory >= 80:
        score += 20
        reasons.append("内存使用率偏高")

    if disk >= 90:
        score += 30
        reasons.append("磁盘使用率超过 90%，日志和数据写入存在风险")
        suggestions.append("清理日志、扩容磁盘或迁移历史数据")
    elif disk >= 80:
        score += 15
        reasons.append("磁盘容量偏紧")

    if swap >= 30:
        score += 10
        reasons.append("交换分区使用率偏高")
        suggestions.append("检查内存压力，避免频繁换页影响服务响应")

    if not reasons:
        reasons.append("CPU、内存和磁盘处于正常范围")
    if not suggestions:
        suggestions.append("保持当前资源配置，持续观察趋势变化")

    if score >= 60:
        level = "高危"
    elif score >= 25:
        level = "预警"
    else:
        level = "正常"
    return level, reasons, suggestions


def collect_local_metrics(center_host: str | None = None) -> dict:
    cpu_percent = psutil.cpu_percent(interval=0.8)
    per_cpu = psutil.cpu_percent(interval=None, percpu=True)
    if cpu_percent == 0 and per_cpu:
        cpu_percent = sum(per_cpu) / len(per_cpu)
    virtual_memory = psutil.virtual_memory()
    swap_memory = psutil.swap_memory()
    disk_usage = psutil.disk_usage("/")

    disk_first = psutil.disk_io_counters()
    net_first = psutil.net_io_counters()
    time.sleep(0.2)
    disk_second = psutil.disk_io_counters()
    net_second = psutil.net_io_counters()
    interval = 0.2

    disk_read = mb(((disk_second.read_bytes - disk_first.read_bytes) / interval) if disk_first and disk_second else 0)
    disk_write = mb(((disk_second.write_bytes - disk_first.write_bytes) / interval) if disk_first and disk_second else 0)
    net_recv = mb((net_second.bytes_recv - net_first.bytes_recv) / interval)
    net_send = mb((net_second.bytes_sent - net_first.bytes_sent) / interval)

    freq = psutil.cpu_freq()
    boot_time = datetime.fromtimestamp(psutil.boot_time())
    level, reasons, suggestions = assess_host(cpu_percent, virtual_memory.percent, disk_usage.percent, swap_memory.percent)
    ip = local_ip(center_host) if center_host else local_ip()

    return {
        "server": {
            "server_key": f"{socket.gethostname()}-{ip}",
            "hostname": socket.gethostname(),
            "ip_address": ip,
            "os_name": f"{platform.system()} {platform.release()}",
            "agent_version": "local-collector",
            "cpu_cores": psutil.cpu_count(logical=True),
            "memory_total_gb": gb(virtual_memory.total),
            "disk_total_gb": gb(disk_usage.total),
        },
        "metric": {
            "cpu_percent": round(cpu_percent, 2),
            "memory_percent": round(virtual_memory.percent, 2),
            "disk_percent": round(disk_usage.percent, 2),
            "swap_percent": round(swap_memory.percent, 2),
            "network_recv_mb_s": net_recv,
            "network_send_mb_s": net_send,
            "disk_read_mb_s": disk_read,
            "disk_write_mb_s": disk_write,
            "process_count": len(psutil.pids()),
            "risk_level": level,
            "raw": {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "reasons": reasons,
                "suggestions": suggestions,
                "cpu": {
                    "percent": round(cpu_percent, 2),
                    "per_core": [round(x, 2) for x in per_cpu],
                    "cores_logical": psutil.cpu_count(logical=True),
                    "cores_physical": psutil.cpu_count(logical=False),
                    "freq_mhz": round(freq.current, 2) if freq else None,
                },
                "memory": {
                    "percent": round(virtual_memory.percent, 2),
                    "total_gb": gb(virtual_memory.total),
                    "used_gb": gb(virtual_memory.used),
                    "available_gb": gb(virtual_memory.available),
                },
                "swap": {
                    "percent": round(swap_memory.percent, 2),
                    "total_gb": gb(swap_memory.total),
                    "used_gb": gb(swap_memory.used),
                    "free_gb": gb(swap_memory.free),
                },
                "disk": {
                    "percent": round(disk_usage.percent, 2),
                    "total_gb": gb(disk_usage.total),
                    "used_gb": gb(disk_usage.used),
                    "free_gb": gb(disk_usage.free),
                    "read_mb_s": disk_read,
                    "write_mb_s": disk_write,
                },
                "network": {
                    "bytes_sent_gb": gb(net_second.bytes_sent),
                    "bytes_recv_gb": gb(net_second.bytes_recv),
                    "send_mb_s": net_send,
                    "recv_mb_s": net_recv,
                    "packets_sent": net_second.packets_sent,
                    "packets_recv": net_second.packets_recv,
                },
                "process_count": len(psutil.pids()),
                "boot_time": boot_time.isoformat(),
                "uptime_seconds": int((datetime.now() - boot_time).total_seconds()),
            },
        },
        "risk_level": level,
        "reasons": reasons,
        "suggestions": suggestions,
    }
