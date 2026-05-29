## Proposal: TypeScript 极简 Statechart Spec DSL

### 术语

- **DSL**：领域专用语言。这里指一组很小的 TypeScript API，用代码直观描述 statecharts，不是发明新语法，也不做 codegen。
- **SCXML**：statecharts 的 XML 标准。本项目不实现 SCXML；以后最多考虑导入/导出。
- **正交**：彼此独立的状态维度，比如 `document`、`network`、`panel`。
- **并行**：多个正交 region 同时 active。这里不表示多线程或异步执行。

### 形态

做一个 spec-first 的小库：

```ts
const spec = chart({
  structure,
  transitions,
  crossRegion,
});

const result = transition(spec, state, event);
```

库负责：

```text
状态结构
转移定义
纯 transition 计算
检查模糊或冲突的 transition
```

库不负责：

```text
runtime
actor
effect 执行
订阅
计时器
异步任务生命周期
UI 框架集成
```

### Structure

Structure 描述合法的状态空间。

```ts
const structure = parallel({
  document: region("clean", "dirty", "saving"),
  network: region("online", "offline"),
  panel: region("open", "closed"),
});
```

当前状态是 product state：

```ts
type AppState = {
  document: DocumentState;
  network: NetworkState;
  panel: PanelState;
};
```

### Transitions

除非额外声明，否则 transition 只属于某个 region。

```ts
const transitions = [
  tr("document.clean", "CHANGE", "document.dirty"),
  tr("document.dirty", "SAVE", "document.saving"),
  tr("document.saving", "SUCCESS", "document.clean"),

  tr("network.online", "DISCONNECT", "network.offline"),
  tr("network.offline", "RECONNECT", "network.online"),
];
```

这样局部状态图保持可读，不把所有东西都嵌进一个巨大的配置对象。

### Cross-Region IPC

不使用全局 context bag。

状态相关数据跟着具体状态走：

```ts
type DocumentState =
  | { tag: "clean"; doc: Doc }
  | { tag: "dirty"; doc: Doc; draft: Draft }
  | { tag: "saving"; doc: Doc; draft: Draft; requestId: string };
```

Region 不直接读取或修改其他 region。跨 region 通信通过显式组合规则完成：

```ts
const crossRegion = [
  on("SAVE", ({ state }) =>
    state.document.tag === "dirty" && state.network.tag === "online"
      ? patch({ document: { tag: "saving", draft: state.document.draft } })
      : none()
  ),

  on("DISCONNECT", ({ state }) =>
    patch({
      network: { tag: "offline" },
      document:
        state.document.tag === "saving"
          ? { tag: "dirty", draft: state.document.draft }
          : state.document,
    })
  ),
];
```

这是 IPC 边界：composer 读取多个 region，然后显式产出 patch。

### Transition Semantics

`transition(spec, state, event)` 是纯函数。

它可以返回：

```ts
type TransitionResult<S, FX = never> = {
  state: S;
  effects?: FX[];
};
```

Effect 只是数据。用户自己决定是否执行，以及如何执行。

主要陷阱是顺序问题。多个 rule 可能响应同一个 event，因此 evaluator 必须定义清楚语义。

推荐默认规则：

```text
1. 所有命中的 rule 都读取同一个 previous state
2. 每个 rule 返回 patch
3. 合并 patch
4. 如果两个 patch 修改同一个 region，抛出冲突
5. 以后需要时，再加入显式 override/priority
```

这样可以避免隐藏的中间状态，以及“谁先执行谁赢”的问题。

### Feature Decisions

| Statecharts 特性 | 决策 |
|---|---|
| 扁平状态 | 做 |
| Event | 做 |
| Transition target | 做 |
| Guard | 做 |
| Action / effect | 只做成数据 |
| Entry / exit action | 以后做，也只做成 effect data |
| Compound state | 做最小版本 |
| Initial state | 做 |
| Parallel state / region | 做 |
| Orthogonal region | 做 |
| Cross-region transition | 做 |
| State payload | 通过 discriminated union 做 |
| Global context | 不做 |
| Shallow history | 以后做 |
| Deep history | 大概率不做 |
| Eventless / always transition | 以后谨慎做 |
| Delayed / after transition | 以后做，但不做 timer runtime |
| Invoke / async service | 不做 |
| Actor | 不做 |
| Runtime interpreter | 不做 |
| Event queue | 不做 |
| Internal event | 大概率不做 |
| Final state | 以后做 |
| SCXML 兼容 | 以后也许做导入/导出 |
| 可视化 | 以后也许导出 Mermaid/PlantUML |
| Model checking 集成 | 以后也许导出 TLA+ skeleton |

### Boundary

这个库是一个 **statechart spec DSL + 纯 transition evaluator**。

它应该保持小，不变成：

```text
XState 式 runtime
actor system
effect manager
async workflow engine
application framework
```

适合的场景是：

```text
3-4 个 parallel regions
小型局部 FSM
少量显式 cross-region rules
强 TypeScript state payload 类型
优先可读 spec，而不是完整 statecharts 机器
```