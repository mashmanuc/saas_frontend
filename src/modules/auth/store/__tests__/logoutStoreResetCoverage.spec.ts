// Охорона Б-35: кожен стор, який forceLogout скидає, мусить скидатися ПОВНІСТЮ.
//
// forceLogout кличе $reset() у всіх створених сторах, крім STORES_KEPT_ON_LOGOUT.
// Pinia дає $reset лише options-сторам. Setup-стору без власного $reset вона
// поза продом підставляє функцію, що кидає, а в проді — noop: дані попереднього
// користувача лишаються, і ніхто цього не бачить. Тому тут, а не в проді:
//  - тест сам знаходить усі defineStore у src/ — новий стор потрапляє сюди без
//    правки тесту;
//  - кожне поле стану псується, після $reset() стан мусить збігтися з
//    початковим (забуте в $reset поле → назва стора й поля в падінні);
//  - у стані скидуваного стора не може лежати дескриптор (таймер, підписка,
//    слухач, сокет): $reset занулив би посилання, а ресурс лишився б висіти.
//    Такий стор — або сам звільняє ресурс у $reset, або в STORES_KEPT_ON_LOGOUT.
//
// Чого тест НЕ бачить — перевіряти очима в кожному новому $reset:
//  - ref, які setup-стор не повертає: у $state їх немає (так жив deletedSlotIds
//    у calendarWeekStore — слот попереднього вчителя лишався схованим);
//  - змінні замикань і модуля — таймери, відписки, кеші, in-flight проміси:
//    $reset мусить звільнити їх сам (як negotiationChat — setActiveThread(null)).

import { describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { isRef, toRaw } from 'vue'
import fs from 'node:fs'
import path from 'node:path'

vi.mock('../../../../utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))

import { STORES_KEPT_ON_LOGOUT } from '../authStore'

const SRC = path.resolve(__dirname, '../../../..')
// Назви, якими в цьому коді звуть дескриптори: sendLockTimer, statusUnsubscribe,
// subscriptionCleanup, _systemListener, _mediaQuery, subscription. Лише закінчення
// назви: ключ-дані на кшталт subscriptionPlan чи timerEnabled сюди не потрапляє.
const HANDLE_KEY = /(timer|interval|unsubscribe|cleanup|listener|socket|mediaquery)$|^_?subscriptions?$/i

function storeModules(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') storeModules(full, out)
    } else if (/\.(js|ts)$/.test(entry.name) && !/\.(spec|test)\.|\.d\.ts$/.test(entry.name)) {
      if (fs.readFileSync(full, 'utf8').includes('defineStore(')) out.push(full)
    }
  }
  return out
}

type StoreHook = (() => Record<string, any>) & { $id: string }

async function allStoreHooks(): Promise<Array<{ id: string; file: string; useStore: StoreHook }>> {
  const found = new Map<StoreHook, { id: string; file: string; useStore: StoreHook }>()
  for (const file of storeModules(SRC)) {
    const mod = await import(/* @vite-ignore */ file)
    for (const value of Object.values(mod)) {
      if (typeof value === 'function' && typeof (value as StoreHook).$id === 'string') {
        const useStore = value as StoreHook
        found.set(useStore, { id: useStore.$id, file: path.relative(SRC, file), useStore })
      }
    }
  }
  return [...found.values()]
}

// Знімок стану без реактивних обгорток: Map/Set/масиви/об'єкти — вглиб.
// ref розгортаємо на кожному рівні: сирий $state setup-стора тримає самі ref,
// і без цього «до» й «після» були б тим самим ref — порівняння завжди рівне
// (так і було в першій редакції тесту: мутація «$reset забув поле» вижила).
function snapshot(value: unknown): unknown {
  const raw = toRaw(isRef(value) ? value.value : value)
  if (raw instanceof Date) return { __date: raw.getTime() }
  if (raw instanceof Map) return { __map: [...raw].map(([k, v]) => [k, snapshot(v)]) }
  if (raw instanceof Set) return { __set: [...raw].map(snapshot) }
  if (Array.isArray(raw)) return raw.map(snapshot)
  if (raw && typeof raw === 'object' && Object.getPrototypeOf(raw) === Object.prototype) {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, snapshot(v)]))
  }
  return raw
}

