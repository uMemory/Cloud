from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AiInstance(Base):
    __tablename__ = "ai_instances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    instance_sn: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(40), index=True)
    app_name: Mapped[str] = mapped_column(String(80), index=True)
    cpu_request: Mapped[float] = mapped_column(Float)
    cpu_limit: Mapped[float] = mapped_column(Float)
    gpu_request: Mapped[float] = mapped_column(Float)
    gpu_limit: Mapped[float] = mapped_column(Float)
    rdma_request: Mapped[float] = mapped_column(Float)
    rdma_limit: Mapped[float] = mapped_column(Float)
    memory_request: Mapped[float] = mapped_column(Float)
    memory_limit: Mapped[float] = mapped_column(Float)
    disk_request: Mapped[float] = mapped_column(Float)
    disk_limit: Mapped[float] = mapped_column(Float)
    max_instance_per_node: Mapped[int] = mapped_column(Integer)
    creation_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    scheduled_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    deletion_time: Mapped[float | None] = mapped_column(Float, nullable=True)

    schedule_delay: Mapped[float] = mapped_column(Float, default=0)
    running_duration: Mapped[float] = mapped_column(Float, default=0)
    cpu_ratio: Mapped[float] = mapped_column(Float, default=0)
    gpu_ratio: Mapped[float] = mapped_column(Float, default=0)
    rdma_ratio: Mapped[float] = mapped_column(Float, default=0)
    memory_ratio: Mapped[float] = mapped_column(Float, default=0)
    disk_ratio: Mapped[float] = mapped_column(Float, default=0)
    resource_density: Mapped[float] = mapped_column(Float, default=0)
    risk_score: Mapped[float] = mapped_column(Float, default=0)
    risk_level: Mapped[str] = mapped_column(String(20), index=True)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    instance_id: Mapped[int] = mapped_column(ForeignKey("ai_instances.id", ondelete="CASCADE"), index=True)
    alert_type: Mapped[str] = mapped_column(String(50))
    level: Mapped[str] = mapped_column(String(20), index=True)
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    instance: Mapped[AiInstance] = relationship()


class Server(Base):
    __tablename__ = "servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    hostname: Mapped[str] = mapped_column(String(120), index=True)
    ip_address: Mapped[str] = mapped_column(String(64), index=True)
    os_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    agent_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="online", index=True)
    risk_level: Mapped[str] = mapped_column(String(20), default="正常", index=True)
    cpu_cores: Mapped[int | None] = mapped_column(Integer, nullable=True)
    memory_total_gb: Mapped[float | None] = mapped_column(Float, nullable=True)
    disk_total_gb: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ServerMetric(Base):
    __tablename__ = "server_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[int] = mapped_column(ForeignKey("servers.id", ondelete="CASCADE"), index=True)
    cpu_percent: Mapped[float] = mapped_column(Float, default=0)
    memory_percent: Mapped[float] = mapped_column(Float, default=0)
    disk_percent: Mapped[float] = mapped_column(Float, default=0)
    swap_percent: Mapped[float] = mapped_column(Float, default=0)
    network_recv_mb_s: Mapped[float] = mapped_column(Float, default=0)
    network_send_mb_s: Mapped[float] = mapped_column(Float, default=0)
    disk_read_mb_s: Mapped[float] = mapped_column(Float, default=0)
    disk_write_mb_s: Mapped[float] = mapped_column(Float, default=0)
    process_count: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[str] = mapped_column(String(20), default="正常", index=True)
    raw: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    server: Mapped[Server] = relationship()


class ServerAlert(Base):
    __tablename__ = "server_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[int] = mapped_column(ForeignKey("servers.id", ondelete="CASCADE"), index=True)
    alert_type: Mapped[str] = mapped_column(String(50), index=True)
    level: Mapped[str] = mapped_column(String(20), index=True)
    message: Mapped[str] = mapped_column(Text)
    suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="未处理", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    server: Mapped[Server] = relationship()


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    input_features: Mapped[dict] = mapped_column(JSON)
    risk_score: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String(20))
    reasons: Mapped[list] = mapped_column(JSON)
    suggestions: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
