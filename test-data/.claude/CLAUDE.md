## 代码要求
- 组件化：一个组件一个文件，具名导出
- 优化：项目用 babel-plugin-react-compiler 自动优化，通常无须手动memo，通用组件库（`src/components`）需手动 memo/useCallback
- 目录：`组件名/index.tsx` 或 `index.ts` 统一导出
- 组件库：优先用 `src/components/**` 或 `packages/comps` 已有组件
