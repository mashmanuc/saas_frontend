/**
 * Диктант 2.0, дрібниці після рев'ю (власник 25.10: «дороби»): телефон каже, ЧОМУ дія з реченням не вдалася
 * (маніфест П5 «не тиша»), а кнопки речення говорять мовою інтерфейсу.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RemoteSentenceControls from '../components/remote/RemoteSentenceControls.vue'
import { parseSentenceResult, sentenceRefusal, type SentenceRequest } from '../remote/dictationLineContract'

const RID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
const state = () => ({ page_id: 'p', object_id: 's', source_revision: 'a'.repeat(64),
  words: [{ id: 'w0', text: 'Мама', hidden: false }], punct: false })

describe('причина відмови — закритий набір, як на сервері', () => {
  it('done — без причини; refused — лише з причиною з набору', () => {
    expect(parseSentenceResult({ request_id: RID, status: 'done' })).toEqual({ request_id: RID, status: 'done' })
    expect(parseSentenceResult({ request_id: RID, status: 'refused', reason: 'stale' })?.reason).toBe('stale')
    for (const bad of [
      { request_id: RID, status: 'refused' }, { request_id: RID, status: 'refused', reason: 'boom' },
      { request_id: RID, status: 'done', reason: 'stale' }, { request_id: 'x', status: 'done' },
    ]) expect(parseSentenceResult(bad), JSON.stringify(bad)).toBeNull()
  })

  it('причини ноутбука зводяться до трьох зрозумілих', () => {
    expect(sentenceRefusal('blocked')).toBe('blocked')
    expect(['stale_target', 'stale_source', 'unknown_word'].map(sentenceRefusal)).toEqual(['stale', 'stale', 'stale'])
    expect(['invalid_action', 'invalid_data', 'щось інше'].map(sentenceRefusal)).toEqual(['invalid', 'invalid', 'invalid'])
  })
})

describe('телефон показує причину', () => {
  it('відмова «речення змінилося» — так і пише, що робити', async () => {
    const send = vi.fn((_r: SentenceRequest) => true)
    const w = mount(RemoteSentenceControls, { props: { sentence: state(), result: null, ready: true, send } })
    await w.get('[data-testid="sentence-restore"]').trigger('click')
    const request = send.mock.calls[0][0]
    await w.setProps({ result: { request_id: request.request_id, status: 'refused', reason: 'stale' } })
    expect(w.text()).toContain('речення на дошці змінилося або зникло')
    w.unmount()
  })
})
