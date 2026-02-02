---
name: react
description: 编写 React 时调用，提供 React 开发规范和最佳实践
---

## 项目可用工具
```ts
import {
  // 事件相关
  useOnWinHidden, useBindWinEvent, useClickOutside, useShortCutKey, useMouse,
  // 滚动相关
  useScrollBottom, useScrollReachBottom,
  // 生命周期，effect 可接收 async fn
  useRefresh, onMounted, onUnmounted, useUpdateEffect, useCustomEffect,
  // 性能优化
  useMemoFn,
  // 网络请求
  useReq, useWatchReq,
  // 观察器
  useIntersectionObserver, useResizeObserver, useMutationObserver,
  // 状态管理
  useToggle, useThrottle, useDebounce, useWatchDebounce, useAutoSave, useWatchThrottle, useStable, useLatestRef, useGetState, useViewTransitionState,
  // 主题相关
  useTheme, useToggleThemeWithTransition,
  // 订时器
  useDefer, useTimer,
  // Ref 相关
  useComposedRef, useConst,
  // 元素坐标相关
  useElBounding, useFloatingPosition,
  // 样式相关
  useInsertStyle, vShow,
  // 其他 Hooks
  useStateWithPromise, useTextOverflow, useViewportHeight, useWorker,
} from 'hooks' // packages/hooks

import {
  // 基础组件
  Button, Card, Icon, Badge, CloseBtn, Arrow,
  // 输入组件
  Input, Textarea, ChatInput, SearchBar, MdEditor,
  // 选择器组件
  Select, Checkbox, Radio, Switch, Cascader, DatePicker,
  // 表单组件
  Form, Uploader,
  // 弹窗组件
  Modal, Drawer, Popover, Dropdown, ContextMenu,
  // 反馈组件
  Loading, Notification, EmptyState, ErrorState, Skeleton, Progress, Message,
  // 轮播组件
  Carousel,
  // 布局组件
  SplitPane, Spacer, Separator, Sidebar, CollapsibleSidebar, Toolbar,
  // 数据展示
  Table, Pagination, Tabs, Steps,
  // 滚动组件
  InfiniteScroll, VirtualScroll, VirtualDyScroll, VirtualWaterfall, SeamlessScroll, PageSwiper,
  // 图片组件
  ImgThumbnails, LazyImg, PreviewImg, RetryImg, ImgTransition,
  // 动画组件
  Animate, AutoScrollAnimate, FlipItem, TransitionItem, TextFadeIn, TextReveal, HeroEnterText,
  // 背景组件
  BgPaths, BlurBgImg, GridBg, DyBgc, GradientBoundary, GradientText, LiquidGlass,
} from 'comps' // packages/comps

import {
  // 工具函数
  cn, addTimestampParam, extractLinks, normalizeEOL, isValidFileType, composeBase64,
  // React 工具
  getCompKey, filterValidComps, injectReactApp,
  // 样式管理
  svgStyle, createZIndexStore,
  // Markdown
  mdToHTML,
  // 光标坐标
  getCursorCoord, trackCursorCoord,
  // Suspense
  createSuspenseData,
} from 'utils' // packages/utils
```

## 组件模板
```tsx
import { cn } from 'utils'
import { memo, forwardRef } from 'react'

const InnerComp = forwardRef<CompRef, CompProps>((props) => {
  const { 
    style,
    className,
  } = props

  return <div
    className={ cn(
      'CompContainer',
      className
    ) }
    style={ style }
  >
  </div>
})

InnerComp.displayName = 'Comp'

export const Comp = memo(InnerComp) as typeof InnerComp

// 类型单独放 types.ts
export type CompRef = { }
export type CompProps = { }
& React.PropsWithChildren<React.HTMLAttributes<HTMLElement>>
```

## 代码要求
- 组件化：一个组件一个文件，具名导出
- 优化：项目用 babel-plugin-react-compiler 自动优化，通常无须手动 memo，通用组件库（`src/components`）需手动 memo/useCallback
- 路由：用 `@jl-org/vite-auto-route` 时，`/views/**/page.tsx` 直接 `export default`
- 目录：`组件名/index.tsx` 或 `index.ts` 统一导出
- 组件库：优先用 `src/components/**` 或 `packages/comps` 已有组件

## CSS
- TailwindCSS：用根目录设计 Token，无法实现时用行内样式，必须用 CSS 时用 `.module.scss`
- 类名：禁止未定义类名，用 `bg-[#409eff]` 语法，禁止动态拼接 `h-[${h}px]`
- 深色模式：`tailwind.config` 变量已自动适配，无需 `dark:` 前缀

## 库
- 禁止：shadcn/ui
- 推荐：lucide-react（图标）、`cn`(clsx+tailwind-merge)、class-variance-authority、motion/react

## 性能优化
- 列表渲染：只传递单个 item，避免传递整个数组
- props 传递: 尽量传递基本数据类型，避免对象造成大面积更新

