/**
 * Зір Інтегралика (власник 2026-10-07: «роби всі три кроки»): адреса виділеної картинки йде на BE, де зір
 * читає, що на ній. Лише виділена й лише https — blob:/data: модель забрати не може.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { buildBoardSummary } from '../boardActions'

const SRC = 'https://images.m4sh.org/wb/task.png'
const pic = (id: string, src: string) => ({ id, type: 'image', x: 0, y: 0, w: 600, h: 400, src, data: {} })

function board(assets: any[], selectedIds: string[]) {
  const store = useWBStore()
  store.pages = [{ id: 'p1', name: 'p1', strokes: [], assets }] as any
  store.currentPageIndex = 0
  store.selectedIds = selectedIds
  store.expandedAssetId = null
}

const item = async (id: string) => (await buildBoardSummary()).items.find((i: any) => i.id === id)

beforeEach(() => setActivePinia(createPinia()))

describe('адреса виділеної картинки', () => {
  it('виділена https-картинка — з адресою', async () => {
    board([pic('a', SRC), pic('b', 'https://images.m4sh.org/wb/other.png')], ['a'])
    expect((await item('a')).image_url).toBe(SRC)
    expect((await item('b')).image_url).toBeUndefined()
  })

  it('без виділення — без адреси', async () => {
    board([pic('a', SRC)], [])
    expect((await item('a')).image_url).toBeUndefined()
  })

  it('blob: і data: — без адреси', async () => {
    for (const src of ['blob:http://x/1', 'data:image/png;base64,AAAA', 'http://images.m4sh.org/a.png']) {
      board([pic('a', src)], ['a'])
      expect((await item('a')).image_url, src).toBeUndefined()
    }
  })
})
