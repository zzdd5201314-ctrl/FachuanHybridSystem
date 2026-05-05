# 法穿 AI 前端

**当前版本**：26.43.0

## 简介

`frontend/` 是法穿 AI 的 Web 前端工程，基于 React + TypeScript + Vite 构建，提供后台管理系统的完整交互实现。

## 技术栈

| 类别 | 技术 |
|:---|:---|
| 框架 | React 19、TypeScript 5.9、Vite 7 |
| 路由 | React Router v7（含懒加载） |
| 状态与请求 | Zustand v5、TanStack Query v5、Ky |
| UI 体系 | Tailwind CSS v4、shadcn/ui、Radix UI、Lucide Icons |
| 表单与校验 | React Hook Form、Zod |
| 日期 | date-fns、react-day-picker |
| 动画 | framer-motion |
| Toast | sonner |

## 项目结构

```
src/
├── components/
│   ├── shared/     # 项目级共享组件（DataTable, CommandPalette, EmptyState, Timeline...）
│   └── ui/         # shadcn/ui 基础组件（button, dialog, table, calendar...）
├── features/       # 业务模块（按功能划分）
│   ├── auth/       # 登录注册、密码重置
│   ├── cases/      # 案件管理
│   ├── clients/    # 当事人管理
│   ├── contracts/  # 合同管理
│   ├── inbox/      # 收件箱
│   ├── tools/      # 工具（法院短信、LPR 计算器、快递查询、要素转换）
│   ├── templates/  # 模板管理
│   ├── settings/   # 设置（律所、团队、律师、服务配置、日志、任务队列）
│   ├── message-sources/  # 消息来源管理
│   ├── organization/     # 组织管理（律所、律师、团队）
│   ├── reminders/  # 提醒管理
│   └── automation/ # 自动化工具（保全询价、文书识别）
├── layouts/        # 布局组件（AdminLayout, Navbar, Sidebar）
├── lib/            # 工具库（api.ts, utils.ts, date.ts, token.ts）
├── routes/         # 路由配置与路径常量
├── stores/         # Zustand 状态管理（auth.ts, ui.ts）
└── pages/          # 页面组件
```

## 功能模块

### 认证

- 登录 / 注册
- 忘记密码 / 重置密码
- JWT token 存储、刷新与 401 自动重试
- 路由守卫（访客页守卫、后台鉴权守卫）

### 核心业务

| 模块 | 功能 |
|:---|:---|
| 案件管理 | 列表、新建、详情、编辑；案件材料、文件夹、模板、访问授权、案件日志、案件编号管理 |
| 合同管理 | 列表、新建、详情、编辑；归档 Tab、文书 Tab、费用 Tab、立案 Tab |
| 当事人管理 | 列表、新建、详情、编辑；身份证 OCR、企业信息查询、财产线索管理 |
| 收件箱 | 消息列表、消息详情查看 |
| 提醒管理 | 提醒列表 |

### 组织管理

| 模块 | 功能 |
|:---|:---|
| 律所管理 | 列表、新建、详情、编辑 |
| 律师管理 | 列表、新建、详情、编辑 |
| 团队管理 | 列表 |
| 凭证管理 | 账号凭证列表 |

### 工具

| 工具 | 说明 |
|:---|:---|
| 法院短信 | 提交短信、查看详情、重试、列表浏览 |
| LPR 计算器 | LPR 利率查询与计算 |
| 快递查询 | EMS / 顺丰快递轨迹查询 |
| 要素转换 | 法律文书要素格式转换 |

### 设置

| 页面 | 说明 |
|:---|:---|
| 设置概览 | 设置入口总览 |
| 律所设置 | 律所信息配置 |
| 律师设置 | 律师信息管理 |
| 团队设置 | 团队配置 |
| 服务配置 | 外部服务集成（SMTP、短信等） |
| 操作日志 | 系统操作日志查看 |
| 任务队列 | 后台异步任务管理 |

### 模板管理

- 模板列表浏览
- 新建 / 编辑模板
- 模板详情查看

### 自动化

- 财产保全询价（列表 / 详情）
- 文书智能识别（列表 / 详情）

### 其他

- **Cmd+K 全局搜索**：快捷键唤起命令面板，检索案件、当事人、合同等业务数据
- **仪表盘**：系统概览与数据统计
- **消息来源管理**：消息来源配置与管理

## 本地开发

```bash
pnpm install
pnpm dev          # 开发服务器 http://localhost:5173
pnpm build        # 生产构建（含 tsc -b 类型检查）
pnpm lint         # ESLint 检查
pnpm preview      # 预览生产构建
```

## Feature 模块约定

标准目录结构（大部分模块遵循）：

```
features/xxx/
├── api.ts              # API 客户端 (createApiClient)
├── hooks/              # TanStack Query hooks (use-xxx.ts)
├── components/         # 页面组件
├── index.ts            # 模块入口（re-export）
└── types.ts            # TypeScript 类型定义
```

部分模块额外包含：`schemas.ts`（zod 校验）、`constants.ts`、`utils/`、`api/`（多文件 API）

## API 客户端

使用 `@/lib/api` 中的 `createApiClient` 创建 API 客户端：

```typescript
import { createApiClient } from '@/lib/api'

const api = createApiClient({
  prefixUrl: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002/api/v1'}/xxx`,
})

// GET
const data = await api.get('').json<MyType>()
// POST
const result = await api.post('', { json: body }).json<MyType>()
// PUT
await api.put(`${id}`, { json: body }).json<MyType>()
// DELETE
await api.delete(`${id}`)
```

## 新增 shadcn/ui 组件

```bash
pnpm dlx shadcn@latest add <component>
```

已集成组件：button, dialog, table, input, select, label, tabs, card, badge, dropdown-menu, separator, avatar, breadcrumb, calendar, checkbox, collapsible, command, popover, scroll-area, sheet, switch, textarea 等。
