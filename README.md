# 农事专家

智能设施蔬菜种植决策系统 —— 为大棚蔬菜种植提供全方位的数字化管理支持。

## 功能特性

### 🏠 首页
- 实时天气监控（双源：Open-Meteo + wttr.in）
- 作物生长状态可视化
- AI 智能分析建议
- 风险预警与打药窗口提示
- 未来 7 天天气预报

### 🌱 种植计划
- AI 自动生成种植计划
- 关键农事时间节点提醒
- 采收预测与进度追踪
- 生长阶段自动推进

### 📝 操作记录
- 记录施肥、浇水、打药、整枝等农事操作
- 支持操作模板快速录入
- 操作统计与历史查询
- 农药安全间隔期提醒

### 📊 数据记录
- 株高、叶片数、茎粗、花朵数等生长指标追踪
- 棚温、棚湿等环境数据记录
- 自定义指标扩展
- 数据图表分析与 CSV 导出

### 📚 知识库
- 作物栽培技术（番茄、黄瓜、辣椒等）
- 病虫害识别与防治方案
- 农药安全使用指南
- 品种信息与推荐
- 决策规则引擎

### ⚙️ 设置
- 棚区管理（支持多个棚区）
- 作物管理（添加/编辑/归档）
- AI 接口配置（OpenAI 兼容）
- 天气源状态监控
- 城市定位与坐标设置
- 数据导出与系统重置

### 🤖 AI 功能
- 智能作物分析
- 种植计划自动生成
- 风险预警与建议
- 支持自定义接口地址和模型

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + Vite |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| PWA | vite-plugin-pwa (Workbox) |
| 后端框架 | Express 4 |
| 数据存储 | YAML + CSV（无数据库依赖） |
| 定时任务 | node-cron |
| AI 接口 | OpenAI SDK |
| 天气数据 | Open-Meteo + wttr.in |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
# 安装后端依赖
cd server && npm install

# 安装前端依赖
cd ../client && npm install
```

### 开发模式

```bash
# 终端1：启动后端（监听 3000 端口）
cd server && npm run dev

# 终端2：启动前端开发服务器（Vite）
cd client && npm run dev
```

### 生产部署

```bash
# 1. 构建前端
cd client && npm run build

# 2. 启动后端（自动托管前端静态文件）
cd ../server && npm start
```

访问 `http://localhost:3000` 即可使用。

## 目录结构

```
agri-expert/
├── client/                 # 前端应用
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   │   ├── HomeView.vue        # 首页
│   │   │   ├── PlantingPlanView.vue # 种植计划
│   │   │   ├── RecordView.vue      # 操作记录
│   │   │   ├── DataView.vue        # 数据记录
│   │   │   ├── KnowledgeView.vue   # 知识库
│   │   │   ├── SettingsView.vue    # 设置
│   │   │   └── SetupWizard.vue     # 初始化向导
│   │   ├── components/     # 公共组件
│   │   ├── stores/         # Pinia 状态管理
│   │   └── assets/         # 静态资源
│   ├── public/             # PWA 图标
│   └── dist/               # 构建产物
│
├── server/                 # 后端服务
│   ├── index.js            # 入口文件
│   ├── routes/             # API 路由
│   ├── services/           # 业务服务
│   ├── scheduler/          # 定时任务
│   ├── plugins/            # 插件系统（天气源）
│   ├── knowledge/          # 知识库
│   │   └── system/         # 系统知识（作物/病虫害/农药/品种/规则）
│   └── data/               # 运行时数据
│       ├── config.yml      # 系统配置
│       ├── operations.yml  # 操作记录
│       ├── templates.yml   # 操作模板
│       ├── custom_metrics.yml # 自定义指标
│       └── weather_history/   # 天气历史
│
└── README.md
```

## API 接口

| 路径 | 说明 |
|------|------|
| `GET /api/config` | 获取系统配置 |
| `POST /api/init` | 初始化系统 |
| `GET /api/weather` | 获取天气数据 |
| `GET /api/greenhouses` | 棚区列表 |
| `POST /api/greenhouses` | 添加棚区 |
| `GET /api/crops` | 作物列表 |
| `POST /api/crops` | 添加作物 |
| `GET /api/operations` | 操作记录 |
| `POST /api/operations` | 添加操作 |
| `GET /api/data-records` | 数据记录 |
| `POST /api/data-records` | 添加数据 |
| `GET /api/knowledge` | 知识库 |
| `POST /api/ai/analyze` | AI 分析 |
| `POST /api/ai/plan` | AI 生成计划 |

## 数据存储

本系统采用轻量级文件存储方案，无需安装数据库：

- **YAML 文件**：系统配置、知识库、AI 用量统计
- **CSV 文件**：生长数据记录（UTF-8 BOM 编码，兼容 Excel）
- **目录结构**：按作物类型组织知识库，按日期组织天气历史

## 内置知识库

- **作物**：番茄、黄瓜、辣椒（含生长阶段、管理要点）
- **病虫害**：20+ 种常见病虫害（含症状、防治方案）
- **农药**：常用农药安全数据（含安全间隔期）
- **品种**：主要作物品种信息
- **决策规则**：灌溉、施肥、通风、紧急预警规则

## 许可证

MIT License
