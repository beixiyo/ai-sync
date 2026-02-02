---
name: github
description: 当用户需要查询和操作 GitHub 时使用。使用 gh cli 进行仓库信息查询、文件读取、分支查看、Issue/PR 查询等操作
---

## 任务目标
使用 GitHub CLI (gh) 帮助用户查询 GitHub 仓库信息、文件内容、提交记录、Issue 和 PR 等

## 核心命令

### 仓库信息
```bash
# 建议优先使用 JSON 输出，避免 README 导致输出过长
gh repo view {owner}/{repo} --json name,description,primaryLanguage,stargazerCount,url
```

### 文件内容（最常用）
```bash
# 读取文件内容（需解码）
gh api "repos/{owner}/{repo}/contents/{path/to/file}" --jq '.content' | base64 -d

# 读取 README
gh api "repos/{owner}/{repo}/readme" --jq '.content' | base64 -d

# 列出目录（仅显示名称，节省 Token）
gh api "repos/{owner}/{repo}/contents/{path}" --jq '.[].name'
```

### 分支和提交
```bash
# 列出所有分支名称
gh api "repos/{owner}/{repo}/branches" --jq '.[].name'

# 获取最近 3 条提交记录（格式化输出）
gh api "repos/{owner}/{repo}/commits?per_page=3" --jq '.[] | {sha: .sha[0:7], message: .commit.message, author: .commit.author.name}'
```

### Issue 和 PR
```bash
# 列表显示（带限制）
gh issue list --repo {owner}/{repo} --limit 5
gh pr list --repo {owner}/{repo} --limit 5

# 搜索特定关键词的 Issue
gh issue list --repo {owner}/{repo} --search "{keyword}" --limit 5

# 获取 PR 详情（JSON）
gh api "repos/{owner}/{repo}/pulls/{number}" --jq '{title, body, state, html_url}'
```

### 通用 API
```bash
gh api {endpoint} --jq '.field'              # 任意 API + jq 过滤
gh api -X POST {endpoint} -f key=value       # POST 请求
```

## NOTE
- **必须对包含 `?` 或 `{}` 的 URL 加引号**，防止 Shell 错误
- **强制使用 `--jq` 过滤**：GitHub API 返回的原始 JSON 非常庞大，不加过滤会消耗大量 Token
- 文件内容是 base64 编码，必须配合 `| base64 -d` 使用
- 如果在本地仓库目录下，`{owner}` 和 `{repo}` 会被 `gh` 自动填充，但查询其他仓库时需手动替换
- **禁止执行修改命令**（如 gh repo edit, gh pr merge 等）
- **搜索代码优先使用 `gh-grep-mcp`** 工具而不是 GitHub API
