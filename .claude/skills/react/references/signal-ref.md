# Signal Ref 与外部值同步

把 DOM ref 或外部值接到 signal 生态（带 `.current` 或持续同步）

## useSignalRef（类似 useRef，但可触发响应式更新）

```tsx
import { useSignals } from '@preact/signals-react/runtime'
import { useSignalRef } from '@preact/signals-react/utils'

function Demo() {
  useSignals()
  const divRef = useSignalRef<HTMLDivElement | null>(null)

  return (
    <>
      <div ref={ divRef }>node</div>
      <p>
        {divRef.current
          ? 'mounted'
          : 'unmounted'}
      </p>
      <button onClick={ () => divRef.current.textContent = `udpate at ${Date.now()}` }>
        通过 ref 修改内容
      </button>
    </>
  )
}
```

- `useSignalRef(initial)`：创建带 `.current` 的 signal，挂载/卸载或修改会触发更新

## useLiveSignal（外部值 → 本地 Signal，只读镜像）

```tsx
import { useSignals } from '@preact/signals-react/runtime'
import { useLiveSignal } from '@preact/signals-react/utils'

function Child({ count }: { count: number }) {
  useSignals()
  const countSignal = useLiveSignal(count)
  return <SomeLib value={ countSignal } />
}
```

- `useLiveSignal(value)`：传入普通值（如 props），返回与之同步的本地 signal；不应修改返回的 signal（会被覆盖）