// «Дані попереднього користувача» того самого типу: $reset може чистити поле
// на місці (Map.clear(), Set.clear()), тож підміна іншим типом зламала б його
// не з вини стора. Лише нові значення — спільні константи модуля не чіпаємо.
function dirtied(value: unknown, key: string): unknown {
  const raw = toRaw(value)
  if (raw instanceof Date) return new Date(raw.getTime() + YEAR_MS)
  if (raw instanceof Map) return new Map([...raw, ['__dirty', key]])
  if (raw instanceof Set) return new Set([...raw, '__dirty'])
  if (Array.isArray(raw)) return [...raw, { __dirty: key }]
  if (raw && typeof raw === 'object' && Object.getPrototypeOf(raw) === Object.prototype) {
    return { ...raw, __dirty: key }
  }
  if (typeof raw === 'string') return `${raw}__dirty`
  if (typeof raw === 'number') return raw + 12345
  if (typeof raw === 'boolean') return !raw
  if (raw === null || raw === undefined) return { __dirty: key }
  return raw // екземпляр класу: загально не зіпсувати
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

// Порівняння знімків. Дату $reset ставить заново (selectedDate = new Date()) —
// мілісекунди інші, тож допуск хвилина; зіпсована дата відстає на рік.
function same(a: unknown, b: unknown): boolean {
  const isDate = (x: unknown): x is { __date: number } =>
    !!x && typeof x === 'object' && typeof (x as { __date?: unknown }).__date === 'number'
  if (isDate(a) && isDate(b)) return Math.abs(a.__date - b.__date) < 60_000
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]))
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a)
    return ka.length === Object.keys(b).length
      && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return Object.is(a, b)
}

const hooks = await allStoreHooks()
const resettable = hooks.filter(({ id }) => !STORES_KEPT_ON_LOGOUT.has(id))

describe('logout: кожен скидуваний стор скидається повністю (Б-35)', () => {
  it('знайдено всі стори src/ (захист від порожнього пошуку)', () => {
    expect(hooks.length).toBeGreaterThanOrEqual(60)
  })

  it('кожен id у STORES_KEPT_ON_LOGOUT — справжній стор (без застарілих записів)', () => {
    const ids = new Set(hooks.map(({ id }) => id))
    expect([...STORES_KEPT_ON_LOGOUT].filter((id) => !ids.has(id))).toEqual([])
  })

  it.each(resettable.map((h) => [`${h.id} (${h.file})`, h] as const))(
    '%s: $reset() повертає кожне поле до початкового',
    (_label, { useStore }) => {
      setActivePinia(createPinia())
      const store = useStore()
      const initial = snapshot(store.$state) as Record<string, unknown>
      const keys = Object.keys(initial)
      // Псуємо від ПОЧАТКОВОГО значення, не від поточного: два ключі на один ref
      // (notifications: loading → isLoading) інакше перемкнули б булеве двічі й
      // поле лишилось би «чистим» — так і пропустила перша редакція тесту.
      const initialValues = Object.fromEntries(keys.map((key) => [key, (store.$state as Record<string, unknown>)[key]]))

      store.$patch((state: Record<string, unknown>) => {
        for (const key of keys) state[key] = dirtied(initialValues[key], key)
      })
      store.$reset()

      const after = snapshot(store.$state) as Record<string, unknown>
      const notReset = keys.filter((key) => !same(after[key], initial[key]))
      expect(notReset).toEqual([])
    },
  )

  it.each(resettable.map((h) => [`${h.id} (${h.file})`, h] as const))(
    '%s: у стані немає дескрипторів ресурсів',
    (_label, { useStore }) => {
      setActivePinia(createPinia())
      const store = useStore()
      expect(Object.keys(store.$state).filter((key) => HANDLE_KEY.test(key))).toEqual([])
    },
  )
})
