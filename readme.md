# 清糖笔记 · 个人血糖管理与趋势分析应用

一款专为个人血糖监测、日常记录与复盘分析设计的 Web 应用，支持 `mmol/L` 与 `mg/dL` 实时换算、TIR（目标范围内时间）达标率评估、24 小时全天时段分布分析、饮食运动关联统计、CSV 导出与复诊单打印，并支持 Google 账号云端加密同步（Firebase Auth + Firestore）。

## 核心功能

- **快速录入与即时评估**：支持 9 种测量时段（空腹、三餐前后、睡前、随机），输入数值自动换算单位并结合个人目标范围评估状态（偏低 / 达标 / 偏高 / 过高）。
- **多维趋势与 24 小时分布分析**：提供时间轴趋势折线图（含目标阴影带）及 24 小时全天叠加分布图，便于识别清晨空腹或餐后峰值规律。
- **核心临床统计指标**：实时计算周期平均血糖、预估糖化血红蛋白（eA1c）、TIR 达标率以及血糖波动系数（CV%）。
- **台账筛选与复诊导出**：支持关键词搜索、状态/时段过滤、CSV 表格导出及打印复诊汇总单。
- **双模式数据存储**：未登录时默认以本地浏览器试用模式运行（内置 14 天演示数据）；登录 Google 账号后数据实时同步至 Firestore，并支持一键导入本地新增记录。

## 本地开发运行

```bash
npm install --legacy-peer-deps
npm run dev
```

启动后访问 `http://localhost:3000`。

## Docker 容器化部署（Windows 本地与远程服务器）

本项目已配置多阶段构建 `Dockerfile`（对应备份文件 `Dockerbak.txt`）及一键部署脚本：

- **镜像名称与容器名称**：`bloodtest`
- **宿主机对外端口**：`7902`（容器内部监听 `3000`）
- **构建机制**：采用多阶段 Next.js `standalone` 构建方案，依赖严格按 `package-lock.json` 通过 `npm ci --legacy-peer-deps` 精确安装，避免在线解析依赖冲突或网络中断。

### 1. 锁文件更新说明

若新增、删除或修改过 `package.json` 中的依赖（或删除过 `package-lock.json`），部署前**必须先执行**以下命令重新生成锁文件（必须带 `--legacy-peer-deps`）：

```bash
npm install --legacy-peer-deps --package-lock-only
```

若遇到本地代理导致 `npmmirror` SSL 中断，可改用直连重试：

```bash
npm install --legacy-peer-deps --package-lock-only --noproxy "*" --fetch-retries=5
```

### 2. 本地 Docker Desktop 一键部署

确保 Windows 上已启动 Docker Desktop，双击或在命令行运行：

```bat
redeploy.bat
```

部署完成后可通过 `http://localhost:7902` 访问，持久化挂载目录为 `D:\docker\bloodtest\data`。

### 3. 远程 Linux 服务器一键部署

确认本机已配置 `scp` / `ssh` 客户端，运行：

```bat
upload2remote.bat
```

脚本会在本地构建 `bloodtest` 镜像、导出 `.tar` 并上传至远程服务器加载运行，对外映射端口为 `7902`，远程持久化目录为 `/bak/docker/bloodtest/data`。
