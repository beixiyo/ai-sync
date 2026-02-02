---
name: agent-browser
description: 自动化浏览器操作，用于 Web 测试、表单填写、截图和数据抓取。当用户需要浏览网站、与网页交互、填写表单、截图、测试 Web 应用或从网页提取信息时使用
---

## 快速开始

NOTE: 首次执行必须先执行 `agent-browser close` 确保状态正确
```bash
agent-browser open <url>        # 打开页面
agent-browser snapshot -i       # 获取带引用符的可交互元素
agent-browser click @e1         # 按引用点击元素
agent-browser fill @e2 "text"   # 按引用填充输入框
agent-browser close             # 关闭浏览器
```

## 核心流程

1. 导航：`agent-browser open <url>`
2. 快照：`agent-browser snapshot -i`（返回带 `@e1`、`@e2` 等引用的元素）
3. 使用快照中的引用进行交互
4. 导航或 DOM 明显变化后重新执行快照

## 命令

### 导航

```bash
agent-browser open <url>      # 打开 URL（别名：goto、navigate）
                              # 支持：https://、http://、file://、about:、data://
                              # 未指定协议时自动添加 https://
agent-browser back            # 后退
agent-browser forward         # 前进
agent-browser reload          # 刷新页面
agent-browser close           # 关闭浏览器（别名：quit、exit）
agent-browser connect 9222    # 通过 CDP 端口连接浏览器
```

### 快照（页面分析）

```bash
agent-browser snapshot            # 完整无障碍树
agent-browser snapshot -i         # 仅可交互元素（推荐）
agent-browser snapshot -c         # 紧凑输出
agent-browser snapshot -d 3       # 限制深度为 3
agent-browser snapshot -s "#main" # 限定到 CSS 选择器范围
```

### 交互（使用快照中的 @ref）

```bash
agent-browser click @e1           # 点击
agent-browser dblclick @e1        # 双击
agent-browser focus @e1           # 聚焦元素
agent-browser fill @e2 "text"     # 清空并输入
agent-browser type @e2 "text"     # 追加输入（不清空）
agent-browser press Enter         # 按键（别名：key）
agent-browser press Control+a     # 组合键
agent-browser keydown Shift       # 按下并保持
agent-browser keyup Shift         # 释放按键
agent-browser hover @e1           # 悬停
agent-browser check @e1           # 勾选复选框
agent-browser uncheck @e1         # 取消勾选复选框
agent-browser select @e1 "value"  # 选择下拉选项
agent-browser select @e1 "a" "b"  # 选择多个选项
agent-browser scroll down 500     # 滚动页面（默认向下 300px）
agent-browser scrollintoview @e1  # 滚动至元素可见（别名：scrollinto）
agent-browser drag @e1 @e2        # 拖拽
agent-browser upload @e1 file.pdf # 上传文件
```

### 获取信息

```bash
agent-browser get text @e1        # 获取元素文本
agent-browser get html @e1        # 获取 innerHTML
agent-browser get value @e1       # 获取输入值
agent-browser get attr @e1 href   # 获取属性
agent-browser get title           # 获取页面标题
agent-browser get url             # 获取当前 URL
agent-browser get count ".item"   # 统计匹配元素数量
agent-browser get box @e1         # 获取边界框
agent-browser get styles @e1      # 获取计算样式（字体、颜色、背景等）
```

### 检查状态

```bash
agent-browser is visible @e1      # 检查是否可见
agent-browser is enabled @e1      # 检查是否启用
agent-browser is checked @e1      # 检查是否已勾选
```

### 截图与 PDF

```bash
agent-browser screenshot path.png # 保存到指定路径
agent-browser screenshot --full   # 整页截图
agent-browser pdf output.pdf      # 保存为 PDF
```

### 视频录制

```bash
agent-browser record start ./demo.webm    # 开始录制（使用当前 URL 和状态）
agent-browser click @e1                   # 执行操作
agent-browser record stop                 # 停止并保存视频
agent-browser record restart ./take2.webm # 停止当前并开始新录制
```

录制会创建新的上下文，但会保留当前会话的 cookies 和存储。未提供 URL 时会自动回到当前页面。建议先探索页面，再开始录制，以得到顺畅的演示效果

### 等待

```bash
agent-browser wait @e1                     # 等待元素出现
agent-browser wait 2000                    # 等待毫秒数
agent-browser wait --text "Success"        # 等待文本出现（或 -t）
agent-browser wait --url "**/dashboard"    # 等待 URL 匹配（或 -u）
agent-browser wait --load networkidle      # 等待网络空闲（或 -l）
agent-browser wait --fn "window.ready"     # 等待 JS 条件成立（或 -f）
```

### 鼠标控制

```bash
agent-browser mouse move 100 200      # 移动鼠标
agent-browser mouse down left         # 按下按键
agent-browser mouse up left           # 释放按键
agent-browser mouse wheel 100         # 滚轮
```

