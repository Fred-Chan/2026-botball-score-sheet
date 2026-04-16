# Botball Score Sheet - Vercel 部署版

## 功能特性

- ✅ 2026 Botball 计分表
- ✅ 积分挑战 / 巅峰对决两种模式切换
- ✅ A/B 场地分数管理
- ✅ ADDS 计时器
- ✅ 道具随机功能
- ✅ **比赛模式**（密码解锁 `botguy`）
- ✅ **分数提交到服务器**

## 部署到 Vercel

### 方法一：使用 Vercel CLI

```bash
# 1. 进入项目目录
cd botball-score-sheet

# 2. 登录 Vercel（如果未登录）
vercel login

# 3. 部署项目
vercel

# 4. 生产环境部署
vercel --prod
```

### 方法二：使用 GitHub 导入

1. 将项目推送到 GitHub 仓库
2. 登录 [vercel.com](https://vercel.com)
3. 点击 "Import Project"
4. 选择你的 GitHub 仓库
5. 点击 "Deploy"

## 本地开发

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm run dev

# 访问 http://localhost:3000
```

## API 接口

### POST /api/submit

提交比赛分数。

**请求体：**
```json
{
  "teamNumber": "001",
  "fieldId": "A",
  "mode": "challenge",
  "scoreA": 150,
  "scoreB": 200,
  "totalScore": 350,
  "breakdown": {
    "lower": 50,
    "upper": 100,
    ...
  },
  "timestamp": "2026-04-16T10:00:00.000Z",
  "inputData": { ... }
}
```

**响应：**
```json
{
  "success": true,
  "message": "Score submitted successfully",
  "id": "xxx"
}
```

## 数据存储

提交的数据保存在 `data/submissions.json` 文件中。

查看所有提交：
```bash
cat data/submissions.json | jq
```

## 比赛模式使用流程

1. 在页面顶部输入密码 `botguy` 解锁比赛模式
2. 输入队伍编号和选择赛台编号
3. 完成计分
4. 点击「提交分数」按钮
5. 提交成功后可选择「继续计分」或「重置计分」

## 项目结构

```
botball-score-sheet/
├── index.html          # 主页面
├── package.json        # Node.js 依赖配置
├── vercel.json         # Vercel 部署配置
├── api/
│   └── submit.js      # 分数提交 API
└── data/
    └── submissions.json # 提交数据存储
```
