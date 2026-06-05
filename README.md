# 基于云平台的 AI 服务资源监控与智能预警系统

本项目为《云计算》期末大作业。系统基于 Alibaba Cluster Trace v2025 的 DLRM 服务实例数据，构建一个面向云平台服务器与 AI 服务实例的资源运行状态监控、数据分析、告警管理和机器学习预警平台。

前端界面参考 Tabler Dashboard 风格重构，后端使用 MySQL 存储公开数据集与预测记录。

## 功能范围

| 模块 | 已实现功能 |
|---|---|
| 登录认证 | 用户注册、登录、退出、Token 会话校验、默认管理员账号 |
| 资源总览 | 实例总数、应用数量、告警数量、高危实例、资源画像、风险分布 |
| 实机监控 | 读取当前服务器 CPU、内存、磁盘、网络、进程数并给出即时风险判断 |
| 多服务器监控 | 支持轻量 Agent Push 上报，多台 ECS 指标统一写入 MySQL 后展示 |
| 实例管理 | 按角色、应用、风险等级、关键词筛选 Alibaba Trace 实例数据 |
| 应用分析 | 应用级 CPU、GPU、RDMA、内存、磁盘资源请求对比 |
| 告警中心 | 基于资源请求、资源上限和调度延迟生成告警列表 |
| 智能预警 | 调用机器学习模型预测风险等级、风险原因和优化建议 |
| 预测历史 | 保存并查询用户每次模型预测记录 |
| 部署说明 | 提供本地运行、Docker Compose 和云服务器部署步骤 |

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | Tabler UI + 原生 JavaScript + ECharts |
| 后端 | Flask + SQLAlchemy |
| 数据库 | MySQL 8.0 |
| 模型 | scikit-learn RandomForestClassifier |
| 部署 | Docker Compose + Nginx 反向代理 |

说明： 项目使用 Flask 实现后端接口，覆盖数据库访问、登录认证和机器学习模型调用。

## 数据集

使用公开数据集 Alibaba Cluster Trace v2025 中的 DLRM trace：

```text
data/disaggregated_DLRM_trace.csv
```

核心字段包括：

| 类型 | 字段 |
|---|---|
| 实例标识 | `instance_sn` |
| 服务信息 | `role`, `app_name` |
| 资源请求 | `cpu_request`, `gpu_request`, `rdma_request`, `memory_request`, `disk_request` |
| 资源上限 | `cpu_limit`, `gpu_limit`, `rdma_limit`, `memory_limit`, `disk_limit` |
| 调度约束 | `max_instance_per_node` |
| 生命周期 | `creation_time`, `scheduled_time`, `deletion_time` |

系统导入数据时会衍生调度延迟、运行时长、资源请求比例、资源密度、风险评分和风险等级，并生成告警数据。

## 项目结构

```text
.
├── backend/
│   ├── app/                 # API、模型、数据库、业务服务
│   ├── ml/                  # 模型训练脚本与模型文件目录
│   ├── scripts/             # 数据导入脚本
│   ├── Dockerfile
│   └── requirements.txt
├── agent/
│   ├── collector.py         # ECS 轻量采集 Agent
│   ├── load_simulator.py    # 演示用轻量负载模拟器
│   └── requirements.txt
├── data/
│   └── disaggregated_DLRM_trace.csv
├── frontend/
│   ├── index.html
│   ├── css/app.css
│   └── js/
├── nginx/nginx.conf
├── scripts/
│   ├── deploy_agents.sh     # 主 ECS 批量分发 Agent
│   ├── deploy_load_simulators.sh # 主 ECS 批量分发演示负载
│   ├── stop_load_simulators.sh   # 主 ECS 批量停止演示负载
│   └── agents.txt.example
├── docker-compose.yml
└── README.md
```

## 本地运行测试

### 1. 创建 MySQL 数据库

确保本机 MySQL 可用，当前默认连接参数为：

```text
host: localhost
port: 3306
user: root
password: mysql@123
database: cloud_ai_monitor
```

创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS cloud_ai_monitor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

如需修改连接参数，可设置环境变量：

