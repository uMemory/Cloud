from pathlib import Path
from urllib.parse import quote_plus
import os


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings:
    mysql_host = os.getenv("MYSQL_HOST", "localhost")
    mysql_port = os.getenv("MYSQL_PORT", "3306")
    mysql_user = os.getenv("MYSQL_USER", "root")
    mysql_password = quote_plus(os.getenv("MYSQL_PASSWORD", "mysql@123"))
    mysql_db = os.getenv("MYSQL_DB", "cloud_ai_monitor")
    database_url = (
        f"mysql+pymysql://{mysql_user}:{mysql_password}"
        f"@{mysql_host}:{mysql_port}/{mysql_db}?charset=utf8mb4"
    )

    secret_key = os.getenv("SECRET_KEY", "cloud-ai-monitor-secret-2026")
    agent_token = os.getenv("AGENT_TOKEN", "cloud-monitor-agent-token")
    token_ttl_seconds = int(os.getenv("TOKEN_TTL_SECONDS", "86400"))

    data_path = Path(os.getenv("TRACE_CSV_PATH", BASE_DIR / "data" / "disaggregated_DLRM_trace.csv"))
    model_dir = BASE_DIR / "backend" / "ml" / "models"
    model_path = model_dir / "risk_model.pkl"


settings = Settings()
