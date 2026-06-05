const app = document.getElementById("app");
const pageTitle = document.getElementById("page-title");

const State = {
  user: JSON.parse(localStorage.getItem("user") || "null"),
  sessionChecked: false,
  hostTimer: null,
  hostSamples: [],
  liveRefreshInFlight: false,
  selectedServerId: localStorage.getItem("selectedServerId") || "",
};

function toast(message, type = "info") {
  const node = document.createElement("div");
  node.className = `app-toast ${type}`;
  node.textContent = message;
  document.getElementById("toast-root").appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function setTitle(title) {
  pageTitle.textContent = title;
  document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.getAttribute("href") === location.hash));
}

function setAuthMode(enabled) {
  document.body.classList.toggle("auth-mode", enabled);
}

function levelBadge(level) {
  const cls = level === "高危" ? "bg-red-lt" : level === "预警" ? "bg-yellow-lt" : "bg-green-lt";
  return `<span class="badge ${cls}">${level}</span>`;
}

function avatar(symbol, color = "blue") {
  return `<span class="avatar avatar-sm bg-${color}-lt text-${color}">${symbol}</span>`;
}

function fmt(v, n = 2) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return Number(v).toFixed(n);
}

function pct(value, max) {
  return Math.max(2, Math.min(100, Number(((Number(value) || 0) / max * 100).toFixed(1))));
}

function chart(id, option, replace = false) {
  const el = document.getElementById(id);
  if (!el) return null;
  const inst = echarts.getInstanceByDom(el) || echarts.init(el);
  inst.setOption(option, replace ? { notMerge: true, lazyUpdate: false } : undefined);
  if (!inst.__resizeBound) {
    window.addEventListener("resize", () => inst.resize());
    inst.__resizeBound = true;
  }
  return inst;
}

function spark(id, data, color = "#206bc4", area = true) {
  chart(id, {
    grid: { left: 0, right: 0, top: 8, bottom: 0 },
    xAxis: { type: "category", show: false, data: data.map((_, i) => i) },
    yAxis: { type: "value", show: false },
    series: [{
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 3, color },
      areaStyle: area ? { color: `${color}22` } : undefined,
      data,
    }],
  });
}

function requireAuth() {
  return !!localStorage.getItem("token");
}

function liveSystemMetrics() {
  return window.SystemAPI?.live ? window.SystemAPI.live() : apiFetch("/system/live");
}