```powershell
$env:MYSQL_HOST="localhost"
$env:MYSQL_PORT="3306"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD="mysql@123"
$env:MYSQL_DB="cloud_ai_monitor"
```

### 2. 安装后端依赖

```powershell
pip install -r backend/requirements.txt
```

### 3. 导入数据

```powershell
python backend/scripts/import_trace.py
```

导入脚本会自动创建数据表、导入 trace 数据、生成告警，并创建默认账号：

```text
admin / admin123
```

### 4. 训练模型

```powershell
python backend/ml/train.py
```

训练完成后会生成：

```text
backend/ml/models/risk_model.pkl
```

### 5. 启动后端

```powershell
cd D:\PyCharmCommunity\Cloud_Computing
$env:PYTHONPATH=(Resolve-Path .\backend).Path
python -m flask --app app.main run --host 0.0.0.0 --port 8000
```

健康检查：

```text
http://127.0.0.1:8000/api/health
```

### 6. 启动前端

前端依赖已放在 `frontend/vendor`，包括 Tabler 和 ECharts，本地运行和云端部署不再依赖 CDN。若页面出现裸 HTML 或图表不显示，优先确认 `frontend/vendor/tabler/tabler.min.css` 和 `frontend/vendor/echarts/echarts.min.js` 是否存在。

```powershell
cd D:\PyCharmCommunity\Cloud_Computing
python -m http.server 8080 -d frontend
```

浏览器访问：

```text
http://127.0.0.1:8080/index.html
```

## Docker Compose 部署

本项目包含 `docker-compose.yml`，会启动 MySQL、后端 API 和 Nginx 前端代理。

```bash
docker compose up -d --build
```

首次启动后导入数据并训练模型：

```bash
docker compose exec backend python backend/scripts/import_trace.py
docker compose exec backend python backend/ml/train.py
```

访问地址：

```text
http://服务器IP/
```

API 会由 Nginx 转发：

```text
/api/* -> backend:8000/api/*
```

后端容器会挂载中心 ECS 的 `/root/.ssh` 到容器内，只用于前端“启动/停止模拟负载”按钮触发内网 SSH 控制三台 Agent。部署前应先确保中心 ECS 已完成到 Agent 节点的 SSH 免密登录。

## 云服务器部署

本节按从零录制完整部署视频的顺序编写。建议创建 4 台同一 VPC/安全组内的 Ubuntu ECS：1 台中心平台，3 台 Agent 节点。

### 0. 记录 ECS 信息

录屏开始前先在纸面或文本中记录 4 台机器信息。后续命令中的变量都从这里替换：

| 变量 | 含义 | 示例 |
|---|---|---|
| `CENTER_PUBLIC_IP` | 中心 ECS 公网 IP，用于浏览器访问 | `x.x.x.x` |
| `CENTER_PRIVATE_IP` | 中心 ECS 内网 IP，Agent 上报使用 | `192.168.x.x` |
| `AGENT1_PRIVATE_IP` | Agent1 内网 IP | `192.168.x.x` |
| `AGENT2_PRIVATE_IP` | Agent2 内网 IP | `192.168.x.x` |
| `AGENT3_PRIVATE_IP` | Agent3 内网 IP | `192.168.x.x` |
| `ROOT_PASSWORD` | 4 台 ECS 的 root 密码，或替换为自己的免密 SSH 方式 | `admin321.` |

推荐配置：

| 节点 | 建议 |
|---|---|
| ECS-Center | 2 核 4 GB 可运行演示；4 核 8 GB 更稳，开放 80 端口 |
| ECS-Agent | 2 核 4 GB 即可，仅需内网 SSH 可达 |
| 操作系统 | Ubuntu 22.04 LTS |
| 磁盘 | 40 GB 以上 |
| 安全组 | 中心 ECS 放行公网 80；4 台 ECS 之间内网互通；Agent 不需要公网 |

架构为：公网用户访问中心 ECS 的 Nginx，三台 Agent 只通过内网将指标 Push 到中心 ECS。

### 1. 登录中心 ECS 并安装基础组件

以下命令只在中心 ECS 执行：

```bash
apt update
apt install -y docker.io docker-compose git openssh-client sshpass
systemctl enable --now docker
```

如果 Docker Hub 访问慢，可配置镜像源：

