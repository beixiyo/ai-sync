# Signal 与 Hooks

创建响应式状态、派生值、组件内 signal/hooks。组件内访问 `.value` 会自动订阅并重渲染

## signal + computed（模块级）

```tsx
import { computed, signal } from '@preact/signals-react'
import { useSignals } from '@preact/signals-react/runtime'

const firstName = signal('Jane')
const lastName = signal('Doe')
const fullName = computed(() => `${firstName.value} ${lastName.value}`)

function Form() {
  useSignals()
  return (
    <>
      <input value={ firstName.value } onChange={ e => (firstName.value = e.target.value) } />
      <input value={ lastName.value } onChange={ e => (lastName.value = e.target.value) } />
      <p>{fullName.value}</p>
    </>
  )
}
```

- `signal(initial)`：创建响应式状态，`.value` 读写
- `computed(fn)`：从 signal 派生只读 signal，懒更新

## useSignal + useComputed + useSignalEffect（组件内）

```tsx
import { useComputed, useSignal, useSignalEffect } from '@preact/signals-react'
import { useSignals } from '@preact/signals-react/runtime'

function Counter() {
  useSignals()
  const count = useSignal(0)
  const double = useComputed(() => count.value * 2)

  /** 类似 Vue 自动追踪依赖 */
  useSignalEffect(() => {
    console.log(count.value, double.value)
    return () => console.log('cleanup')
  })

  return (
    <>
      <p>
        {count.value}
        {' '}
        × 2 =
        {' '}
        {double.value}
      </p>
      <button onClick={ () => count.value += 1 }>+1</button>
    </>
  )
}
```

- `useSignal(initial)`：组件内创建 signal，仅用初始值一次
- `useComputed(fn)`：组件内派生值
- `useSignalEffect(fn)`：响应 signal 变化执行副作用，可返回 cleanup
