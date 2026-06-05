import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import settings
from app.services.risk import assess_risk, enrich_features


NUMERIC_FEATURES = [
    "cpu_request", "cpu_limit", "gpu_request", "gpu_limit", "rdma_request", "rdma_limit",
    "memory_request", "memory_limit", "disk_request", "disk_limit", "max_instance_per_node",
    "schedule_delay", "running_duration", "cpu_ratio", "gpu_ratio", "rdma_ratio",
    "memory_ratio", "disk_ratio", "resource_density",
]
CATEGORICAL_FEATURES = ["role", "app_name"]


def train():
    df = pd.read_csv(settings.data_path)
    records = []
    labels = []
    for _, row in df.iterrows():
        raw = row.to_dict()
        features = enrich_features(raw)
        risk = assess_risk(features)
        records.append(features)
        labels.append(risk.risk_level)
    X = pd.DataFrame(records)
    y = pd.Series(labels)

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", NUMERIC_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ]
    )
    model = Pipeline([
        ("preprocess", preprocessor),
        ("clf", RandomForestClassifier(n_estimators=180, max_depth=12, random_state=42, class_weight="balanced")),
    ])
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    print(classification_report(y_test, pred))

    settings.model_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, settings.model_path)
    print(f"[saved] {settings.model_path}")


if __name__ == "__main__":
    train()