```bash
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.1panel.live"
  ]
}
EOF
systemctl restart docker
docker --version
docker-compose --version
```

### 2. 拉取项目并启动中心平台

仍在中心 ECS 执行。项目统一放在 `/root/cloud-ai-monitor`，方便后续脚本和录屏说明保持一致：

```bash
cd /root
git clone https://github.com/uMemory/Cloud_Computing_Project.git cloud-ai-monitor
cd /root/cloud-ai-monitor
docker-compose up -d --build
```

检查容器状态：

```bash
docker-compose ps
curl http://127.0.0.1/api/health
```

正常情况下应看到 `ai-monitor-mysql`、`ai-monitor-api`、`ai-monitor-nginx` 均为 `Up`，健康检查返回：

```json
{"framework":"flask","status":"ok"}
```

### 3. 导入数据集并训练模型

训练 CSV 已包含在仓库的 `data/disaggregated_DLRM_trace.csv`，不需要额外上传数据集。首次启动后执行：

```bash
cd /root/cloud-ai-monitor
docker-compose exec backend python backend/scripts/import_trace.py
docker-compose exec backend python backend/ml/train.py
```

导入脚本会创建数据表、导入公开数据集、生成 AI 服务实例告警，并创建默认账号：

```text
admin / admin123
```

浏览器访问：

```text
http://CENTER_PUBLIC_IP/
```

### 4. 配置 Agent 内网 IP 列表

在中心 ECS 写入三台 Agent 的内网 IP。把下面三行替换为新建 ECS 的真实内网 IP：

```bash
cd /root/cloud-ai-monitor
cat > scripts/agents.txt <<'EOF'
AGENT1_PRIVATE_IP
AGENT2_PRIVATE_IP
AGENT3_PRIVATE_IP
EOF
```

示例：

```bash
cat > scripts/agents.txt <<'EOF'
192.168.17.101
192.168.17.102
192.168.17.103
EOF
```

### 5. 配置中心 ECS 到 Agent 的免密 SSH

中心平台的 Agent 分发、前端“启动/停止模拟负载”按钮，都依赖中心 ECS 能通过内网 SSH 控制三台 Agent。因此需要先配置免密 SSH。

如果还没有 SSH key：

```bash
test -f /root/.ssh/id_ed25519 || ssh-keygen -t ed25519 -N '' -f /root/.ssh/id_ed25519
```

将中心 ECS 的公钥复制到三台 Agent。把 `ROOT_PASSWORD` 替换为实际 root 密码：

```bash
export ROOT_PASSWORD='admin321.'
for h in $(cat scripts/agents.txt); do
  sshpass -p "$ROOT_PASSWORD" ssh-copy-id -o StrictHostKeyChecking=no root@$h
done
```

验证内网 SSH：

```bash
for h in $(cat scripts/agents.txt); do
  echo "== $h =="
  ssh -o BatchMode=yes root@$h 'hostname; hostname -I'
done
```

### 6. 批量分发 Agent 采集服务

在中心 ECS 执行：

```bash
cd /root/cloud-ai-monitor
chmod +x scripts/deploy_agents.sh
CENTER_IP=CENTER_PRIVATE_IP AGENT_TOKEN=cloud-monitor-agent-token bash scripts/deploy_agents.sh scripts/agents.txt
```

把 `CENTER_PRIVATE_IP` 替换为中心 ECS 内网 IP。脚本会：

- 通过内网 SSH/SCP 分发 `agent/collector.py`
- 分发仓库内离线依赖包 `agent/deps/python3-psutil_*.deb`
- 在三台 Agent 上创建并启动 `cloud-monitor-agent` systemd 服务
- 每 3 秒采集 CPU、内存、磁盘、网络、IO、进程数并 Push 到中心平台

检查 Agent 服务：

```bash
for h in $(cat scripts/agents.txt); do
  echo "== $h =="
  ssh root@$h 'systemctl is-active cloud-monitor-agent; journalctl -u cloud-monitor-agent --no-pager -n 5'
done
```

正常状态应为：

```text
active
```

### 7. 验证指标入库和前端展示

登录接口获取 Token：

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

查看服务器列表和统计：