function metricsApi() {
  return window.MetricsAPI || {
    collectLocal: () => apiFetch("/metrics/collect-local", { method: "POST" }),
    servers: () => apiFetch("/servers"),
    latest: () => apiFetch("/metrics/latest"),
    trend: params => apiFetch(`/metrics/trend?${new URLSearchParams(params || {})}`),
    alerts: () => apiFetch("/server-alerts"),
    updateAlert: (id, status) => apiFetch(`/server-alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  };
}

function opsApi() {
  return window.OpsAPI || {
    startLoad: (mode = "normal") => apiFetch("/ops/load/start", { method: "POST", body: JSON.stringify({ mode }) }),
    stopLoad: () => apiFetch("/ops/load/stop", { method: "POST" }),
  };
}

function isLocalFrontend() {
  return ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
}

async function collectLocalForDemo() {
  if (!isLocalFrontend()) return;
  try {
    await metricsApi().collectLocal();
  } catch (err) {
    console.warn("local demo collect failed", err);
  }
}

function stopHostAutoRefresh() {
  if (State.hostTimer) {
    clearInterval(State.hostTimer);
    State.hostTimer = null;
  }
}

async function validateSession() {
  if (State.sessionChecked || !requireAuth()) return;
  try {
    const data = await AuthAPI.me();
    State.user = data.user || data;
    localStorage.setItem("user", JSON.stringify(State.user));
  } catch (err) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    State.user = null;
  } finally {
    State.sessionChecked = true;
  }
}

function authForm(mode) {
  const isRegister = mode === "register";
  const rememberedUser = localStorage.getItem("rememberedUsername") || "admin";
  return `
    <div class="login-wrap">
      <div class="auth-shell">
        <div class="auth-topbar">
          <div class="d-flex align-items-center">
            <span class="brand-mark auth-brand-mark">A</span>
            <div>
              <div class="auth-product">AI Cloud Monitor</div>
              <div class="text-secondary">云平台 AI 服务资源监控与智能预警</div>
            </div>
          </div>
          <span class="badge bg-green-lt">Live Server Monitor</span>
        </div>
        <div class="auth-grid">
          <div class="auth-column">
            <div class="auth-card auth-card-primary">
              <div class="text-secondary text-uppercase fw-semibold mb-2">Cluster Snapshot</div>
              <div class="auth-big">23,871</div>
              <div class="text-secondary">DLRM 服务实例样本</div>
              <div class="auth-meter mt-4">
                <span style="width: 78%"></span>
              </div>
            </div>
            <div class="auth-card">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <div class="text-secondary text-uppercase fw-semibold">Risk Stream</div>
                  <div class="h2 mb-0">3,820</div>
                </div>
                <span class="badge bg-yellow-lt">active</span>
              </div>
              <div class="auth-mini-bars" aria-hidden="true">
                <span style="height: 34%"></span><span style="height: 48%"></span><span style="height: 42%"></span><span style="height: 64%"></span><span style="height: 58%"></span><span style="height: 76%"></span><span style="height: 52%"></span><span style="height: 88%"></span>
              </div>
            </div>
            <div class="auth-card auth-note">
              <div class="auth-note-icon">✓</div>
              <div>
                <div class="fw-semibold">MySQL 数据持久化</div>
                <div class="text-secondary">实例、告警、用户和预测历史统一入库。</div>
              </div>
            </div>
          </div>
          <div class="card login-card">
            <div class="card-body p-4 p-md-5">
              <div class="auth-mode-switch mb-4" role="group" aria-label="认证方式">
                <a class="${!isRegister ? "active" : ""}" href="#login">登录</a>
                <a class="${isRegister ? "active" : ""}" href="#register">注册</a>
              </div>
              <div class="text-center mb-4">
                <div class="auth-login-icon">◎</div>
                <h1 class="auth-title">${isRegister ? "创建运维账号" : "登录监控控制台"}</h1>
                <p class="text-secondary mb-0">${isRegister ? "注册后可访问资源总览、告警中心和模型预测。" : "默认账号：admin / admin123"}</p>
              </div>
              <div id="auth-error" class="alert alert-danger d-none"></div>
              <form id="auth-form" autocomplete="on">
                <div class="mb-3">
                  <label class="form-label">用户名</label>
                  <input class="form-control form-control-lg" name="username" value="${isRegister ? "" : rememberedUser}" minlength="3" maxlength="50" required>
                </div>
                ${isRegister ? `<div class="mb-3">
                  <label class="form-label">邮箱</label>
                  <input class="form-control form-control-lg" name="email" type="email" placeholder="name@example.com">
                </div>` : ""}
                <div class="mb-3">
                  <label class="form-label">密码</label>
                  <input class="form-control form-control-lg" name="password" type="password" value="${isRegister ? "" : "admin123"}" minlength="6" required>
                </div>
                ${isRegister ? `<div class="mb-3">
                  <label class="form-label">确认密码</label>
                  <input class="form-control form-control-lg" name="confirm_password" type="password" minlength="6" required>
                </div>` : ""}
                <div class="d-flex justify-content-between align-items-center mb-4 auth-options">
                  <label class="form-check mb-0">
                    <input class="form-check-input" id="remember-user" type="checkbox" ${!isRegister ? "checked" : ""}>
                    <span class="form-check-label">${isRegister ? "注册后直接登录" : "记住用户名"}</span>
                  </label>
                  <label class="form-check mb-0">
                    <input class="form-check-input" id="show-password" type="checkbox">
                    <span class="form-check-label">显示密码</span>
                  </label>
                </div>
                <button class="btn btn-primary btn-lg w-100" id="auth-submit" type="submit">${isRegister ? "注册并进入系统" : "登录系统"}</button>
              </form>
            </div>
          </div>
          <div class="auth-column">
            <div class="auth-card">
              <div class="text-secondary text-uppercase fw-semibold mb-3">Service Coverage</div>
              <div class="auth-service-list">
                <div><span class="bg-blue"></span>资源总览 Dashboard</div>
                <div><span class="bg-green"></span>智能风险预测</div>
                <div><span class="bg-yellow"></span>告警中心</div>
                <div><span class="bg-red"></span>预测历史审计</div>
              </div>
            </div>
            <div class="auth-card auth-status">
              <div class="d-flex justify-content-between mb-3">
                <span class="fw-semibold">API Gateway</span>
                <span class="badge bg-green-lt">healthy</span>
              </div>
              <div class="auth-pulse-line">
                <span></span><span></span><span></span><span></span><span></span><span></span>
              </div>
              <div class="text-secondary mt-3">认证后自动携带 Token 访问数据查询与模型接口。</div>
            </div>
            <div class="auth-card auth-note">
              <div class="auth-note-icon">!</div>
              <div>
                <div class="fw-semibold">模型预警服务</div>
                <div class="text-secondary">基于资源请求、调度延迟和服务角色输出风险等级。</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

async function renderLogin(mode = "login") {
  setTitle(mode === "register" ? "注册" : "登录");
  setAuthMode(true);
  app.innerHTML = `
    <div class="container-xl">
      ${authForm(mode)}
    </div>`;
  const form = document.getElementById("auth-form");
  const errorBox = document.getElementById("auth-error");
  const submit = document.getElementById("auth-submit");
  document.getElementById("show-password").addEventListener("change", (e) => {
    form.querySelectorAll('input[type="password"], input[data-password-visible="true"]').forEach(input => {
      input.type = e.target.checked ? "text" : "password";
      input.dataset.passwordVisible = e.target.checked ? "true" : "false";
    });
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("d-none");
    submit.disabled = true;
    submit.textContent = mode === "register" ? "正在注册..." : "正在登录...";
    try {
      const username = e.target.username.value.trim();
      const password = e.target.password.value;
      if (mode === "register") {
        if (password !== e.target.confirm_password.value) {
          throw new Error("两次输入的密码不一致");
        }
        await AuthAPI.register(username, password, e.target.email.value.trim());
      }
      const data = await AuthAPI.login(username, password);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      if (document.getElementById("remember-user").checked) {
        localStorage.setItem("rememberedUsername", username);
      } else {
        localStorage.removeItem("rememberedUsername");
      }
      State.user = data.user;
      State.sessionChecked = true;
      location.hash = "#dashboard";
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove("d-none");
      toast(err.message, "error");
    } finally {
      submit.disabled = false;
      submit.textContent = mode === "register" ? "注册并进入系统" : "登录系统";
    }
  });
}

async function renderDashboard() {
  setTitle("资源总览");
  const [summary, dist, rank, overview] = await Promise.all([
    DashboardAPI.summary(),
    DashboardAPI.riskDistribution(),
    DashboardAPI.appRank(),
    DashboardAPI.resourceOverview(),
  ]);
  let live = null;
  try {
    live = await liveSystemMetrics();
  } catch (err) {
    live = null;
  }
  const topApp = rank[0] || {};
  const riskRate = summary.total_instances ? (summary.alert_count / summary.total_instances) * 100 : 0;
  app.innerHTML = `
    <div class="container-xl">
      <div class="row row-cards">
        <div class="col-12 col-lg-6">
          <div class="card demo-welcome">
            <div class="card-body">
              <div class="row align-items-center h-100">
                <div class="col">
                  <h2 class="mb-3">Welcome back, ${State.user?.username || "admin"}</h2>
                  <p class="text-secondary fs-3 mb-5">运维工作台按“发现风险、定位实例、模型预警、处置告警”的流程组织 Alibaba Cluster Trace v2025 数据。</p>
                  <div class="row g-4">
                    <div class="col-sm-6">
                      <div class="text-secondary text-uppercase fw-semibold">Instances</div>
                      <div class="d-flex align-items-center gap-2">
                        <span class="h2 mb-0">${summary.total_instances}</span>
                        <span class="text-success">100%</span>
                      </div>
                      <div class="progress mini-progress mt-2"><div class="progress-bar bg-primary" style="width: 86%"></div></div>
                    </div>
                    <div class="col-sm-6">
                      <div class="text-secondary text-uppercase fw-semibold">Risk Rate</div>
                      <div class="d-flex align-items-center gap-2">
                        <span class="h2 mb-0">${fmt(riskRate, 1)}%</span>
                        <span class="text-danger">alerts</span>
                      </div>
                      <div class="progress mini-progress mt-2"><div class="progress-bar bg-danger" style="width: ${Math.min(100, riskRate)}%"></div></div>
                    </div>
                  </div>
                </div>
                <div class="col-auto welcome-illustration">
                  <svg viewBox="0 0 260 210" fill="none" aria-hidden="true">
                    <circle cx="174" cy="69" r="38" fill="#206bc4" opacity=".14"/>
                    <circle cx="174" cy="69" r="24" fill="#206bc4"/>
                    <path d="M162 69l8 8 17-19" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
                    <rect x="48" y="130" width="155" height="14" rx="7" fill="#dbe7f6"/>
                    <path d="M74 132c9-40 26-61 49-62 18 0 32 15 41 45" stroke="#206bc4" stroke-width="10" stroke-linecap="round"/>
                    <path d="M96 132c4-23 14-35 29-35 12 0 21 10 26 30" stroke="#79aee8" stroke-width="10" stroke-linecap="round"/>
                    <rect x="175" y="98" width="42" height="55" rx="9" fill="#4b5563"/>
                    <circle cx="196" cy="139" r="9" fill="#206bc4"/>
                    <path d="M46 111c21-4 30-16 27-36" stroke="#f59f00" stroke-width="8" stroke-linecap="round"/>
                    <path d="M213 47l20-12M221 65h24M213 83l19 13" stroke="#9aa8bd" stroke-width="4" stroke-linecap="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        ${metric("TOTAL APPS", summary.app_count, "个应用部署单元", "2%", "success", "sparkApps")}
        ${metric("ACTIVE ALERTS", summary.alert_count, "条资源与调度告警", "-1%", "danger", "sparkAlerts")}
        ${smallMetric("CPU REQUEST", overview.avg.cpu, "平均 CPU 请求", "sparkCpu")}
        ${smallMetric("GPU REQUEST", overview.avg.gpu, "平均 GPU 请求", "sparkGpu")}
        ${smallMetric("MEMORY", overview.avg.memory, "平均内存请求", "sparkMem")}
        ${smallMetric("HIGH RISK", summary.high_risk_count, "高危实例", "sparkHigh")}
        ${iconMetric("$", "实例总数", `${summary.total_instances} trace rows`, "bg-primary")}
        ${iconMetric("⚠", "预警实例", `${summary.alert_count} generated alerts`, "bg-yellow")}
        ${iconMetric("G", "GPU 请求", `${overview.avg.gpu} average`, "bg-green")}
        ${iconMetric("R", "RDMA 请求", `${overview.avg.rdma} average`, "bg-facebook")}
        <div class="col-12">
          ${hostStatusCard(live)}
        </div>
        <div class="col-12">
          <div class="card ops-workflow">
            <div class="card-body">
              <div class="row g-3 align-items-center">
                <div class="col-lg">
                  <div class="text-secondary text-uppercase fw-semibold mb-1">Ops Workflow</div>
                  <h3 class="mb-1">当前优先排查：${topApp.app_name || "暂无高风险应用"}</h3>
                  <div class="text-secondary">应用平均风险 ${fmt(topApp.avg_risk || 0, 2)}，平均 CPU ${fmt(topApp.avg_cpu || 0, 2)}，平均 GPU ${fmt(topApp.avg_gpu || 0, 2)}。建议先查看该应用实例，再进入模型预警确认配置风险。</div>
                </div>
                <div class="col-lg-auto">
                  <div class="btn-list">
                    <a class="btn" href="#instances">定位实例</a>
                    <a class="btn" href="#alerts">处理告警</a>
                    <a class="btn btn-primary" href="#predict">模型预警</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="row row-cards">
            <div class="col-12 col-lg-5">
              <div class="card">
                <div class="card-header">
                  <h5 class="card-title mb-0">风险市场</h5>
                  <div class="card-actions"><span class="badge bg-blue-lt">v2025 DLRM</span></div>
                </div>
                <table class="table card-table table-striped">
                  <thead><tr><th>等级</th><th>实例数</th><th>占比</th><th class="text-end">状态</th></tr></thead>
                  <tbody>${dist.map(d => `<tr><td>${levelBadge(d.name)}</td><td>${d.value}</td><td>${fmt(d.value / summary.total_instances * 100, 1)}%</td><td class="text-end">${d.name === "高危" ? "需处理" : d.name === "预警" ? "观察" : "稳定"}</td></tr>`).join("")}</tbody>
                </table>
              </div>
            </div>
            <div class="col-12 col-lg-7">
              <div class="card">
                <div class="card-header">
                  <h5 class="card-title mb-0">高风险应用排行</h5>
                  <div class="card-actions"><div class="btn-list"><button class="btn btn-sm">Top 12</button></div></div>
                </div>
                <div class="card-body"><div id="appRankChart" class="chart-box-sm"></div></div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="row row-cards">
            <div class="col-12 col-lg-6">
              <div class="card">
                <div class="card-header"><h3 class="card-title">应用资源压力 TopN</h3></div>
                <div class="card-body"><div id="trafficChart" class="chart-box"></div></div>
              </div>
            </div>
            <div class="col-12 col-lg-6">
              <div class="card">
                <div class="card-header"><h5 class="card-title mb-0">资源画像</h5></div>
                <div class="card-body"><div id="resourceChart" class="chart-box"></div></div>
              </div>
            </div>
            <div class="col-12 col-lg-6">
              <div class="card">
                <div class="card-header"><h5 class="card-title mb-0">平均资源请求</h5></div>
                <table class="table card-table table-striped">
                  <tbody>
                    <tr><td>CPU</td><td class="text-end">${overview.avg.cpu}</td></tr>
                    <tr><td>GPU</td><td class="text-end">${overview.avg.gpu}</td></tr>
                    <tr><td>RDMA</td><td class="text-end">${overview.avg.rdma}</td></tr>
                    <tr><td>内存</td><td class="text-end">${overview.avg.memory}</td></tr>
                    <tr><td>磁盘</td><td class="text-end">${overview.avg.disk}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="col-12 col-lg-6">
              <div class="card">
                <div class="card-header"><h5 class="card-title mb-0">运行建议</h5></div>
                <div class="card-body">
                  <p class="text-secondary">建议按真实运维闭环处理：先从高危应用定位实例，再把实例配置带入智能预警，最后在告警中心标记处置结果。</p>
                  <div class="d-grid gap-2">
                    <a class="btn btn-primary" href="#predict">执行智能预警</a>
                    <a class="btn" href="#alerts">查看告警中心</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  spark("sparkApps", [8, 12, 9, 14, 13, 17, 22, 20, 25, 31, 29, 36]);
  spark("sparkAlerts", [38, 32, 28, 34, 29, 27, 25, 24, 20, 19, 17, 15], "#d63939", false);
  spark("sparkCpu", [7, 8, 8, 9, 10, 8, 11, 9, 12, 10, 11, 13]);
  spark("sparkGpu", [1, 1.1, 1.0, 1.2, 1.1, 1.3, 1.1, 1.4, 1.2, 1.3, 1.5, 1.4]);
  spark("sparkMem", [30, 32, 36, 34, 39, 40, 43, 42, 44, 48, 46, 51]);
  spark("sparkHigh", [2, 3, 2, 5, 4, 6, 8, 9, 7, 10, 12, 11], "#d63939", false);
  chart("appRankChart", {
    tooltip: {}, grid: { left: 80, right: 20, top: 10, bottom: 30 },
    xAxis: { type: "value" }, yAxis: { type: "category", data: rank.map(r => r.app_name).reverse() },
    series: [{ type: "bar", data: rank.map(r => r.avg_risk).reverse(), itemStyle: { color: "#206bc4" } }]
  });
  const resourcePressure = [
    pct(overview.avg.cpu, 64),
    pct(overview.avg.gpu, 8),
    pct(overview.avg.rdma, 100),
    pct(overview.avg.memory, 512),
    pct(overview.avg.disk, Math.max(overview.max.disk, 2000)),
  ];
  chart("resourceChart", {
    tooltip: { valueFormatter: value => `${fmt(value, 1)}%` },
    radar: {
      radius: "72%",
      splitNumber: 4,
      axisName: { color: "#667085", fontSize: 13 },
      splitLine: { lineStyle: { color: "#d8e2ef" } },
      splitArea: { areaStyle: { color: ["#f8fbff", "#eef5ff"] } },
      axisLine: { lineStyle: { color: "#b8c7dc" } },
      indicator: [
        { name: "CPU", max: 100 },
        { name: "GPU", max: 100 },
        { name: "RDMA", max: 100 },
        { name: "内存", max: 100 },
        { name: "磁盘", max: 100 },
      ],
    },
    series: [{
      type: "radar",
      symbolSize: 8,
      lineStyle: { width: 3, color: "#206bc4" },
      areaStyle: { color: "rgba(32, 107, 196, .22)" },
      itemStyle: { color: "#206bc4" },
      data: [{ name: "平均资源压力", value: resourcePressure }],
    }],
  });
  chart("trafficChart", {
    tooltip: {
      trigger: "axis",
      valueFormatter: value => fmt(value, 2),
    },
    grid: { left: 36, right: 12, top: 12, bottom: 28 },
    xAxis: { type: "category", data: rank.map(r => r.app_name.slice(0, 8)), axisLabel: { interval: 1 } },
    yAxis: { type: "value" },
    series: [
      { name: "CPU", type: "bar", stack: "total", data: rank.map(r => Number(r.avg_cpu.toFixed(2))), itemStyle: { color: "#206bc4" } },
      { name: "GPU", type: "bar", stack: "total", data: rank.map(r => Number((r.avg_gpu * 10).toFixed(2))), itemStyle: { color: "#2fb344" } },
    ],
  });
  document.getElementById("btn-refresh-host")?.addEventListener("click", refreshHostStatus);
  stopHostAutoRefresh();
  State.hostTimer = setInterval(refreshHostStatus, 3000);
}

function hostStatusCard(live) {
  if (!live) {
    return `<div class="card host-card"><div class="card-body d-flex justify-content-between align-items-center"><div><h3 class="mb-1">实机运行状态</h3><div class="text-secondary">暂时无法读取当前服务器指标，请确认后端服务正常运行。</div></div><button class="btn" id="btn-refresh-host">刷新</button></div></div>`;
  }
  return `<div class="card host-card">
    <div class="card-header">
      <h3 class="card-title">实机运行状态</h3>
      <div class="card-actions"><span class="me-2">${levelBadge(live.risk_level)}</span><button class="btn btn-sm" id="btn-refresh-host">刷新</button></div>
    </div>
    <div class="card-body">
      <div class="row g-3 align-items-stretch">
        ${hostMetric("CPU", `${fmt(live.cpu.percent, 1)}%`, `${live.cpu.cores_logical || "-"} 逻辑核心 · ${live.cpu.freq_mhz ? `${fmt(live.cpu.freq_mhz, 0)} MHz` : "频率未知"}`, live.cpu.percent, "primary")}
        ${hostMetric("内存", `${fmt(live.memory.percent, 1)}%`, `${live.memory.used_gb} / ${live.memory.total_gb} GB`, live.memory.percent, "green")}
        ${hostMetric("磁盘", `${fmt(live.disk.percent, 1)}%`, `${live.disk.used_gb} / ${live.disk.total_gb} GB`, live.disk.percent, "yellow")}
        ${hostMetric("进程", live.process_count, `运行 ${fmt(live.uptime_seconds / 3600, 1)} 小时`, Math.min(100, live.process_count / 3), "azure")}
        ${hostMetric("交换分区", `${fmt(live.swap.percent, 1)}%`, `${live.swap.used_gb} / ${live.swap.total_gb} GB`, live.swap.percent, "purple")}
        ${hostMetric("网络接收", `${fmt(live.network.recv_mb_s, 2)} MB/s`, `累计 ${live.network.bytes_recv_gb} GB`, Math.min(100, live.network.recv_mb_s * 10), "cyan")}
        ${hostMetric("网络发送", `${fmt(live.network.send_mb_s, 2)} MB/s`, `累计 ${live.network.bytes_sent_gb} GB`, Math.min(100, live.network.send_mb_s * 10), "indigo")}
        ${hostMetric("磁盘写入", `${fmt(live.disk.write_mb_s, 2)} MB/s`, `读取 ${fmt(live.disk.read_mb_s, 2)} MB/s`, Math.min(100, live.disk.write_mb_s * 10), "red")}
        <div class="col-12 col-lg-6">
          <div class="border rounded p-3 h-100">
            <div class="text-secondary text-uppercase fw-semibold mb-2">即时判断</div>
            <ul class="mb-0">${live.reasons.map(x => `<li>${x}</li>`).join("")}</ul>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="border rounded p-3 h-100">
            <div class="text-secondary text-uppercase fw-semibold mb-2">处置建议</div>
            <ul class="mb-0">${live.suggestions.map(x => `<li>${x}</li>`).join("")}</ul>
          </div>
        </div>
      </div>
      <div class="text-secondary mt-3">采集时间：${live.timestamp}；每 3 秒自动刷新一次。</div>
    </div>
  </div>`;
}

function hostMetric(label, value, sub, percent, color) {
  return `<div class="col-sm-6 col-lg-3">
    <div class="host-metric border rounded p-3 h-100">
      <div class="text-secondary text-uppercase fw-semibold">${label}</div>
      <div class="h1 mb-1">${value}</div>
      <div class="text-secondary mb-3">${sub}</div>
      <div class="progress"><div class="progress-bar bg-${color}" style="width: ${Math.max(0, Math.min(100, percent))}%"></div></div>
    </div>
  </div>`;
}

async function refreshHostStatus() {
  try {
    const live = await liveSystemMetrics();
    document.querySelector(".host-card").outerHTML = hostStatusCard(live);
    document.getElementById("btn-refresh-host")?.addEventListener("click", refreshHostStatus);
  } catch (err) {
    toast(err.message, "error");
  }
}

function metric(label, value, unit, trend, trendTone, chartId) {
  return `<div class="col-12 col-md-6 col-xl-3">
    <div class="card">
      <div class="card-body">
        <div class="row">
          <div class="col mt-0"><h5 class="card-title text-secondary">${label}</h5></div>
        </div>
        <div class="mb-1"><span class="h1">${value}</span> <span class="text-${trendTone}">${trend}</span></div>
        <div class="mb-0"><span class="text-muted">${unit}</span></div>
        <div id="${chartId}" class="chart-spark"></div>
      </div>
    </div>
  </div>`;
}

function smallMetric(label, value, unit, chartId) {
  return `<div class="col-sm-6 col-lg-3">
    <div class="card">
      <div class="card-body">
        <div class="d-flex justify-content-between">
          <h5 class="card-title text-secondary">${label}</h5>
          <span class="text-muted">Last 7 days</span>
        </div>
        <div class="h1">${value}</div>
        <div class="text-muted">${unit}</div>
        <div id="${chartId}" class="chart-spark-sm"></div>
      </div>
    </div>
  </div>`;
}

function iconMetric(icon, label, sub, cls) {
  return `<div class="col-sm-6 col-lg-3">
    <div class="card">
      <div class="card-body d-flex align-items-center">
        <div class="social-icon ${cls} me-3">${icon}</div>
        <div>
          <div>${label}</div>
          <div class="text-muted">${sub}</div>
        </div>
      </div>
    </div>
  </div>`;
}

async function renderInstances(page = 1) {
  setTitle("实例列表");
  const [roles, apps] = await Promise.all([InstanceAPI.roles(), InstanceAPI.apps()]);
  app.innerHTML = `
    <div class="container-xl">
      <div class="card mb-3"><div class="card-body">
        <div class="row g-2">
          <div class="col-md-2"><select id="f-role" class="form-select"><option value="">全部角色</option>${roles.map(x => `<option>${x}</option>`).join("")}</select></div>
          <div class="col-md-3"><select id="f-app" class="form-select"><option value="">全部应用</option>${apps.map(x => `<option>${x}</option>`).join("")}</select></div>
          <div class="col-md-2"><select id="f-risk" class="form-select"><option value="">全部风险</option><option>正常</option><option>预警</option><option>高危</option></select></div>
          <div class="col-md"><input id="f-search" class="form-control" placeholder="搜索实例或应用"></div>
          <div class="col-md-auto"><button id="btn-filter" class="btn btn-primary">筛选</button></div>
        </div>
      </div></div>
      <div id="instance-table"></div>
      <div id="instance-detail" class="mt-3"></div>
    </div>`;
  const load = async (p = 1) => {
    const data = await InstanceAPI.list({ page: p, limit: 20, role: val("f-role"), app_name: val("f-app"), risk_level: val("f-risk"), search: val("f-search") });
    document.getElementById("instance-table").innerHTML = instanceTable(data);
    document.querySelectorAll("[data-instance-id]").forEach(btn => {
      btn.addEventListener("click", async () => showInstanceDetail(btn.dataset.instanceId));
    });
    document.querySelectorAll("[data-predict-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const item = await InstanceAPI.get(btn.dataset.predictId);
        sessionStorage.setItem("predictSeed", JSON.stringify(instanceToPredictPayload(item)));
        location.hash = "#predict";
      });
    });
  };
  document.getElementById("btn-filter").onclick = () => load(1);
  await load(page);
}

function val(id) { return document.getElementById(id)?.value || ""; }

function instanceTable(result) {
  return `<div class="card"><div class="card-header"><h5 class="card-title mb-0">实例排查队列</h5><div class="card-actions"><button class="btn btn-sm">共 ${result.total} 条</button></div></div><div class="table-responsive"><table class="table card-table table-striped">
    <thead><tr><th>实例</th><th>角色</th><th>应用</th><th>CPU</th><th>GPU</th><th>内存</th><th>调度延迟</th><th>风险</th><th class="text-end">操作</th></tr></thead>
    <tbody>${result.data.map(r => `<tr class="ops-row">
      <td class="font-monospace">${r.instance_sn}</td>
      <td>${r.role}</td>
      <td>${r.app_name}</td>
      <td>${fmt(r.cpu_request, 2)}</td>
      <td>${fmt(r.gpu_request, 2)}</td>
      <td>${fmt(r.memory_request, 2)}</td>
      <td>${fmt(r.schedule_delay, 0)}s</td>
      <td>${levelBadge(r.risk_level)} <span class="text-secondary ms-1">${fmt(r.risk_score, 1)}</span></td>
      <td class="text-end">
        <button class="btn btn-sm" data-instance-id="${r.id}">详情</button>
        <button class="btn btn-sm btn-primary" data-predict-id="${r.id}">带入预警</button>
      </td>
    </tr>`).join("")}</tbody>
  </table></div><div class="card-footer d-flex justify-content-between"><span>第 ${result.page}/${result.pages} 页，共 ${result.total} 条</span><span class="text-secondary">点击“带入预警”可将真实实例配置送入模型测试页</span></div></div>`;
}

async function showInstanceDetail(id) {
  const item = await InstanceAPI.get(id);
  document.getElementById("instance-detail").innerHTML = `<div class="card">
    <div class="card-header"><h5 class="card-title mb-0">实例详情：${item.instance_sn}</h5><div class="card-actions">${levelBadge(item.risk_level)}</div></div>
    <div class="card-body">
      <div class="row g-3">
        ${detailMetric("应用", item.app_name)}
        ${detailMetric("角色", item.role)}
        ${detailMetric("风险评分", fmt(item.risk_score, 2))}
        ${detailMetric("调度延迟", `${fmt(item.schedule_delay, 0)} 秒`)}
        ${detailMetric("CPU 请求/上限", `${fmt(item.cpu_request, 2)} / ${fmt(item.cpu_limit, 2)}`)}
        ${detailMetric("GPU 请求/上限", `${fmt(item.gpu_request, 2)} / ${fmt(item.gpu_limit, 2)}`)}
        ${detailMetric("内存请求/上限", `${fmt(item.memory_request, 2)} / ${fmt(item.memory_limit, 2)}`)}
        ${detailMetric("资源密度", fmt(item.resource_density, 2))}
      </div>
    </div>
  </div>`;
}

function detailMetric(label, value) {
  return `<div class="col-sm-6 col-lg-3"><div class="border rounded p-3 h-100"><div class="text-secondary">${label}</div><div class="h3 mb-0">${value}</div></div></div>`;
}

function instanceToPredictPayload(item) {
  return {
    role: item.role,
    app_name: item.app_name,
    cpu_request: item.cpu_request,
    cpu_limit: item.cpu_limit,
    gpu_request: item.gpu_request,
    gpu_limit: item.gpu_limit,
    rdma_request: item.rdma_request,
    rdma_limit: item.rdma_limit,
    memory_request: item.memory_request,
    memory_limit: item.memory_limit,
    disk_request: item.disk_request,
    disk_limit: item.disk_limit,
    max_instance_per_node: item.max_instance_per_node,
    schedule_delay: item.schedule_delay,
    running_duration: item.running_duration,
  };
}

function table(result, cols) {
  return `<div class="card"><div class="card-header"><h5 class="card-title mb-0">数据表</h5><div class="card-actions"><button class="btn btn-sm">共 ${result.total} 条</button></div></div><div class="table-responsive"><table class="table card-table table-striped">
    <thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead>
    <tbody>${result.data.map(r => `<tr>${cols.map(c => `<td>${c === "risk_level" ? levelBadge(r[c]) : r[c]}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div><div class="card-footer d-flex justify-content-between"><span>第 ${result.page}/${result.pages} 页，共 ${result.total} 条</span></div></div>`;
}

async function renderAnalysis() {
  setTitle("应用分析");
  const [rank, overview] = await Promise.all([DashboardAPI.appRank(), DashboardAPI.resourceOverview()]);
  app.innerHTML = `<div class="container-xl"><div class="row row-cards">
    <div class="col-12"><div class="card"><div class="card-header"><h3 class="card-title">应用 CPU/GPU/内存请求对比</h3></div><div class="card-body"><div id="compareChart" class="chart-box"></div></div></div></div>
    <div class="col-12"><div class="card"><div class="card-header"><h3 class="card-title">资源请求摘要</h3></div><div class="card-body"><pre class="mb-0">${JSON.stringify(overview, null, 2)}</pre></div></div></div>
  </div></div>`;
  chart("compareChart", {
    tooltip: { trigger: "axis" }, legend: {}, grid: { left: 50, right: 20, bottom: 80 },
    xAxis: { type: "category", data: rank.map(r => r.app_name), axisLabel: { rotate: 35 } }, yAxis: { type: "value" },
    series: [
      { name: "CPU", type: "bar", data: rank.map(r => r.avg_cpu) },
      { name: "GPU", type: "bar", data: rank.map(r => r.avg_gpu) },
      { name: "内存", type: "bar", data: rank.map(r => r.avg_memory) },
    ]
  });
}

async function renderAlerts() {
  setTitle("告警中心");
  const data = await AlertAPI.list({ page: 1, limit: 50 });
  const statuses = getAlertStatuses();
  app.innerHTML = `<div class="container-xl">
    <div class="card">
      <div class="card-header">
        <h5 class="card-title mb-0">告警处置队列</h5>
        <div class="card-actions"><span class="badge bg-blue-lt">本地演示状态</span></div>
      </div>
      <div class="table-responsive"><table class="table card-table table-striped">
        <thead><tr><th>时间</th><th>实例</th><th>应用</th><th>类型</th><th>等级</th><th>消息</th><th>处置状态</th><th class="text-end">操作</th></tr></thead>
        <tbody>${data.data.map(a => {
          const status = statuses[a.id] || "未处理";
          return `<tr>
            <td>${a.created_at || "-"}</td>
            <td class="font-monospace">${a.instance_sn || "-"}</td>
            <td>${a.app_name || "-"}</td>
            <td>${a.alert_type}</td>
            <td>${levelBadge(a.level)}</td>
            <td>${a.message}</td>
            <td>${statusBadge(status)}</td>
            <td class="text-end">
              <button class="btn btn-sm" data-alert-status="${a.id}" data-status="已确认">确认</button>
              <button class="btn btn-sm btn-success" data-alert-status="${a.id}" data-status="已解决">解决</button>
              <button class="btn btn-sm" data-alert-status="${a.id}" data-status="已忽略">忽略</button>
            </td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
      <div class="card-footer d-flex justify-content-between">
        <span>第 ${data.page}/${data.pages} 页，共 ${data.total} 条</span>
        <span class="text-secondary">状态保存在浏览器本地，用于演示发现、确认、解决的运维闭环。</span>
      </div>
    </div>
  </div>`;
  document.querySelectorAll("[data-alert-status]").forEach(btn => {
    btn.addEventListener("click", () => {
      const next = getAlertStatuses();
      next[btn.dataset.alertStatus] = btn.dataset.status;
      localStorage.setItem("alertStatuses", JSON.stringify(next));
      renderAlerts();
    });
  });
}

function getAlertStatuses() {
  return JSON.parse(localStorage.getItem("alertStatuses") || "{}");
}

function statusBadge(status) {
  const tone = status === "已解决" ? "bg-green-lt" : status === "已确认" ? "bg-blue-lt" : status === "已忽略" ? "bg-secondary-lt" : "bg-yellow-lt";
  return `<span class="badge ${tone}">${status}</span>`;
}

async function renderPredict() {
  setTitle("智能预警");
  const features = await ModelAPI.features();
  app.innerHTML = `<div class="container-xl"><div class="row row-cards">
    <div class="col-lg-7"><div class="card"><div class="card-header"><h3 class="card-title">输入资源与调度指标</h3><div class="card-actions"><button class="btn btn-sm" id="btn-fill-risk" type="button">填充高风险实例</button></div></div><div class="card-body"><form id="predict-form" class="row g-3">
      ${features.map(f => field(f)).join("")}
      <div class="col-12"><button class="btn btn-primary w-100">执行风险预测</button></div>
    </form></div></div></div>
    <div class="col-lg-5"><div id="predict-result" class="card h-100"><div class="card-body d-flex align-items-center justify-content-center text-secondary">等待预测输入。可以从实例列表带入真实配置，或一键填充当前高风险实例。</div></div></div>
  </div></div>`;
  const seed = JSON.parse(sessionStorage.getItem("predictSeed") || "null");
  if (seed) {
    fillPredictForm(seed);
    sessionStorage.removeItem("predictSeed");
    toast("已带入真实实例配置", "success");
  }
  document.getElementById("btn-fill-risk").onclick = async () => {
    const data = await InstanceAPI.list({ page: 1, limit: 1, risk_level: "高危", sort_by: "risk_score", order: "desc" });
    if (!data.data.length) {
      toast("暂无高风险实例可填充", "error");
      return;
    }
    fillPredictForm(instanceToPredictPayload(data.data[0]));
    toast("已填充最高风险实例", "success");
  };
  document.getElementById("predict-form").onsubmit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    Object.keys(payload).forEach(k => { if (!["role", "app_name"].includes(k)) payload[k] = Number(payload[k]); });
    payload.app_name = "manual";
    try {
      const result = await ModelAPI.predict(payload);
      document.getElementById("predict-result").innerHTML = `<div class="card-body">
        <div class="text-secondary">风险评分</div><div class="display-1 fw-bold">${result.risk_score}</div>
        <div class="mb-3">${levelBadge(result.risk_level)}</div>
        <h4>风险原因</h4><ul>${result.reasons.map(x => `<li>${x}</li>`).join("")}</ul>
        <h4>优化建议</h4><ul>${result.suggestions.map(x => `<li>${x}</li>`).join("")}</ul>
      </div>`;
    } catch (err) { toast(err.message, "error"); }
  };
}

function fillPredictForm(payload) {
  const form = document.getElementById("predict-form");
  Object.entries(payload).forEach(([key, value]) => {
    const field = form.elements[key];
    if (field) field.value = value;
  });
}

function field(f) {
  if (f.type === "select") {
    return `<div class="col-md-6"><label class="form-label">${f.label}</label><select name="${f.name}" class="form-select">${f.options.map(o => `<option>${o}</option>`).join("")}</select></div>`;
  }
  const fallback = f.name.includes("disk") ? 1000 : 1;
  const value = f.max ? (f.name.includes("limit") ? f.max : Math.round((f.min + f.max) / 3)) : fallback;
  return `<div class="col-md-6"><label class="form-label">${f.label}</label><input class="form-control" name="${f.name}" type="number" min="${f.min}" step="any" value="${value}"></div>`;
}

async function renderHistory() {
  setTitle("预测历史");
  const data = await ModelAPI.history({ page: 1, limit: 50 });
  app.innerHTML = `<div class="container-xl">${table(data, ["created_at", "risk_score", "risk_level"])}</div>`;
}

function rememberHostSample(live) {
  if (!live) return;
  State.hostSamples.push({
    time: new Date().toLocaleTimeString(),
    cpu: Number(live.cpu?.percent || 0),
    memory: Number(live.memory?.percent || 0),
    disk: Number(live.disk?.percent || 0),
    net: Number(live.network?.recv_mb_s || 0) + Number(live.network?.send_mb_s || 0),
    io: Number(live.disk?.read_mb_s || 0) + Number(live.disk?.write_mb_s || 0),
  });
  State.hostSamples = State.hostSamples.slice(-20);
}

function liveAlerts(live) {
  if (!live) return [];
  const alerts = [];
  const push = (level, type, message, action) => alerts.push({ level, type, message, action, time: new Date().toLocaleTimeString() });
  if ((live.cpu?.percent || 0) >= 75) push("预警", "CPU", `CPU 使用率 ${fmt(live.cpu.percent, 1)}%`, "检查高 CPU 进程或降低计算任务并发");
  if ((live.memory?.percent || 0) >= 80) push("预警", "Memory", `内存使用率 ${fmt(live.memory.percent, 1)}%`, "释放无用进程或增加内存规格");
  if ((live.disk?.percent || 0) >= 80) push(live.disk.percent >= 90 ? "高危" : "预警", "Disk", `磁盘使用率 ${fmt(live.disk.percent, 1)}%`, "清理日志、缓存或扩容磁盘");
  if ((live.swap?.percent || 0) >= 30) push("预警", "Swap", `交换分区使用率 ${fmt(live.swap.percent, 1)}%`, "检查内存压力，避免频繁换页");
  if (!alerts.length) push("正常", "System", "当前实机资源处于正常范围", "保持观察，继续按 3 秒周期采集");
  return alerts;
}

function liveCard(label, value, sub, percent, color, valueId = "") {
  return `<div class="col-sm-6 col-xl-3">
    <div class="card">
      <div class="card-body">
        <div class="text-secondary text-uppercase fw-semibold">${label}</div>
        <div class="h1 mb-1"${valueId ? ` id="${valueId}"` : ""}>${value}</div>
        <div class="text-secondary mb-3">${sub}</div>
        <div class="progress"><div class="progress-bar bg-${color}" style="width:${Math.max(0, Math.min(100, percent))}%"></div></div>
      </div>
    </div>
  </div>`;
}

function metricAverage(servers, key) {
  const values = servers.map(s => Number(s.latest?.[key])).filter(Number.isFinite);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nodeLabel(server) {
  return server?.hostname ? `${server.hostname} / ${server.ip_address || "-"}` : "暂无节点";
}

function shortNodeLabel(server) {
  const name = server?.hostname || server?.ip_address || "-";
  return name.replace("ecs2-agent1-", "agent-").replace("ecs-", "");
}

function serverSortKey(server) {
  const hostname = String(server?.hostname || "");
  const hostNumber = hostname.match(/(\d+)(?!.*\d)/)?.[1];
  const hostKey = hostNumber ? String(Number(hostNumber)).padStart(6, "0") : "999999";
  const ip = String(server?.ip_address || "");
  const ipKey = ip.split(".").map(part => String(Number(part) || 0).padStart(3, "0")).join(".");
  return `${hostKey}|${ipKey}|${hostname}|${server?.id || ""}`;
}

function stableServers(servers) {
  return [...servers].sort((a, b) => serverSortKey(a).localeCompare(serverSortKey(b)));
}

function busiestServer(servers) {
  return servers.reduce((current, server) => {
    const latest = server.latest || {};
    const score = Number(latest.cpu_percent || 0) + Number(latest.memory_percent || 0) + Number(latest.disk_percent || 0);
    return score > current.score ? { server, score } : current;
  }, { server: servers[0] || {}, score: -1 }).server;
}

function renderStatusSummary(servers, alerts) {
  const online = servers.filter(s => s.status === "online").length;
  const offline = Math.max(0, servers.length - online);
  const warning = servers.filter(s => s.risk_level === "预警").length;
  const danger = servers.filter(s => s.risk_level === "高危").length;
  return [
    ["在线节点", online, "正常"],
    ["离线节点", offline, offline ? "高危" : "正常"],
    ["预警节点", warning, warning ? "预警" : "正常"],
    ["高危节点", danger, danger ? "高危" : "正常"],
    ["活跃告警", alerts.length, alerts.length ? "预警" : "正常"],
  ].map(row => `<tr><td>${row[0]}</td><td class="text-end fw-semibold">${row[1]}</td><td class="text-end">${levelBadge(row[2])}</td></tr>`).join("");
}

function renderHeartbeatList(servers) {
  const rows = servers.slice(0, 6);
  if (!rows.length) {
    return `<div class="text-secondary">暂无 Agent 上报数据。</div>`;
  }
  return rows.map(server => `<div class="list-group-item px-0">
    <div class="d-flex justify-content-between gap-3">
      <div>
        <div class="fw-semibold">${shortNodeLabel(server)}</div>
        <div class="small text-secondary">${server.ip_address || "-"}</div>
      </div>
      <div class="text-end">
        ${statusBadge(server.status === "online" ? "在线" : "离线")}
        <div class="small text-secondary mt-1">${server.last_seen || "-"}</div>
      </div>
    </div>
  </div>`).join("");
}

function renderOpsAdvice(servers, alerts) {
  const focus = alerts[0] || null;
  const busiest = busiestServer(servers);
  const latest = busiest.latest || {};
  if (focus) {
    return `<p class="text-secondary mb-3">优先处理 ${focus.hostname || focus.ip_address || "异常节点"} 的 ${focus.alert_type} 告警，确认资源是否持续超过阈值。</p>
      <a class="btn btn-primary w-100 mb-2" href="#alerts">进入告警中心</a>
      <a class="btn w-100" href="#predict">执行智能预警</a>`;
  }
  if (busiest?.hostname) {
    return `<p class="text-secondary mb-3">当前压力最高节点为 ${nodeLabel(busiest)}，CPU ${fmt(latest.cpu_percent || 0, 1)}%、内存 ${fmt(latest.memory_percent || 0, 1)}%、磁盘 ${fmt(latest.disk_percent || 0, 1)}%。</p>
      <a class="btn btn-primary w-100 mb-2" href="#predict">执行智能预警</a>
      <button class="btn w-100" id="btn-refresh-host-secondary">刷新监控数据</button>`;
  }
  return `<p class="text-secondary mb-3">等待 Agent 首次注册并写入指标后，系统会生成节点画像、趋势图和运行建议。</p>
    <button class="btn w-100" id="btn-refresh-host-secondary">刷新监控数据</button>`;
}

async function renderLiveDashboard() {
  setTitle("实时监控");
  stopHostAutoRefresh();
  let servers = [];
  let latest = {};
  let trendRows = [];
  let alertRows = [];
  try {
    await collectLocalForDemo();
    [servers, latest, alertRows] = await Promise.all([
      metricsApi().servers(),
      metricsApi().latest(),
      metricsApi().alerts(),
    ]);
    servers = stableServers(servers);
    if (State.selectedServerId && !servers.some(s => String(s.id) === String(State.selectedServerId))) {
      State.selectedServerId = "";
      localStorage.removeItem("selectedServerId");
    }
    const selectedId = State.selectedServerId || (servers[0]?.id ? String(servers[0].id) : "");
    if (selectedId) {
      State.selectedServerId = selectedId;
      trendRows = await metricsApi().trend({ limit: 40, server_id: selectedId });
    } else {
      trendRows = await metricsApi().trend({ limit: 40 });
    }
  } catch (err) {
    app.innerHTML = `<div class="container-xl"><div class="alert alert-danger">无法读取数据库监控数据：${err.message}</div></div>`;
    return;
  }
  const selectedServer = servers.find(s => String(s.id) === String(State.selectedServerId)) || servers[0] || {};
  const primary = selectedServer.latest || {};
  const selectedLabel = selectedServer.hostname ? `${selectedServer.hostname} / ${selectedServer.ip_address}` : "暂无节点";
  const activeAlerts = alertRows.filter(a => a.status !== "已解决");
  const avgCpu = metricAverage(servers, "cpu_percent");
  const avgMemory = metricAverage(servers, "memory_percent");
  const avgDisk = metricAverage(servers, "disk_percent");
  const avgNetwork = metricAverage(servers, "network_recv_mb_s") + metricAverage(servers, "network_send_mb_s");
  const onlineRate = latest.server_count ? latest.online_count / latest.server_count * 100 : 0;
  app.innerHTML = `<div class="container-xl">
    <div class="row row-cards">
      <div class="col-12">
        <div class="card ops-workflow">
          <div class="card-body">
            <div class="row g-3 align-items-center">
              <div class="col-lg">
                <div class="text-secondary text-uppercase fw-semibold mb-1">Live Ops Console</div>
                <h2 class="mb-1">云服务器集群状态：${latest.high_risk_count ? levelBadge("高危") : activeAlerts.length ? levelBadge("预警") : levelBadge("正常")}</h2>
                <div class="text-secondary">Agent 每 3 秒写入 MySQL，前端从数据库读取服务器列表、趋势图和告警队列。</div>
              </div>
              <div class="col-lg-auto">
                <div class="btn-list">
                  <button class="btn" id="btn-refresh-host">立即刷新</button>
                  <button class="btn" id="btn-start-load" type="button" data-load-mode="normal">正常模拟</button>
                  <button class="btn" id="btn-warning-load" type="button" data-load-mode="warning">预警模拟</button>
                  <button class="btn" id="btn-danger-load" type="button" data-load-mode="danger">高危模拟</button>
                  <button class="btn" id="btn-stop-load" type="button">停止模拟负载</button>
                  <a class="btn" href="#alerts">查看实时告警</a>
                  <a class="btn btn-primary" href="#predict">智能预警</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${liveCard("服务器", `${latest.online_count || 0}/${latest.server_count || 0}`, "在线 / 总数", onlineRate, "primary", "live-online-count")}
      ${liveCard("活跃告警", latest.active_alert_count || 0, "未解决告警", Math.min(100, (latest.active_alert_count || 0) * 12), "red", "live-alert-count")}
      ${liveCard("集群 CPU", `${fmt(avgCpu, 1)}%`, "全部在线节点均值", avgCpu, "primary", "live-avg-cpu")}
      ${liveCard("集群内存", `${fmt(avgMemory, 1)}%`, "全部在线节点均值", avgMemory, "green", "live-avg-memory")}
      ${liveCard("当前节点 CPU", `${fmt(primary.cpu_percent || 0, 1)}%`, selectedLabel, primary.cpu_percent || 0, "primary", "live-node-cpu")}
      ${liveCard("当前节点内存", `${fmt(primary.memory_percent || 0, 1)}%`, selectedLabel, primary.memory_percent || 0, "green", "live-node-memory")}
      ${liveCard("网络吞吐", `${fmt((primary.network_recv_mb_s || 0) + (primary.network_send_mb_s || 0), 2)} MB/s`, "数据库最新采样", Math.min(100, ((primary.network_recv_mb_s || 0) + (primary.network_send_mb_s || 0)) * 10), "cyan", "live-node-network")}
      ${liveCard("磁盘 IO", `${fmt((primary.disk_read_mb_s || 0) + (primary.disk_write_mb_s || 0), 2)} MB/s`, "数据库最新采样", Math.min(100, ((primary.disk_read_mb_s || 0) + (primary.disk_write_mb_s || 0)) * 10), "indigo", "live-node-io")}
      <div class="col-12 col-lg-8">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">数据库指标趋势</h3>
            <div class="card-actions">
              <select id="server-trend-select" class="form-select form-select-sm">
                ${servers.map(s => `<option value="${s.id}" ${String(s.id) === String(State.selectedServerId) ? "selected" : ""}>${s.hostname} / ${s.ip_address}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="card-body"><div id="liveTrendChart" class="chart-box"></div></div>
        </div>
      </div>
      <div class="col-12 col-lg-4">
        <div class="card h-100">
          <div class="card-header"><h3 class="card-title">数据库告警</h3></div>
          <div class="list-group list-group-flush">
            ${(activeAlerts.length ? activeAlerts.slice(0, 5) : [{ alert_type: "System", level: "正常", message: "当前无未处理告警", suggestion: "保持采集并观察趋势" }]).map(a => `<div class="list-group-item">
              <div class="d-flex justify-content-between"><strong>${a.hostname || a.alert_type}</strong>${levelBadge(a.level)}</div>
              <div class="text-secondary mt-1">${a.message}</div>
              <div class="small text-secondary mt-2">${a.suggestion || ""}</div>
            </div>`).join("")}
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-7">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">集群资源对比</h3>
            <div class="card-actions"><span class="badge bg-blue-lt">MySQL 最新采样</span></div>
          </div>
          <div class="card-body"><div id="clusterCompareChart" class="chart-box"></div></div>
        </div>
      </div>
      <div class="col-12 col-xl-5">
        <div class="card h-100">
          <div class="card-header"><h3 class="card-title">运行态势</h3></div>
          <div class="card-body">
            <div class="row g-3 mb-3">
              <div class="col-6"><div class="text-secondary text-uppercase fw-semibold">平均磁盘</div><div class="h2 mb-0" id="live-avg-disk">${fmt(avgDisk, 1)}%</div></div>
              <div class="col-6"><div class="text-secondary text-uppercase fw-semibold">平均吞吐</div><div class="h2 mb-0" id="live-avg-network">${fmt(avgNetwork, 2)} MB/s</div></div>
            </div>
            <div class="table-responsive mb-3">
              <table class="table table-sm"><tbody id="live-status-summary">${renderStatusSummary(servers, activeAlerts)}</tbody></table>
            </div>
            ${renderOpsAdvice(servers, activeAlerts)}
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-5">
        <div class="card h-100">
          <div class="card-header"><h3 class="card-title">节点心跳</h3></div>
          <div class="card-body">
            <div class="list-group list-group-flush" id="live-heartbeat-list">${renderHeartbeatList(servers)}</div>
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-7">
        <div class="card h-100">
          <div class="card-header"><h3 class="card-title">当前节点画像</h3></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-sm-6 col-lg-3"><div class="text-secondary">磁盘</div><div class="h2">${fmt(primary.disk_percent || 0, 1)}%</div></div>
              <div class="col-sm-6 col-lg-3"><div class="text-secondary">交换分区</div><div class="h2">${fmt(primary.swap_percent || 0, 1)}%</div></div>
              <div class="col-sm-6 col-lg-3"><div class="text-secondary">进程数</div><div class="h2">${primary.process_count || 0}</div></div>
              <div class="col-sm-6 col-lg-3"><div class="text-secondary">风险等级</div><div class="h2">${levelBadge(selectedServer.risk_level || "正常")}</div></div>
            </div>
            <div class="text-secondary mt-3">趋势、告警、节点画像均来自 MySQL 中 Agent 周期上报的数据；训练数据集仅用于模型预警，不再作为首页静态展示主体。</div>
          </div>
        </div>
      </div>
      <div class="col-12">
        <div class="card">
          <div class="card-header"><h3 class="card-title">服务器列表</h3></div>
          <div class="table-responsive"><table class="table card-table table-striped">
            <thead><tr><th>主机名</th><th>内网 IP</th><th>状态</th><th>风险</th><th>CPU</th><th>内存</th><th>磁盘</th><th>最近上报</th></tr></thead>
            <tbody>${servers.map(s => `<tr><td>${s.hostname}</td><td>${s.ip_address}</td><td>${statusBadge(s.status === "online" ? "在线" : "离线")}</td><td>${levelBadge(s.risk_level)}</td><td>${fmt(s.latest?.cpu_percent || 0, 1)}%</td><td>${fmt(s.latest?.memory_percent || 0, 1)}%</td><td>${fmt(s.latest?.disk_percent || 0, 1)}%</td><td>${s.last_seen || "-"}</td></tr>`).join("")}</tbody>
          </table></div>
        </div>
      </div>
    </div>
  </div>`;
  drawDbTrend(trendRows);
  drawClusterCompare(servers);
  document.getElementById("btn-refresh-host")?.addEventListener("click", renderLiveDashboard);
  document.getElementById("btn-refresh-host-secondary")?.addEventListener("click", renderLiveDashboard);
  document.querySelectorAll("[data-load-mode]").forEach(button => {
    button.addEventListener("click", () => controlLoadSimulator("start", button.dataset.loadMode || "normal"));
  });
  document.getElementById("btn-stop-load")?.addEventListener("click", () => controlLoadSimulator("stop"));
  document.getElementById("server-trend-select")?.addEventListener("change", (event) => {
    State.selectedServerId = event.target.value;
    localStorage.setItem("selectedServerId", State.selectedServerId);
    renderLiveDashboard();
  });
  State.hostTimer = setInterval(refreshLiveDashboardCharts, 3000);
}

async function controlLoadSimulator(action, mode = "normal") {
  const loadButtons = Array.from(document.querySelectorAll("[data-load-mode]"));
  const stopButton = document.getElementById("btn-stop-load");
  [...loadButtons, stopButton].forEach(button => { if (button) button.disabled = true; });
  try {
    const result = action === "start" ? await opsApi().startLoad(mode) : await opsApi().stopLoad();
    if (!result.ok) throw new Error(result.stderr || result.detail || "操作失败");
    const modeLabel = mode === "danger" ? "高危" : mode === "warning" ? "预警" : "正常";
    toast(action === "start" ? `已启动三台 Agent 的${modeLabel}模拟负载` : "已停止三台 Agent 的模拟负载", "success");
    await refreshLiveDashboardCharts();
  } catch (err) {
    toast(err.message || "模拟负载操作失败", "error");
  } finally {
    [...loadButtons, stopButton].forEach(button => { if (button) button.disabled = false; });
  }
}

async function refreshLiveDashboardCharts() {
  if (!document.getElementById("liveTrendChart")) return;
  if (State.liveRefreshInFlight) return;
  State.liveRefreshInFlight = true;
  try {
    await collectLocalForDemo();
    const [servers, latest, alerts] = await Promise.all([
      metricsApi().servers(),
      metricsApi().latest(),
      metricsApi().alerts(),
    ]);
    const orderedServers = stableServers(servers);
    if (State.selectedServerId && !orderedServers.some(s => String(s.id) === String(State.selectedServerId))) {
      State.selectedServerId = "";
      localStorage.removeItem("selectedServerId");
    }
    const selectedId = State.selectedServerId || (orderedServers[0]?.id ? String(orderedServers[0].id) : "");
    if (selectedId) {
      State.selectedServerId = selectedId;
    }
    drawClusterCompare(orderedServers);
    updateLiveDashboardSummary(orderedServers, latest, alerts);
    try {
      const trendRows = selectedId
        ? await metricsApi().trend({ limit: 40, server_id: selectedId })
        : await metricsApi().trend({ limit: 40 });
      drawDbTrend(trendRows);
    } catch (err) {
      console.warn("refresh trend failed", err);
    }
  } catch (err) {
    console.warn("refresh live dashboard failed", err);
  } finally {
    State.liveRefreshInFlight = false;
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateLiveDashboardSummary(servers, latest, alertRows) {
  const activeAlerts = alertRows.filter(a => a.status !== "已解决");
  const selectedServer = servers.find(s => String(s.id) === String(State.selectedServerId)) || servers[0] || {};
  const primary = selectedServer.latest || {};
  setText("live-online-count", `${latest.online_count || 0}/${latest.server_count || 0}`);
  setText("live-alert-count", latest.active_alert_count || 0);
  setText("live-avg-cpu", `${fmt(metricAverage(servers, "cpu_percent"), 1)}%`);
  setText("live-avg-memory", `${fmt(metricAverage(servers, "memory_percent"), 1)}%`);
  setText("live-node-cpu", `${fmt(primary.cpu_percent || 0, 1)}%`);
  setText("live-node-memory", `${fmt(primary.memory_percent || 0, 1)}%`);
  setText("live-node-network", `${fmt((primary.network_recv_mb_s || 0) + (primary.network_send_mb_s || 0), 2)} MB/s`);
  setText("live-node-io", `${fmt((primary.disk_read_mb_s || 0) + (primary.disk_write_mb_s || 0), 2)} MB/s`);
  setText("live-avg-disk", `${fmt(metricAverage(servers, "disk_percent"), 1)}%`);
  setText("live-avg-network", `${fmt(metricAverage(servers, "network_recv_mb_s") + metricAverage(servers, "network_send_mb_s"), 2)} MB/s`);
  const statusBody = document.getElementById("live-status-summary");
  if (statusBody) statusBody.innerHTML = renderStatusSummary(servers, activeAlerts);
  const heartbeat = document.getElementById("live-heartbeat-list");
  if (heartbeat) heartbeat.innerHTML = renderHeartbeatList(servers);
}

function drawDbTrend(rows) {
  chart("liveTrendChart", {
    tooltip: { trigger: "axis", valueFormatter: value => fmt(value, 2) },
    legend: {},
    grid: { left: 42, right: 16, top: 32, bottom: 32 },
    xAxis: { type: "category", data: rows.map(x => (x.created_at || "").slice(11, 19)) },
    yAxis: { type: "value" },
    series: [
      { name: "CPU %", type: "line", smooth: true, data: rows.map(x => x.cpu_percent) },
      { name: "内存 %", type: "line", smooth: true, data: rows.map(x => x.memory_percent) },
      { name: "磁盘 %", type: "line", smooth: true, data: rows.map(x => x.disk_percent) },
      { name: "网络 MB/s", type: "line", smooth: true, data: rows.map(x => (x.network_recv_mb_s || 0) + (x.network_send_mb_s || 0)) },
      { name: "IO MB/s", type: "line", smooth: true, data: rows.map(x => (x.disk_read_mb_s || 0) + (x.disk_write_mb_s || 0)) },
    ],
  }, true);
}

function drawClusterCompare(servers) {
  const orderedServers = stableServers(servers);
  chart("clusterCompareChart", {
    tooltip: { trigger: "axis", valueFormatter: value => fmt(value, 2) },
    legend: {},
    grid: { left: 42, right: 16, top: 36, bottom: 44 },
    xAxis: {
      type: "category",
      axisLabel: { interval: 0, rotate: orderedServers.length > 4 ? 18 : 0 },
      data: orderedServers.map(shortNodeLabel),
    },
    yAxis: { type: "value", max: 100 },
    series: [
      { name: "CPU %", type: "bar", data: orderedServers.map(s => Number(s.latest?.cpu_percent || 0)), itemStyle: { color: "#206bc4" } },
      { name: "内存 %", type: "bar", data: orderedServers.map(s => Number(s.latest?.memory_percent || 0)), itemStyle: { color: "#2fb344" } },
      { name: "磁盘 %", type: "bar", data: orderedServers.map(s => Number(s.latest?.disk_percent || 0)), itemStyle: { color: "#f59f00" } },
    ],
  }, true);
}

function drawLiveTrend() {
  chart("liveTrendChart", {
    tooltip: { trigger: "axis", valueFormatter: value => fmt(value, 2) },
    legend: {},
    grid: { left: 42, right: 16, top: 32, bottom: 32 },
    xAxis: { type: "category", data: State.hostSamples.map(x => x.time) },
    yAxis: { type: "value" },
    series: [
      { name: "CPU %", type: "line", smooth: true, data: State.hostSamples.map(x => x.cpu) },
      { name: "内存 %", type: "line", smooth: true, data: State.hostSamples.map(x => x.memory) },
      { name: "磁盘 %", type: "line", smooth: true, data: State.hostSamples.map(x => x.disk) },
      { name: "网络 MB/s", type: "line", smooth: true, data: State.hostSamples.map(x => x.net) },
      { name: "IO MB/s", type: "line", smooth: true, data: State.hostSamples.map(x => x.io) },
    ],
  });
}

async function renderLiveAlerts() {
  setTitle("实时告警");
  const alerts = await metricsApi().alerts();
  app.innerHTML = `<div class="container-xl"><div class="card">
    <div class="card-header"><h3 class="card-title">数据库告警队列</h3><div class="card-actions"><span class="badge bg-blue-lt">MySQL</span></div></div>
    <div class="table-responsive"><table class="table card-table table-striped">
      <thead><tr><th>时间</th><th>服务器</th><th>IP</th><th>类型</th><th>等级</th><th>现象</th><th>状态</th><th>建议动作</th><th>处理</th></tr></thead>
      <tbody>${alerts.map(a => `<tr>
        <td>${a.created_at}</td>
        <td>${a.hostname || "-"}</td>
        <td>${a.ip_address || "-"}</td>
        <td>${a.alert_type}</td>
        <td>${levelBadge(a.level)}</td>
        <td>${a.message}</td>
        <td>${statusBadge(a.status)}</td>
        <td>${a.suggestion || "-"}</td>
        <td>
          <div class="btn-list flex-nowrap">
            <button class="btn btn-sm" data-server-alert="${a.id}" data-status="已确认">确认</button>
            <button class="btn btn-sm btn-success" data-server-alert="${a.id}" data-status="已解决">解决</button>
            <button class="btn btn-sm" data-server-alert="${a.id}" data-status="已忽略">忽略</button>
            <button class="btn btn-sm" data-server-alert="${a.id}" data-status="未处理">重置</button>
          </div>
        </td>
      </tr>`).join("")}</tbody>
    </table></div>
  </div></div>`;
  document.querySelectorAll("[data-server-alert]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await metricsApi().updateAlert(button.dataset.serverAlert, button.dataset.status);
        toast("告警状态已更新", "success");
        await renderLiveAlerts();
      } catch (err) {
        toast(err.message, "error");
        button.disabled = false;
      }
    });
  });
}

const routes = {
  "#login": renderLogin,
  "#register": () => renderLogin("register"),
  "#dashboard": renderLiveDashboard,
  "#alerts": renderLiveAlerts,
  "#predict": renderPredict,
  "#history": renderHistory,
};

async function route() {
  const hash = location.hash || "#dashboard";
  await validateSession();
  const isAuthRoute = hash === "#login" || hash === "#register";
  if (!requireAuth() && !isAuthRoute) {
    location.hash = "#login";
    return;
  }
  if (requireAuth() && isAuthRoute) {
    location.hash = "#dashboard";
    return;
  }
  setAuthMode(isAuthRoute);
  if (hash !== "#dashboard") stopHostAutoRefresh();
  document.getElementById("nav-user").textContent = State.user?.username || "";
  try {
    await (routes[hash] || renderLiveDashboard)();
  } catch (err) {
    app.innerHTML = `<div class="container-xl"><div class="alert alert-danger">${err.message}</div></div>`;
  }
}

document.getElementById("btn-logout").onclick = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  State.user = null;
  State.sessionChecked = false;
  location.hash = "#login";
};

window.addEventListener("hashchange", route);
route();