## Hooks 基本规则
- **调用位置**：Hooks 必须在组件函数的顶层调用，严禁在条件语句、循环、嵌套函数中调用
  ```tsx
  // 错误：条件调用
  if (condition) {
    const [state, setState] = useState(0)
  }

  // 错误：循环中调用
  for (let i = 0; i < 10; i++) {
    useEffect(() => { ... })
  }

  // 错误：嵌套函数中调用
  const handleClick = () => {
    const [state, setState] = useState(0)
  }

  // 错误：条件调用
  if (condition) return null
  const useXx = useCallback(() => { ... }, [])

  // 正确：顶层调用
  const [state, setState] = useState(0)
  const handleClick = () => { ... }
  ```

- **命名规范**：自定义 Hooks 必须以 `use` 开头（如 `useFetch`、`useForm`），这是 React 识别 Hook 的唯一方式
- **调用顺序**：组件每次渲染时，Hooks 必须以相同的顺序调用，这是 React 正确工作的前提
- **依赖数组**：useEffect、useMemo、useCallback 的依赖数组必须包含所有外部引用的变量，注意依赖是基本数据类型并且稳定
- **不要在普通函数中调用 Hooks**：Hooks 只能在 React 组件或自定义 Hook 中调用

## 闭包陷阱
state 在 fn1 被 setState 后立即调用 fn2，fn2 读取 state 拿不到最新值（React 未立即更新）。用项目中的 `useGetState.ts` 解决，没有则告知

```tsx
// 问题：fn2 拿不到最新 count
const [count, setCount] = useState(0)

const fn1 = () => {
  setCount(count + 1)
  fn2() // count 仍是旧值
}
const fn2 = () => {
  console.log(count) // 0
}

const handleXx = () => {
  fn1()
  fn2() // 无法获取最新值
}
```

```tsx
// 解决：useGetState
import { useGetState } from 'hooks'

const [count, setCount] = useGetState(0)
const fn2 = () => {
  console.log(setCount.getLatest()) // 1
}
```

## Hooks 封装规范 (稳定性与 Refs)
在封装通用 Hooks 时，需平衡“开发体验”与“性能开销”，遵循以下精准优化原则：

### useStable (引用稳定化)
- **准则**：仅针对可能导致死循环的**复杂对象/数组**使用（如用户经常直接传入的 `options={{...}}`）
- **禁止基础类型**：严禁对 string, number, boolean 等基础类型使用
  - *原因*：React 依赖项对比（Object.is）对基础类型天然高效，封装 `useStable` 会引入多余的 Ref 存储和 `deepCompare` 计算开销

### useWatchRef (逻辑脱离响应式)
- **准则**：用于稳定**函数引用**或在执行时需要获取**最新值**但不想触发 Effect 重启的场景（类似 `useEffectEvent`）
- **尊重副作用清理**：当 Effect 内部存在清理逻辑（Cleanup），且依赖项是确定的**基础类型**时，**严禁**使用 `useWatchRef` 隐藏该依赖
  - *原因*：基础类型变化时，Effect 必须经历“销毁->重建”流以正确释放旧资源（如 `unsubscribe(oldId)`）并绑定新资源

## React 19.2 新特性
- `<Activity>`：替代条件渲染，隐藏时保留状态，`mode="visible|hidden"`
  ```tsx
  import { Activity } from 'react'
  <Activity mode={isActive ? 'visible' : 'hidden'}>
    <ExpensiveForm />
  </Activity>
  ```

- `useEffectEvent`：提取事件逻辑，访问最新值但不触发 effect 重运行，不能作为依赖项
  ```jsx
  import { useEffect, useEffectEvent } from 'react'

  function ChatRoom({ roomId, theme }) {
    const onConnected = useEffectEvent(() => {
      showNotification('Connected!', theme) // 总会获取最新 theme
    })

    useEffect(() => {
      const conn = createConnection(roomId)
      conn.on('connected', onConnected)
      conn.connect()
      return () => conn.disconnect()
    }, [roomId]); // 无需将 onConnected 或 theme 加入依赖
  }
  ```

## 状态管理
**Signal 可以有效解决 React 闭包陷阱等问题**

1. 通用组件库（src/components, packages/comps）只能用 react 内置 api，如 useState
2. 非通用组件，即非上述文件夹都属于业务组件，要尽量方便的访问数据，所以使用 @preact/signals-react

| 类型 | 说明 | 参考 |
|------|------|------|
| Signal 与 Hooks | signal、computed、useSignal、useComputed、useSignalEffect、useSignals | [references/signal-and-hooks.md](references/signal-and-hooks.md) |
| Effect 与订阅控制 | effect、batch、peek、untracked | [references/effect-and-tracking.md](references/effect-and-tracking.md) |
| Signal Ref | useSignalRef、useLiveSignal | [references/signal-ref.md](references/signal-ref.md) |
| Show / For | 条件渲染与列表 | [references/show-and-for.md](references/show-and-for.md) |
| 渲染优化 | 直接传 signal vs .value | [references/rendering.md](references/rendering.md) |

Detail in references/; read when implementing specific APIs