```bash
curl http://127.0.0.1/api/servers -H "Authorization: Bearer $TOKEN"
curl http://127.0.0.1/api/metrics/latest -H "Authorization: Bearer $TOKEN"
```

前端首页应显示三台 Agent ECS，趋势图右上角可以切换不同节点。集群资源对比图会按主机名数字后缀排序，例如 `0001`、`0002`、`0003`。

如果旧数据库曾经出现类似 `a842910007c8 / 172.18.0.3` 的 Docker 容器节点，可清理历史残留：

```bash
docker-compose exec backend python backend/scripts/cleanup_container_nodes.py
```

新建 ECS 从零部署时通常不需要执行这一步。

### 8. 启动演示负载模拟器

空闲 ECS 的 CPU、网络和 IO 曲线可能接近直线。为了录制演示视频，可以启动轻量负载模拟器：

```bash
cd /root/cloud-ai-monitor
chmod +x scripts/deploy_load_simulators.sh scripts/stop_load_simulators.sh
bash scripts/deploy_load_simulators.sh scripts/agents.txt
```

脚本会按 Agent 列表顺序给三台机器下发不同 profile，便于图表产生差异：

```text
Profile 1: CPU 0.18-0.56, Memory 96-384 MB, Disk 8 MB / 5 秒
Profile 2: CPU 0.12-0.46, Memory 128-512 MB, Disk 12 MB / 7 秒
Profile 3: CPU 0.24-0.68, Memory 160-640 MB, Disk 16 MB / 9 秒
```

也可以在前端首页点击：

```text
启动模拟负载 / 停止模拟负载
```

前端按钮调用 `/api/ops/load/start` 和 `/api/ops/load/stop`，后端容器通过挂载的 `/root/.ssh` 执行内网 SSH 控制三台 Agent 的 `cloud-monitor-load` 服务。因为 `docker-compose.yml` 已挂载 `/root/.ssh:/root/.ssh:ro`，只要第 5 步免密 SSH 配置成功，按钮即可工作。

检查模拟负载状态：

```bash
for h in $(cat scripts/agents.txt); do
  echo "== $h =="
  ssh root@$h 'systemctl is-active cloud-monitor-load; systemctl cat cloud-monitor-load | grep ExecStart'
done
```

停止模拟负载：

```bash
bash scripts/stop_load_simulators.sh scripts/agents.txt
```

### 9. 录屏建议顺序

推荐按以下顺序录制，逻辑最清晰：

1. 展示 4 台 ECS：1 台中心有公网 IP，3 台 Agent 只有内网 IP。
2. 中心 ECS 安装 Docker、Git、SSH 工具。
3. `git clone` 项目并 `docker-compose up -d --build`。
4. 导入数据集并训练模型。
5. 浏览器登录系统，展示首页、实例列表、预测页面。
6. 配置三台 Agent 内网 IP 和免密 SSH。
7. 批量分发 Agent，刷新页面看到三台服务器在线。
8. 启动模拟负载，等待 15-30 秒，展示趋势图和集群对比图变化。
9. 在实时告警页确认、解决、忽略告警，展示状态写入数据库。
10. 在智能预警页输入或带入实例配置，展示模型预测结果。

### 10. 常见问题

| 现象 | 原因与处理 |
|---|---|
| `docker-compose up -d --build` 卡在 apt 步骤 | 后端 Dockerfile 已切换华为云 Debian 源；确认已拉取最新代码后重新 build |
| 页面没有三台 Agent | 检查 `scripts/agents.txt` 是否是三台 Agent 内网 IP，检查 `cloud-monitor-agent` 是否 active |
| 点击启动模拟负载失败 | 先确认中心 ECS 到 Agent 已配置免密 SSH，且后端容器已重建并挂载 `/root/.ssh` |
| 曲线不变化 | 确认 Agent 正在上报；如果 ECS 太空闲，启动模拟负载 |
| 告警状态不能修改 | 确认代码包含 `PATCH /api/server-alerts/<id>`，浏览器强制刷新前端资源 |
| 前端仍报旧 JS 错误 | 浏览器执行 `Ctrl + F5`，或检查 `index.html` 中 JS 版本参数 |

生产环境建议补充：

