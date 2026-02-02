# Effect 与订阅控制

响应 signal 变化执行副作用；控制「谁被订阅」以避免循环或减少触发次数

## effect + peek（避免 effect 内写 signal 造成循环）

```tsx
import { effect, signal } from '@preact/signals-react'

const counter = signal(0)
const runCount = signal(0)

effect(() => {
  counter.value
  /** 用 peek 读 runCount 不建立订阅，否则写 runCount 会再次触发 effect → 死循环 */
  runCount.value = runCount.peek() + 1
})
```

- `effect(fn)`：读取到的 signal 变化时执行 fn；可返回 cleanup；返回值调用即 dispose
- `signal.peek()`：读当前值但不建立订阅

## batch（合并多次写入，effect 只触发一次）

```tsx
import { batch, computed, effect, signal } from '@preact/signals-react'

const a = signal(0)
const b = signal(0)
const sum = computed(() => a.value + b.value)
effect(() => console.log(sum.value))

batch(() => {
  a.value = 1
  b.value = 2
})
// effect 只跑一次，log 一次 3
```

- `batch(fn)`：fn 内多次 signal 写入合并为一次更新

## untracked（effect 内读 signal 但不订阅）

```tsx
import { effect, signal, untracked } from '@preact/signals-react'

const main = signal(0)
const side = signal(100)

effect(() => {
  const m = main.value
  const s = untracked(() => side.value)
  console.log(m, s)
})
/** 只有 main 变化会触发 effect；改 side 不触发 */
```

- `untracked(fn)`：在 effect 内执行 fn，但不订阅 fn 里访问的 signals
