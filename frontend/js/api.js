const API_BASE = location.port && location.port !== "80" ? "http://localhost:8000/api" : "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(API_BASE + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.hash = "#login";
  }
  if (!response.ok) {
    throw new Error(data.detail || data.message || "请求失败");
  }
  return data;
}

const AuthAPI = {
  login: (username, password) => apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (username, password, email) => apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ username, password, email }) }),
  me: () => apiFetch("/auth/me"),
};

const DashboardAPI = {
  summary: () => apiFetch("/dashboard/summary"),
  riskDistribution: () => apiFetch("/dashboard/risk-distribution"),
  appRank: () => apiFetch("/dashboard/app-rank?limit=12"),
  resourceOverview: () => apiFetch("/dashboard/resource-overview"),
};

window.SystemAPI = {
  live: () => apiFetch("/system/live"),
};

window.MetricsAPI = {
  collectLocal: () => apiFetch("/metrics/collect-local", { method: "POST" }),
  servers: () => apiFetch("/servers"),
  latest: () => apiFetch("/metrics/latest"),
  trend: (params = {}) => apiFetch(`/metrics/trend?${new URLSearchParams(params)}`),
  alerts: () => apiFetch("/server-alerts"),
  updateAlert: (id, status) => apiFetch(`/server-alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
};

const InstanceAPI = {
  list: (params = {}) => apiFetch(`/instances?${new URLSearchParams(params)}`),
  get: (id) => apiFetch(`/instances/${id}`),
  apps: () => apiFetch("/instances/apps"),
  roles: () => apiFetch("/instances/roles"),
};

const AlertAPI = {
  list: (params = {}) => apiFetch(`/alerts?${new URLSearchParams(params)}`),
};

const ModelAPI = {
  features: () => apiFetch("/model/features"),
  predict: (payload) => apiFetch("/model/predict", { method: "POST", body: JSON.stringify(payload) }),
  history: (params = {}) => apiFetch(`/model/history?${new URLSearchParams(params)}`),
};

window.OpsAPI = {
  startLoad: (mode = "normal") => apiFetch("/ops/load/start", { method: "POST", body: JSON.stringify({ mode }) }),
  stopLoad: () => apiFetch("/ops/load/stop", { method: "POST" }),
};
