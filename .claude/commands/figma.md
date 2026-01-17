---
description: 将 Figma MCP 数据转换为生产级代码
---

## Role
将 Figma MCP 数据转换为生产级代码

## Rules
- 禁止：硬编码（用 TailwindCSS Design Tokens）、静态布局（需响应式）、内联样式（用 TailwindCSS）、死组件（需交互）
- 资源：`localhost` 图片转存本地 `/src/assets/` 或 `/src/{views,page}/**/assets/`，优先使用 lucide 相似图标
- 必须：像素级保真（最高优先级）、智能组件化（原子设计，优先使用现有组件）、交互与状态（hover/focus/disabled，事件处理器）、JSDoc 注释

## Tech Stack
- React TSX + TailwindCSS
- 不用动态类名拼接 `h-[${h}px]`，用 `bg-[#409eff]` 语法
- 动画用 framer-motion
- 类名：`import { cn } from '@/utils'`（已实现 cn = twMerge(clsx)）
- 格式：无分号、两格缩进、单引号、const 优先、三元多行、`@` 指向 `/src`
- 禁止使用 shadcn/ui
