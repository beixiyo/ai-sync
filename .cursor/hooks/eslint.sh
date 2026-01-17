#!/bin/bash

# 从 stdin 读取 JSON 输入
json_input=$(cat)

# 解析出 file_path
if command -v jq &> /dev/null; then
    file_path=$(echo "$json_input" | jq -r '.file_path // empty')
else
    file_path=$(echo "$json_input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
fi

# 如果 file_path 为空或文件不存在，退出
if [ -z "$file_path" ] || [ "$file_path" = "null" ] || [ ! -f "$file_path" ]; then
    exit 0
fi

# 只对 JavaScript/TypeScript 文件运行 eslint
case "$file_path" in
    *.js|*.jsx|*.ts|*.tsx|*.vue)
        # 运行 eslint 格式化该文件
        eslint_output=$(npx eslint --fix "$file_path" 2>&1)
        ;;
esac

exit 0