### 语义定位器（替代 ref）

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find text "Sign In" click --exact      # 仅精确匹配
agent-browser find label "Email" fill "user@test.com"
agent-browser find placeholder "Search" type "query"
agent-browser find alt "Logo" click
agent-browser find title "Close" click
agent-browser find testid "submit-btn" click
agent-browser find first ".item" click
agent-browser find last ".item" click
agent-browser find nth 2 "a" hover
```

### 浏览器设置

```bash
agent-browser set viewport 1920 1080          # 设置视口大小
agent-browser set device "iPhone 14"          # 模拟设备
agent-browser set geo 37.7749 -122.4194       # 设置地理位置（别名：geolocation）
agent-browser set offline on                  # 切换离线模式
agent-browser set headers '{"X-Key":"v"}'     # 额外 HTTP 头
agent-browser set credentials user pass       # HTTP 基本认证（别名：auth）
agent-browser set media dark                  # 模拟配色方案
agent-browser set media light reduced-motion  # 浅色模式 + 减少动效
```

### Cookies 与存储

```bash
agent-browser cookies                     # 获取所有 cookies
agent-browser cookies set name value      # 设置 cookie
agent-browser cookies clear               # 清空 cookies
agent-browser storage local               # 获取所有 localStorage
agent-browser storage local key           # 获取指定键
agent-browser storage local set k v       # 设置值
agent-browser storage local clear         # 清空全部
```

### 网络

```bash
agent-browser network route <url>              # 拦截请求
agent-browser network route <url> --abort      # 阻止请求
agent-browser network route <url> --body '{}'  # 模拟响应
agent-browser network unroute [url]            # 移除路由
agent-browser network requests                 # 查看已追踪请求
agent-browser network requests --filter api    # 过滤请求
```

### 标签页与窗口

```bash
agent-browser tab                 # 列出标签页
agent-browser tab new [url]       # 新建标签页
agent-browser tab 2               # 按索引切换标签页
agent-browser tab close           # 关闭当前标签页
agent-browser tab close 2         # 按索引关闭标签页
agent-browser window new          # 新建窗口
```

### 框架

```bash
agent-browser frame "#iframe"     # 切换到 iframe
agent-browser frame main          # 回到主框架
```

### 对话框

```bash
agent-browser dialog accept [text]  # 接受对话框
agent-browser dialog dismiss        # 关闭对话框
```

### JavaScript

```bash
agent-browser eval "document.title"   # 执行 JavaScript
```

## 全局选项

```bash
agent-browser --session <name> ...    # 隔离的浏览器会话
agent-browser --json ...              # JSON 输出便于解析
agent-browser --headed ...            # 显示浏览器窗口（非无头模式）
agent-browser --full ...              # 整页截图（-f）
agent-browser --cdp <port> ...        # 通过 Chrome DevTools Protocol 连接
agent-browser -p <provider> ...       # 云浏览器服务商（--provider）
agent-browser --proxy <url> ...       # 使用代理服务器
agent-browser --headers <json> ...    # 限定到 URL 源头的 HTTP 头
agent-browser --executable-path <p>   # 自定义浏览器可执行文件路径
agent-browser --extension <path> ...  # 加载浏览器扩展（可重复）
agent-browser --help                  # 显示帮助（-h）
agent-browser --version               # 显示版本（-V）
agent-browser <command> --help        # 显示命令的详细帮助
```

### 代理支持

```bash
agent-browser --proxy http://proxy.com:8080 open example.com
agent-browser --proxy http://user:pass@proxy.com:8080 open example.com
agent-browser --proxy socks5://proxy.com:1080 open example.com
```

## 环境变量

```bash
AGENT_BROWSER_SESSION="mysession"            # 默认会话名
AGENT_BROWSER_EXECUTABLE_PATH="/path/chrome" # 自定义浏览器路径
AGENT_BROWSER_EXTENSIONS="/ext1,/ext2"       # 逗号分隔的扩展路径
AGENT_BROWSER_PROVIDER="your-cloud-browser-provider"  # 云浏览器服务商（可选 browseruse 或 browserbase）
AGENT_BROWSER_STREAM_PORT="9223"             # WebSocket 流端口
AGENT_BROWSER_HOME="/path/to/agent-browser"  # 自定义安装路径（用于 daemon.js）
```

## 示例：表单提交

```bash
agent-browser open https://example.com/form
agent-browser snapshot -i
# 输出示例：textbox "Email" [ref=e1], textbox "Password" [ref=e2], button "Submit" [ref=e3]

agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --load networkidle
agent-browser snapshot -i  # 检查结果
```

## 示例：使用保存状态的身份认证

```bash
# 登录一次
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "username"
agent-browser fill @e2 "password"
agent-browser click @e3
agent-browser wait --url "**/dashboard"
agent-browser state save auth.json

# 后续会话：加载已保存状态
agent-browser state load auth.json
agent-browser open https://app.example.com/dashboard
```

## 会话（并行浏览器）

```bash
agent-browser --session test1 open site-a.com
agent-browser --session test2 open site-b.com
agent-browser session list
```

## JSON 输出（便于解析）

添加 `--json` 获取机器可读输出：

```bash
agent-browser snapshot -i --json
agent-browser get text @e1 --json
```

## 调试

```bash
agent-browser --headed open example.com   # 显示浏览器窗口，仅当用户需要确认或者手动登陆等场景使用
agent-browser --cdp 9222 snapshot         # 通过 CDP 端口连接
agent-browser connect 9222                # 替代方式：connect 命令
agent-browser console                     # 查看控制台消息
agent-browser console --clear             # 清空控制台
agent-browser errors                      # 查看页面错误
agent-browser errors --clear              # 清空错误
agent-browser highlight @e1               # 高亮元素
agent-browser trace start                 # 开始录制 trace
agent-browser trace stop trace.zip        # 停止并保存 trace
agent-browser record start ./debug.webm   # 从当前页面录制视频
agent-browser record stop                 # 保存录制
```

## HTTPS 证书错误

对使用自签名或无效证书的站点：
```bash
agent-browser open https://localhost:8443 --ignore-https-errors
```

NOTE: 首次执行必须先执行 `agent-browser close` 确保状态正确