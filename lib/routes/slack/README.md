# Slack 消息转 RSS

使用 Slack Web API 将工作区所有频道消息聚合为 RSS 订阅源。

## 功能特性

- ✅ 一个 URL 订阅工作区所有频道
- ✅ 支持多工作区配置
- ✅ 可选 access key 保护
- ✅ 消息按时间排序
- ✅ 支持 AI 过滤（category 标签）

## 快速开始

### 1. 获取 Token

1. 登录 Slack 网页版（https://app.slack.com）
2. 按 **F12** 打开开发者工具
3. 切换到 **Network（网络）** 标签
4. 点击任意频道，找到 `conversations.history` 请求
5. 查看 **Payload（请求参数）**，复制 `token` 的值（以 `xoxc-` 开头）

### 2. 配置环境变量

```bash
# 工作区 1 - 公司
SLACK_TOKEN_company="xoxc-xxx"

# 工作区 2 - 个人
SLACK_TOKEN_personal="xoxc-xxx"

# 工作区 3 - 开源社区
SLACK_TOKEN_opensource="xoxc-xxx"

# （可选）全局 Access Key 保护
SLACK_ACCESS_KEY="your-secret-key"
```

### 3. 订阅 RSS

**基础 URL：**
```
http://localhost:1200/slack/workspace/{workspace}
```

**完整示例：**
```
# 公司工作区
http://localhost:1200/slack/workspace/company

# 个人工作区（带 limit 参数）
http://localhost:1200/slack/workspace/personal?limit=100

# 带 access key（如果配置了 SLACK_ACCESS_KEY）
http://localhost:1200/slack/workspace/opensource?key=your-secret-key&limit=50
```

## URL 参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `limit` | 限制消息数量（默认 50） | `?limit=100` |
| `key` | Access key（如果配置了） | `?key=secret` |

## 多工作区配置

| 工作区 | 环境变量 | RSS URL |
|--------|---------|---------|
| 公司 | `SLACK_TOKEN_company` | `/slack/workspace/company` |
| 个人 | `SLACK_TOKEN_personal` | `/slack/workspace/personal` |
| 开源 | `SLACK_TOKEN_opensource` | `/slack/workspace/opensource` |

**注意：** 每个工作区的 Token 是独立的，需要分别登录对应的工作区获取。

## Access Key 保护（可选）

为了防止未授权访问，可以配置全局 Access Key：

```bash
SLACK_ACCESS_KEY="your-secret-key"
```

配置后，所有请求都需要带 `?key=your-secret-key` 参数才能访问。

## 响应格式

RSS 包含以下信息：
- **title**: `[频道名] 消息内容`
- **category**: 频道名（方便 AI 过滤）
- **author**: 发送者
- **pubDate**: 发送时间

## 故障排查

### 错误：`SLACK_TOKEN_workspace is required`
- 检查环境变量名是否正确（区分大小写）
- 检查 Token 是否已设置

### 错误：`Invalid or missing access key`
- 如果配置了 `SLACK_ACCESS_KEY`，请求时必须带 `?key=` 参数

### 错误：`Slack API error: invalid_auth`
- Token 已过期，需要重新从浏览器获取
- 或尝试添加 Cookie（可选）

### RSS 为空
- 检查 Token 是否有权限访问该工作区
- 检查工作区是否有消息

## Token 安全

- ⚠️ **不要将 Token 提交到代码仓库**
- ⚠️ **不要在公开场合分享 Token**
- ✅ 使用环境变量存储
- ✅ 使用 Access Key 增加一层保护
- ⚠️ Token 会过期，需要定期更新

## 相关文件

- `workspace.ts` - 聚合 RSS 路由
- `channel.ts` - 单频道 RSS 路由（备用）
