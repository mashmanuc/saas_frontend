/**
 * «Прибрати зайві» (TZ_MIRROR_SNAPSHOTS_GROUPING_2026-10-11 §1, §2.4):
 * спершу лише підрахунок; прибрати — одна дія; чесно, коли прибрати нічого;
 * облік не зібрався — нічого не прибираємо. Плюс дерево тек: 🧹 лише в системних.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../../../i18n/locales/uk.json'
import MirrorTidyDialog from '../MirrorTidyDialog.vue'
import LibraryFolderTree from '../LibraryFolderTree.vue'
import type { MirrorCleanupResult, LibraryFolderTree as FolderTree } from '../../../types/library'

vi.mock('../../../api/library', () => ({ mirrorCleanup: vi.fn() }))
import { mirrorCleanup } from '../../../api/library'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
const M = (uk as unknown as { winterboard: { library: { mirror: Record<string, string> } } }).winterboard.library.mirror
const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(p[k]))

const MB = 1024 * 1024
function res(over: Partial<MirrorCleanupResult> = {}): MirrorCleanupResult {
  return {
    total: 5, total_bytes: 5 * MB, free: [1, 2], free_bytes: 2 * MB, used: [
      { id: 3, where: 'replay', holders: [{ kind: 'replay', id: 'r1', title: 'Урок 9-А' }] },
      { id: 4, where: 'replay', holders: [{ kind: 'replay', id: 'r1', title: 'Урок 9-А' }] },
      { id: 5, where: 'board', holders: [{ kind: 'board', id: 'b1', title: 'Алгебра' }] },
    ],
    usage_unknown: false, dry_run: true, archived: 0, ...over,
  }
}

function dialog() {
  return mount(MirrorTidyDialog, {
    props: { folderId: 42, folderName: 'Алгебра · 11.10 18:05' },
    global: { plugins: [i18n()], stubs: { teleport: true } },
  })
}

describe('MirrorTidyDialog', () => {
  beforeEach(() => { vi.mocked(mirrorCleanup).mockReset() })

  it('спершу лише рахує (dry-run): скільки всього, скільки зайвих, хто тримає решту', async () => {
    vi.mocked(mirrorCleanup).mockResolvedValueOnce(res())
    const w = dialog()
    await flushPromises()
    expect(vi.mocked(mirrorCleanup).mock.calls).toEqual([[42, true]])
    expect(w.find('[data-testid="mirror-tidy-summary"]').text()).toBe(fill(M.total, { n: 5, size: '5,0 МБ' }))
    expect(w.find('[data-testid="mirror-tidy-free"]').text()).toBe(fill(M.free, { n: 2, size: '2,0 МБ' }))
    expect(w.find('[data-testid="mirror-tidy-used"]').text()).toBe(fill(M.used, { n: 3 }))
    expect(w.find('[data-testid="mirror-tidy-replays"]').text()).toBe(fill(M.inReplays, { titles: '«Урок 9-А»' }))
    expect(w.text()).toContain(fill(M.onBoards, { titles: '«Алгебра»' }))
    expect(w.find('[data-testid="mirror-tidy-run"]').text()).toBe(fill(M.run, { n: 2 }))
  })

  it('«Прибрати» — справжній запуск, «Готово», батько оновлює список', async () => {
    vi.mocked(mirrorCleanup).mockResolvedValueOnce(res()).mockResolvedValueOnce(res({ dry_run: false, archived: 2 }))
    const w = dialog()
    await flushPromises()
    await w.find('[data-testid="mirror-tidy-run"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(mirrorCleanup).mock.calls[1]).toEqual([42, false])
    expect(w.find('[data-testid="mirror-tidy-done"]').text()).toBe(fill(M.done, { n: 2 }))
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('урок записано — «0 МБ можна прибрати», кнопки немає, підказка як звільнити місце', async () => {
    vi.mocked(mirrorCleanup).mockResolvedValueOnce(res({ free: [], free_bytes: 0 }))
    const w = dialog()
    await flushPromises()
    expect(w.find('[data-testid="mirror-tidy-free"]').text()).toBe(fill(M.free, { n: 0, size: '0 МБ' }))
    expect(w.find('[data-testid="mirror-tidy-run"]').exists()).toBe(false)
    expect(w.find('[data-testid="mirror-tidy-howto"]').text()).toBe(M.howToFree)
  })

  it('облік не зібрався — пояснення й нічого прибрати', async () => {
    vi.mocked(mirrorCleanup).mockResolvedValueOnce(res({ usage_unknown: true, free: [], free_bytes: 0 }))
    const w = dialog()
    await flushPromises()
    expect(w.find('[data-testid="mirror-tidy-unknown"]').text()).toBe(M.unknown)
    expect(w.find('[data-testid="mirror-tidy-run"]').exists()).toBe(false)
  })

  it('мережа впала — причина словами й «Ще раз» (лише руками)', async () => {
    vi.mocked(mirrorCleanup).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(res())
    const w = dialog()
    await flushPromises()
    expect(w.find('[data-testid="mirror-tidy-error"]').text()).toBe(M.failed)
    expect(mirrorCleanup).toHaveBeenCalledTimes(1)
    await w.findAll('button').find((b) => b.text() === M.again)!.trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="mirror-tidy-run"]').exists()).toBe(true)
  })
})

describe('LibraryFolderTree: системні теки «Дзеркала»', () => {
  const folders: FolderTree[] = [
    { id: 1, name: '🪞 Дзеркало', parent: null, system_kind: 'mirror_root', assets_count: 0, children: [
      { id: 2, name: 'Алгебра · 11.10 18:05', parent: 1, system_kind: 'mirror_run', assets_count: 3, children: [] },
    ] },
    { id: 3, name: 'Мої', parent: null, system_kind: '', assets_count: 1, children: [] },
  ]
  const tree = () => mount(LibraryFolderTree, {
    props: { folders, selectedId: null, editable: true },
    global: { plugins: [i18n()] },
  })

  it('у системних — 🧹 «Прибрати зайві» замість «+»; у звичайних — як було', async () => {
    const w = tree()
    expect(w.find('[data-testid="folder-tidy-1"]').exists()).toBe(true)
    expect(w.find('[data-testid="folder-tidy-2"]').exists()).toBe(true)
    expect(w.find('[data-testid="folder-tidy-3"]').exists()).toBe(false)
    const plus = w.findAll('.wb-folder-tree__action-btn').filter((b) => b.text() === '+')
    expect(plus).toHaveLength(1)

    await w.find('[data-testid="folder-tidy-2"]').trigger('click')
    expect(w.emitted('tidy')).toEqual([[2, 'Алгебра · 11.10 18:05']])
    expect(w.emitted('select')).toBeUndefined()
  })
})
