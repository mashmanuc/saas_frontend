/**
 * applyDataDiff tests — canonical partial state application.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { applyDataDiff } from '../applyDataDiff'
import type { FieldSetterMap } from '../applyDataDiff'

interface MockData extends Record<string, unknown> {
  type: 'sin' | 'cos' | 'tan'
  rel: '=' | '>' | '<'
  a: number
  snapSpecial: boolean
  showGraph: boolean
}

interface MockEngine {
  state: MockData
  calls: { setter: string; value: unknown }[]
}

function makeEngine(initial: MockData): MockEngine {
  return { state: { ...initial }, calls: [] }
}

function makeSetters(): FieldSetterMap<MockEngine, MockData> {
  return {
    type: (e, v) => {
      e.state = { ...e.state, type: v }
      e.calls.push({ setter: 'type', value: v })
    },
    rel: (e, v) => {
      e.state = { ...e.state, rel: v }
      e.calls.push({ setter: 'rel', value: v })
    },
    a: (e, v) => {
      e.state = { ...e.state, a: v }
      e.calls.push({ setter: 'a', value: v })
    },
    snapSpecial: (e, v) => {
      e.state = { ...e.state, snapSpecial: v }
      e.calls.push({ setter: 'snapSpecial', value: v })
    },
    showGraph: (e, v) => {
      e.state = { ...e.state, showGraph: v }
      e.calls.push({ setter: 'showGraph', value: v })
    },
  }
}

const baseline: MockData = {
  type: 'sin',
  rel: '=',
  a: 0.5,
  snapSpecial: true,
  showGraph: true,
}

describe('applyDataDiff — single field change', () => {
  let engine: MockEngine

  beforeEach(() => {
    engine = makeEngine(baseline)
  })

  it('calls setter once for changed field', () => {
    applyDataDiff(engine, baseline, { a: 0.9 }, makeSetters())
    expect(engine.calls).toEqual([{ setter: 'a', value: 0.9 }])
    expect(engine.state.a).toBe(0.9)
  })

  it('does not call setter for unchanged field', () => {
    applyDataDiff(engine, baseline, { a: 0.5 }, makeSetters())  // same value
    expect(engine.calls).toEqual([])
  })

  it('does not call setter for undefined values', () => {
    applyDataDiff(
      engine,
      baseline,
      { a: undefined } as Partial<MockData>,
      makeSetters(),
    )
    expect(engine.calls).toEqual([])
  })
})

describe('applyDataDiff — multi-field change', () => {
  let engine: MockEngine

  beforeEach(() => {
    engine = makeEngine(baseline)
  })

  it('calls one setter per changed field', () => {
    applyDataDiff(
      engine,
      baseline,
      { type: 'cos', rel: '>', a: 0.9 },
      makeSetters(),
    )
    expect(engine.calls.map((c) => c.setter).sort()).toEqual(['a', 'rel', 'type'])
    expect(engine.state.type).toBe('cos')
    expect(engine.state.rel).toBe('>')
    expect(engine.state.a).toBe(0.9)
  })

  it('skips unchanged fields у multi-field update', () => {
    applyDataDiff(
      engine,
      baseline,
      { type: 'cos', rel: '=', a: 0.9 },  // rel unchanged
      makeSetters(),
    )
    expect(engine.calls.map((c) => c.setter).sort()).toEqual(['a', 'type'])
    // rel NOT called
    expect(engine.calls.find((c) => c.setter === 'rel')).toBeUndefined()
  })
})

describe('applyDataDiff — boolean fields', () => {
  it('flips boolean from true → false', () => {
    const engine = makeEngine(baseline)
    applyDataDiff(engine, baseline, { snapSpecial: false }, makeSetters())
    expect(engine.calls).toEqual([{ setter: 'snapSpecial', value: false }])
  })

  it('skips boolean у same state', () => {
    const engine = makeEngine(baseline)
    applyDataDiff(engine, baseline, { snapSpecial: true }, makeSetters())
    expect(engine.calls).toEqual([])
  })
})

describe('applyDataDiff — unknown field forward-compat', () => {
  it('silently skips fields without registered setter', () => {
    const engine = makeEngine(baseline)
    const incompleteSetters: FieldSetterMap<MockEngine, MockData> = {
      a: makeSetters().a,
      // type / rel / snapSpecial / showGraph NOT registered
    }
    applyDataDiff(
      engine,
      baseline,
      { type: 'cos', a: 0.9 },
      incompleteSetters,
    )
    expect(engine.calls).toEqual([{ setter: 'a', value: 0.9 }])
    // type setter не registered → silent skip
    expect(engine.state.type).toBe('sin')
  })

  it('empty setter map → all fields silently skipped (no-op)', () => {
    const engine = makeEngine(baseline)
    applyDataDiff(
      engine,
      baseline,
      { type: 'cos', a: 0.9 },
      {},
    )
    expect(engine.calls).toEqual([])
  })
})

describe('applyDataDiff — empty next', () => {
  it('empty patch → no calls', () => {
    const engine = makeEngine(baseline)
    applyDataDiff(engine, baseline, {}, makeSetters())
    expect(engine.calls).toEqual([])
  })
})

describe('applyDataDiff — Object.is semantics', () => {
  it('NaN === NaN treated as unchanged (Object.is(NaN, NaN) === true)', () => {
    const engine = makeEngine({ ...baseline, a: NaN })
    applyDataDiff(
      engine,
      { ...baseline, a: NaN },
      { a: NaN },
      makeSetters(),
    )
    expect(engine.calls).toEqual([])  // NaN === NaN under Object.is
  })

  it('0 vs -0 distinguished (Object.is(0, -0) === false)', () => {
    const engine = makeEngine({ ...baseline, a: 0 })
    applyDataDiff(
      engine,
      { ...baseline, a: 0 },
      { a: -0 },
      makeSetters(),
    )
    expect(engine.calls).toEqual([{ setter: 'a', value: -0 }])
  })
})

describe('applyDataDiff — does not mutate inputs', () => {
  it('current snapshot unchanged', () => {
    const engine = makeEngine(baseline)
    const currentSnapshot = JSON.parse(JSON.stringify(baseline))
    applyDataDiff(engine, baseline, { a: 0.9 }, makeSetters())
    expect(baseline).toEqual(currentSnapshot)
  })

  it('next patch unchanged', () => {
    const engine = makeEngine(baseline)
    const patch = { a: 0.9 }
    const patchSnapshot = JSON.parse(JSON.stringify(patch))
    applyDataDiff(engine, baseline, patch, makeSetters())
    expect(patch).toEqual(patchSnapshot)
  })
})
