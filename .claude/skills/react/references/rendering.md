# 渲染优化

**导入**：`@preact/signals-react`（signal）

直接传 signal 进 JSX 可跳过 VDOM，只更新 DOM 文本，不触发组件重渲染

## 直接传 signal vs 用 .value

```tsx
import { signal } from '@preact/signals-react'
import { useSignals } from '@preact/signals-react/runtime'

const count = signal(0)

/** 会订阅 count，count 变 → 组件重渲染 */
function Unoptimized() {
  useSignals()
  return <span>{count.value}</span>
}

/** 不订阅，不重渲染；运行时直接更新该 DOM 文本节点 */
function Optimized() {
  useSignals()
  return <span><>{count}</></span>
}
```