- 修改 `SECRET_KEY` 和 MySQL 密码。
- 使用云数据库或独立 MySQL 实例保存数据。
- 给 Nginx 配置域名和 HTTPS。
- 使用对象存储或数据盘保存大型 trace 文件和模型文件。
- 通过安全组限制 MySQL 端口，不对公网开放 3306。
- Agent 节点通过中心 ECS 内网 IP 的 80 端口访问 Nginx，由 Nginx 转发 `/api` 到后端；公网用户同样通过 80 端口访问前端。
- 大型 ECS 集群可扩展为分层 Collector、消息队列和时序数据库架构，避免单中心和 MySQL 高频写入成为瓶颈。

## 主要 API

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/auth/register` | 注册用户 |
| `POST` | `/api/auth/login` | 登录并返回 Token |
| `GET` | `/api/auth/me` | 校验当前会话 |
| `GET` | `/api/dashboard/summary` | 资源总览指标 |
| `GET` | `/api/dashboard/risk-distribution` | 风险分布 |
| `GET` | `/api/instances` | 实例列表与筛选 |
| `GET` | `/api/alerts` | 告警列表 |
| `GET` | `/api/model/features` | 模型输入字段 |
| `POST` | `/api/model/predict` | 智能风险预测 |
| `GET` | `/api/model/history` | 预测历史 |
| `GET` | `/api/system/live` | 当前部署机器即时运行状态 |
| `POST` | `/api/agents/register` | Agent 自动注册服务器 |
| `POST` | `/api/metrics/report` | Agent 上报服务器指标 |
| `POST` | `/api/metrics/collect-local` | 中心节点采集本机并写入数据库 |
| `GET` | `/api/servers` | 多服务器列表与最新指标 |
| `GET` | `/api/metrics/trend` | 数据库指标趋势 |
| `GET` | `/api/server-alerts` | 数据库服务器告警 |
| `PATCH` | `/api/server-alerts/<id>` | 更新服务器告警处理状态 |
| `POST` | `/api/ops/load/start` | 启动三台 Agent 的演示负载 |
| `POST` | `/api/ops/load/stop` | 停止三台 Agent 的演示负载 |

需要认证的接口需携带：

```text
Authorization: Bearer <access_token>
```

## 课程要求符合性自检

| 原始要求 | 当前状态 |
|---|---|
| 使用 MySQL、MongoDB 或其他分布式数据库 | 已使用 MySQL 8.0 |
| 后端提供数据库访问 | 已通过 SQLAlchemy 访问 MySQL |
| 后端提供登录访问接口 | 已实现注册、登录、会话校验接口 |
| 后端提供机器学习或深度学习模型访问接口 | 已实现 `/api/model/predict` 和模型训练脚本 |
| 数据分析与可视化 | 已实现多服务器表格、指标趋势图、告警表格、预测历史和 ECharts 图表 |
| 服务器运行状态监控与预警 | 已实现实机 CPU、内存、磁盘、网络、IO、Swap 采集入库和风险判断 |
| 多服务器云平台监控 | 已实现 Agent 注册、指标上报、MySQL 存储、前端多服务器列表和趋势图 |
| 前端提供登录界面 | 已实现登录、注册、显示密码、记住用户名、退出 |
| 前端从数据库查询数据并展示表格和图表 | 已实现实例表格、告警表格和 ECharts 图表 |
| 前端调用模型接口 | 已实现智能预警页面 |
| 云端部署 | 已提供 Docker Compose、中心 ECS、Agent 分发和演示负载部署步骤，并完成过云端联调 |
| 使用 Flask 或 Django 开发后端 | 已使用 Flask |

## 当前版本边界

- 课程要求涉及的 MySQL、Flask 后端、登录接口、模型接口、数据表格、图表展示、模型调用和部署说明均已覆盖。
- 当前演示部署采用单中心平台 + 多 Agent Push 架构，适合课程演示和中小规模 ECS 集群。
- 大型集群扩展方向：按 VPC/可用区增加 Collector 汇聚节点，引入消息队列削峰，将高频指标迁移到 Prometheus、VictoriaMetrics、InfluxDB、ClickHouse 等时序或分析型数据库。
