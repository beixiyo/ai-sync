# Show 与 For

按 signal 条件渲染、渲染 signal 数组，带 fallback，子节点可为函数

## Show（条件渲染）

```tsx
import { signal } from '@preact/signals-react'
import { useSignals } from '@preact/signals-react/runtime'
import { Show } from '@preact/signals-react/utils'

const visible = signal(false)

function Demo() {
  useSignals()
  return (
    <>
      <Show when={ visible } fallback={ <p>隐藏</p> }>
        <p>可见内容</p>
      </Show>
      {/* 子节点为函数时可拿到 when 的值 */}
      <Show when={ visible }>
        {n => <p>
          当前:
          {n}
        </p>}
      </Show>
    </>
  )
}
```

- `when`：signal，为真时渲染 children，否则渲染 `fallback`
- 子节点可为 `(value) => JSX` 以使用 when 的值

## For（列表，自动缓存项）

```tsx
import { signal } from '@preact/signals-react'
import { useSignals } from '@preact/signals-react/runtime'
import { For } from '@preact/signals-react/utils'

const items = signal([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])

function List() {
  useSignals()
  return (
    <For each={ items } fallback={ <p>空</p> }>
      {item => (
        <div key={ item.id }>{item.name}</div>
      )}
    </For>
  )
}
```

- `each`：signal 数组
- 子节点为函数 `(item) => JSX`，列表项自动缓存
- `fallback`：数组为空时渲染
