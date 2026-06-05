from flask import Flask, jsonify
from flask_cors import CORS

from app.api.alerts import bp as alerts_bp
from app.api.auth import bp as auth_bp
from app.api.dashboard import bp as dashboard_bp
from app.api.instances import bp as instances_bp
from app.api.metrics import bp as metrics_bp
from app.api.model import bp as model_bp
from app.api.ops import bp as ops_bp
from app.api.system import bp as system_bp
from app.config import settings
from app.database import Base, engine


def create_app() -> Flask:
    Base.metadata.create_all(bind=engine)

    app = Flask(__name__)
    app.config["SECRET_KEY"] = settings.secret_key
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(instances_bp)
    app.register_blueprint(alerts_bp)
    app.register_blueprint(model_bp)
    app.register_blueprint(system_bp)
    app.register_blueprint(metrics_bp)
    app.register_blueprint(ops_bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "framework": "flask"})

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"detail": "接口不存在"}), 404

    @app.errorhandler(500)
    def server_error(_error):
        return jsonify({"detail": "服务器内部错误"}), 500

    return app


app = create_app()
