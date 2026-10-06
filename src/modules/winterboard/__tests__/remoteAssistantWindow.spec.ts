/**
 * LAW §9 v1.26 (власник 2026-10-06, «так на пропозицію Салют»): «– Згорнути вікно Інтегралика»
 * на пульті — лише коли вікно Інтегралика відкрите на ноутбуці.
 *   • ноутбук (useBoardRemote): `remote.state.assistant_open` — з `floatingObstacles`, куди вікно
 *     саме кладе свій прямокутник; новий стан — щойно вікно відкрилось чи згорнулось;
 *   • телефон: розбір поля — лише справжній boolean, як на сервері;
 *   • вікно (intent/CommandPalette.vue) повідомляє під тим самим ключем, що читає пульт;
 *   • верстка: без кнопки «Говорю» йде одразу під полем Інтегралика.
 * Кнопку на самому пульті — у WBRemoteView.v2.spec.ts (блок v1.14).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, reactive, defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useBoardRemote, isAssistantWindowOpen, ASSISTANT_WINDOW_OBSTACLE } from '../composables/useBoardRemote'
import { parseRemoteAssistantOpen } from '../composables/useRemoteChannel'
import { setFloatingObstacle } from '../board/floatingObstacles'
import { derivePair } from '../remote/remotePair'
import paletteSource from '../../intent/CommandPalette.vue?raw'
import remoteViewSource from '../views/WBRemoteView.vue?raw'

const SID = 'board-A'
const RECT = { left: 600, top: 80, right: 1180, bottom: 640 }
const afterThrottle = () => new Promise((r) => setTimeout(r, 200))

describe('ноутбук (useBoardRemote): поле assistant_open', () => {
  const mounted: Array<{ unmount: () => void }> = []
  afterEach(() => {
    while (mounted.length) mounted.pop()!.unmount()
    setFloatingObstacle(ASSISTANT_WINDOW_OBSTACLE, null)
  })

  function setup() {
    const store = reactive({ currentPageIndex: 1, pageCount: 3, goToPage: vi.fn(), addPage: vi.fn() })
    const sendMessage = vi.fn()
    mounted.push(mount(defineComponent({
      setup() {
        useBoardRemote({ sessionId: ref(SID), store, undo: vi.fn(), sendMessage, enabled: ref(true) })
        return () => h('div')
      },
    })))
    const fire = (cmd: string, args: Record<string, unknown> = {}) => window.dispatchEvent(new CustomEvent('wb:remote-command', {
      detail: { userId: 'u', pair: derivePair(SID), clientId: 'phone', cmd, args },
    }))
    const states = () => sendMessage.mock.calls.map((c) => c[0] as Record<string, unknown>).filter((m) => m.type === 'remote.state')
    return { fire, states }
  }

  it('вікно згорнуте — у стані assistant_open: false (поле є завжди, це новий ноутбук)', () => {
    const { fire, states } = setup()
    fire('hello')
    expect(states()[states().length - 1]).toMatchObject({ assistant_open: false })
  })

  it('вікно відкрилось — новий стан з true; згорнулось — з false', async () => {
    const { fire, states } = setup()
    fire('hello')
    setFloatingObstacle(ASSISTANT_WINDOW_OBSTACLE, RECT)
    await nextTick()
    await afterThrottle()
    expect(states()[states().length - 1]).toMatchObject({ assistant_open: true })
    setFloatingObstacle(ASSISTANT_WINDOW_OBSTACLE, null)
    await nextTick()
    await afterThrottle()
    expect(states()[states().length - 1]).toMatchObject({ assistant_open: false })
  })

  it('вікно вже відкрите, коли пульт привітався, — перший стан одразу з true', () => {
    setFloatingObstacle(ASSISTANT_WINDOW_OBSTACLE, RECT)
    const { fire, states } = setup()
    fire('hello')
    expect(states()[states().length - 1]).toMatchObject({ assistant_open: true })
  })

  it('перетягування відкритого вікна стану не шле — лише так/ні', async () => {
    const { fire, states } = setup()
    fire('hello')
    setFloatingObstacle(ASSISTANT_WINDOW_OBSTACLE, RECT)
    await nextTick()
    await afterThrottle()
    const sent = states().length
    setFloatingObstacle(ASSISTANT_WINDOW_OBSTACLE, { left: 10, top: 10, right: 590, bottom: 570 })
    await nextTick()
    await afterThrottle()
    expect(states().length).toBe(sent)
  })

  it('пульт не підключався — вікно відкрилось, а стану немає', async () => {
    const { states } = setup()
    setFloatingObstacle(ASSISTANT_WINDOW_OBSTACLE, RECT)
    await nextTick()
    await afterThrottle()
    expect(states()).toHaveLength(0)
  })

  it('інші плаваючі вікна не вважаються вікном Інтегралика', () => {
    setFloatingObstacle('some-other-window', RECT)
    try {
      expect(isAssistantWindowOpen()).toBe(false)
    } finally {
      setFloatingObstacle('some-other-window', null)
    }
  })
})

describe('телефон: розбір поля', () => {
  it('доходить лише справжній boolean, як на сервері', () => {
    expect(parseRemoteAssistantOpen(true)).toBe(true)
    expect(parseRemoteAssistantOpen(false)).toBe(false)
    for (const broken of ['true', 1, 0, null, undefined, {}, []]) {
      expect(parseRemoteAssistantOpen(broken)).toBeUndefined()
    }
  })
})

describe('вікно Інтегралика повідомляє під тим самим ключем, що читає пульт', () => {
  it('CommandPalette.vue кладе й прибирає свій прямокутник під ASSISTANT_WINDOW_OBSTACLE', () => {
    expect(paletteSource).toContain(`setFloatingObstacle('${ASSISTANT_WINDOW_OBSTACLE}', { left:`)
    expect(paletteSource).toContain(`setFloatingObstacle('${ASSISTANT_WINDOW_OBSTACLE}', null)`)
  })
})

describe('верстка пульта без кнопки', () => {
  it('«Говорю» одразу під полем Інтегралика: другий auto-відступ знято', () => {
    expect(remoteViewSource).toMatch(/\.wb-remote__ai \+ \.wb-remote__talk \{ margin-top: 0; \}/)
  })
})
