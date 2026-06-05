from __future__ import annotations

from dataclasses import dataclass


def ratio(request: float, limit: float) -> float:
    return round(float(request) / float(limit), 4) if limit else 0.0


def enrich_features(row: dict) -> dict:
    features = dict(row)
    features["schedule_delay"] = max(0.0, (row.get("scheduled_time") or 0) - (row.get("creation_time") or 0))
    features["running_duration"] = max(0.0, (row.get("deletion_time") or 0) - (row.get("scheduled_time") or 0))
    features["cpu_ratio"] = ratio(row.get("cpu_request", 0), row.get("cpu_limit", 0))
    features["gpu_ratio"] = ratio(row.get("gpu_request", 0), row.get("gpu_limit", 0))
    features["rdma_ratio"] = ratio(row.get("rdma_request", 0), row.get("rdma_limit", 0))
    features["memory_ratio"] = ratio(row.get("memory_request", 0), row.get("memory_limit", 0))
    features["disk_ratio"] = ratio(row.get("disk_request", 0), row.get("disk_limit", 0))
    features["resource_density"] = round(
        row.get("cpu_request", 0) * 2.0
        + row.get("gpu_request", 0) * 28.0
        + row.get("rdma_request", 0) * 0.45
        + row.get("memory_request", 0) * 0.18
        + row.get("disk_request", 0) * 0.015,
        4,
    )
    return features


@dataclass
class RiskResult:
    risk_score: float
    risk_level: str
    reasons: list[str]
    suggestions: list[str]


def assess_risk(features: dict) -> RiskResult:
    f = enrich_features(features)
    score = 0.0
    reasons: list[str] = []
    suggestions: list[str] = []

    weights = {
        "gpu_ratio": 10,
        "memory_ratio": 9,
        "disk_ratio": 7,
        "cpu_ratio": 7,
        "rdma_ratio": 6,
    }
    for key, weight in weights.items():
        value = min(max(float(f.get(key, 0)), 0), 1.5)
        pressure = max(0.0, (value - 0.85) / 0.65)
        score += min(weight, pressure * weight)

    density = float(f.get("resource_density", 0))
    delay = float(f.get("schedule_delay", 0))
    duration = float(f.get("running_duration", 0))
    max_per_node = float(f.get("max_instance_per_node", 0))

    if density > 120:
        score += 32
        reasons.append("资源密度较高，单实例会给调度带来明显压力")
        suggestions.append("优先检查 GPU、内存和 RDMA 配额，必要时拆分服务实例")
    elif density > 80:
        score += 18
        reasons.append("资源密度中等偏高")

    if delay > 3600:
        score += 22
        reasons.append("调度等待时间超过 1 小时")
        suggestions.append("检查队列拥塞或同应用实例并发提交情况")
    elif delay > 600:
        score += 11
        reasons.append("存在较长调度等待")

    if duration > 86400:
        score += 9
        reasons.append("实例运行时间较长，可能占用稳定资源")

    if max_per_node >= 8 and f.get("gpu_request", 0) >= 1:
        score += 10
        reasons.append("单节点实例密度较高且包含 GPU 请求")
        suggestions.append("降低单节点实例密度或提高节点资源隔离")

    if not reasons:
        reasons.append("资源请求和生命周期指标处于正常范围")
    if not suggestions:
        suggestions.append("保持当前资源配置，持续观察调度延迟趋势")

    score = round(min(100.0, score), 2)
    if score >= 55:
        level = "高危"
    elif score >= 45:
        level = "预警"
    else:
        level = "正常"
    return RiskResult(score, level, reasons, suggestions)


MODEL_FEATURES = [
    {"name": "role", "label": "实例角色", "type": "select", "options": ["HN", "RN"]},
    {"name": "cpu_request", "label": "CPU 请求", "min": 1, "max": 64, "step": 1},
    {"name": "cpu_limit", "label": "CPU 上限", "min": 1, "max": 64, "step": 1},
    {"name": "gpu_request", "label": "GPU 请求", "min": 0, "max": 8, "step": 1},
    {"name": "gpu_limit", "label": "GPU 上限", "min": 1, "max": 8, "step": 1},
    {"name": "rdma_request", "label": "RDMA 请求", "min": 0, "max": 100, "step": 1},
    {"name": "rdma_limit", "label": "RDMA 上限", "min": 1, "max": 100, "step": 1},
    {"name": "memory_request", "label": "内存请求", "min": 1, "max": 512, "step": 1},
    {"name": "memory_limit", "label": "内存上限", "min": 1, "max": 512, "step": 1},
    {"name": "disk_request", "label": "磁盘请求", "min": 0, "step": 1},
    {"name": "disk_limit", "label": "磁盘上限", "min": 1, "step": 1},
    {"name": "max_instance_per_node", "label": "单节点最大实例数", "min": 1, "max": 16, "step": 1},
    {"name": "schedule_delay", "label": "调度延迟(秒)", "min": 0, "max": 7200, "step": 1},
    {"name": "running_duration", "label": "运行时长(秒)", "min": 0, "max": 172800, "step": 1},
]
