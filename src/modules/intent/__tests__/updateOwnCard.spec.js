/**
 * E2 (2026-08-28): Інтегралик виправляє ВЛАСНУ останню картку.
 *
 * Живий випадок власника: «прибери з умови своєї задачі саму відповідь».
 * Це прохання ВИПРАВИТИ наявний об'єкт, а дій редагування картки не існувало
 * взагалі — лише `add_*`. Модель зробила найближче можливе: дописала на дошку
 * новий текст, лишивши стару картку з відповіддю на місці. Звіт «✓ Пишу на
 * дошці…» був буквально правдивий і читався як виконання прохання.
 *
 * Найважливіший тест тут — НЕ той, що правка працює, а той, що при відсутній
 * цілі дія ПАДАЄ з людським текстом. `store.updateAsset` при ненайденому id
 * просто виходить (`if (idx === -1) return`) — тиха невдача була б гіршою за
 * початковий дефект: тьютор почув би «виправив» і побачив стару картку.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateAsset = vi.fn()
let assets = []

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    currentPage: { id: 'p1', width: 1920, height: 1080, get assets() { return assets } },
    addAsset: (asset) => { assets.push(asset) },
    updateAsset,
  }),
}))

vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))

import { runBoardAction } from '../boardActions'

const CARD = { title: 'Подібна задача', body: 'Умова', badge: 'Задача' }

describe('E2 — виправлення власної картки', () => {
  beforeEach(() => {
    updateAsset.mockReset()
    assets = []
  })

  it('міняє тіло, зберігаючи решту полів', async () => {
    await runBoardAction({ kind: 'add_card', payload: CARD })
    await runBoardAction({ kind: 'update_card', payload: { body: 'Умова без відповіді' } })

    expect(updateAsset).toHaveBeenCalledTimes(1)
    const [patched] = updateAsset.mock.calls[0]
    expect(patched.data.body).toBe('Умова без відповіді')
    expect(patched.data.title).toBe('Подібна задача')
    expect(patched.data.badge).toBe('Задача')
    expect(patched.id).toBe(assets[0].id)
  })

  it('править САМЕ останню свою картку, а не першу', async () => {
    await runBoardAction({ kind: 'add_card', payload: { ...CARD, title: 'Перша' } })
    await runBoardAction({ kind: 'add_card', payload: { ...CARD, title: 'Друга' } })
    await runBoardAction({ kind: 'update_card', payload: { title: 'Виправлена' } })

    const [patched] = updateAsset.mock.calls[0]
    expect(patched.id).toBe(assets[1].id)
  })

  it('⚠️ без своєї картки — ПАДАЄ з людським текстом, а не мовчить', async () => {
    // Пам'ять про власну картку живе на рівні МОДУЛЯ і навмисно переживає
    // окремі команди — саме тому «своя остання» лишається своєю через
    // кілька реплік поспіль. Тож «жодної картки ще не було» відтворюється
    // лише свіжим імпортом; без цього тест мовчки перевіряв би сусідню гілку.
    vi.resetModules()
    const { runBoardAction: fresh } = await import('../boardActions')

    await expect(fresh({ kind: 'update_card', payload: { body: 'щось' } }))
      .rejects.toThrow(/не створював тут картки/)
    expect(updateAsset).not.toHaveBeenCalled()
  })

  it('⚠️ картку видалили — теж падає, а не тихо нічого не робить', async () => {
    await runBoardAction({ kind: 'add_card', payload: CARD })
    assets = []   // тьютор видалив картку або перейшов на іншу сторінку

    await expect(runBoardAction({ kind: 'update_card', payload: { body: 'щось' } }))
      .rejects.toThrow(/не бачу/)
    expect(updateAsset).not.toHaveBeenCalled()
  })

  it('порожні поля нічого не затирають', async () => {
    await runBoardAction({ kind: 'add_card', payload: CARD })
    await runBoardAction({ kind: 'update_card', payload: { title: '', body: 'Новий' } })

    const [patched] = updateAsset.mock.calls[0]
    expect(patched.data.title).toBe('Подібна задача')
    expect(patched.data.body).toBe('Новий')
  })
})
