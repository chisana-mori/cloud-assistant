# IR Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an IR layer in the backend that normalizes Codex App Server events into a RunView tree and exposes it to the WebSocket consumers, while keeping a raw event log in memory.

**Architecture:** Introduce a lightweight IR types module and a mapper that consumes raw JSON-RPC notifications/requests, appends raw events, and updates a normalized RunView. CodexAppServer emits an `ir/update` event with the updated RunView alongside existing events.

**Tech Stack:** TypeScript, Node.js EventEmitter, existing Codex JSON-RPC protocol types.

---

### Task 1: Add IR type definitions

**Files:**
- Create: `src/types/ir.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createEmptyRunView } from '../src/types/ir';

describe('IR types', () => {
  it('creates an empty RunView', () => {
    const run = createEmptyRunView('thr_test');
    expect(run.runId).toBe('thr_test');
    expect(run.steps.length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ir-types.test.ts`
Expected: FAIL with "Cannot find module '../src/types/ir'"

**Step 3: Write minimal implementation**

```ts
export type RunView = { runId: string; steps: StepView[]; };
export type StepView = { stepId: string; kind: string; status: string; };

export function createEmptyRunView(runId: string): RunView {
  return { runId, steps: [] };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ir-types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/ir.ts tests/ir-types.test.ts
git commit -m "feat: add base IR types"
```

---

### Task 2: Implement IR mapper and tests

**Files:**
- Create: `src/core/ir-mapper.ts`
- Create: `tests/ir-mapper.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { IrMapper } from '../src/core/ir-mapper';

describe('IrMapper', () => {
  it('maps item/started and item/completed into a StepView', () => {
    const mapper = new IrMapper();
    mapper.consume({
      id: 'evt1', ts: 1, threadId: 'thr1', turnId: 't1',
      type: 'item/started',
      payload: { threadId: 'thr1', turnId: 't1', item: { id: 'i1', type: 'commandExecution', command: 'ls', cwd: '/' } }
    });
    mapper.consume({
      id: 'evt2', ts: 2, threadId: 'thr1', turnId: 't1',
      type: 'item/completed',
      payload: { threadId: 'thr1', turnId: 't1', item: { id: 'i1', type: 'commandExecution', aggregatedOutput: 'ok', status: 'completed' } }
    });

    const run = mapper.getRunView('thr1');
    expect(run.steps.length).toBe(1);
    expect(run.steps[0].kind).toBe('commandExecution');
    expect(run.steps[0].status).toBe('completed');
    expect(run.steps[0].result.output).toBe('ok');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ir-mapper.test.ts`
Expected: FAIL with "Cannot find module '../src/core/ir-mapper'"

**Step 3: Write minimal implementation**

```ts
export class IrMapper {
  // stores raw events + run view
  consume(rawEvent) { /* update */ }
  getRunView(threadId: string) { /* return */ }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ir-mapper.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/ir-mapper.ts tests/ir-mapper.test.ts

git commit -m "feat: add IR mapper"
```

---

### Task 3: Extend protocol types for missing events

**Files:**
- Modify: `src/types/protocol.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import type { TurnPlanUpdatedEvent } from '../src/types/protocol';

describe('protocol event types', () => {
  it('includes turn/plan/updated', () => {
    const e: TurnPlanUpdatedEvent = {
      method: 'turn/plan/updated',
      params: { threadId: 'thr', turnId: 't', plan: [{ step: 'a', status: 'pending' }] }
    };
    expect(e.method).toBe('turn/plan/updated');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/protocol-events.test.ts`
Expected: FAIL with missing type

**Step 3: Write minimal implementation**

Add missing event interfaces and item delta variants per protocol.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/protocol-events.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/protocol.ts tests/protocol-events.test.ts

git commit -m "feat: extend protocol event types"
```

---

### Task 4: Integrate IR into CodexAppServer

**Files:**
- Modify: `src/core/codex-app-server.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { CodexAppServer } from '../src/core/codex-app-server';

// Note: test will stub the event handler to capture ir/update.
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/codex-app-server-ir.test.ts`
Expected: FAIL (no ir/update emitted)

**Step 3: Write minimal implementation**

- Instantiate `IrMapper` in CodexAppServer
- On every incoming message, append a RawEvent
- When mapper updates a RunView, emit `ir/update` with RunView
- Keep existing `event` and `approval-request` emissions intact

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/codex-app-server-ir.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/codex-app-server.ts tests/codex-app-server-ir.test.ts

git commit -m "feat: emit IR updates from codex app server"
```

---

### Task 5: Sanity checks

**Step 1: Run targeted tests**

Run: `npx vitest run tests/ir-types.test.ts tests/ir-mapper.test.ts tests/protocol-events.test.ts tests/codex-app-server-ir.test.ts`
Expected: PASS

**Step 2: Optional full suite**

Run: `npx vitest run`
Expected: PASS (note existing approval-policy tests should be updated if still calling process.exit)

**Step 3: Commit (if needed)**

```bash
git status
```

