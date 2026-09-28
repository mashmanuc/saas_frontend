// «Зберегти як новий шаблон» (ТЗ TZ_SAVE_FROM_LIVE_LESSON_AS_TEMPLATE; власник 2026-09-28; LAW §9 v1.18).
// Кімнати тести не монтують (завеликі), тож тут — контракт на вихідний текст WBSoloRoom:
// де кнопка, кому вона є, як під'єднано діалог, блок дошки й пульта, бар'єр без «лог і далі».
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const room = readFileSync(resolve(__dirname, '../views/WBSoloRoom.vue'), 'utf-8').replace(/\r\n/g, '\n')
const between = (from: string, to: string) => {
  const a = room.indexOf(from)
  const b = room.indexOf(to, a)
  expect(a, from).toBeGreaterThan(-1)
  expect(b, to).toBeGreaterThan(a)
  return room.slice(a, b)
}

describe('WBSoloRoom · кнопка «Зберегти як новий шаблон»', () => {
  it('у шапці — одразу після «Зберегти як урок», перед «⛶»; з видимим підписом і тим самим значком', () => {
    const iSave = room.indexOf('wb-header-btn--save-lesson')
    const iCopy = room.indexOf('data-testid="save-as-new-template"')
    const iFull = room.indexOf('wb-header-btn--fullscreen')
    expect(iSave).toBeGreaterThan(-1)
    expect(iCopy).toBeGreaterThan(iSave)
    expect(iFull).toBeGreaterThan(iCopy)
    const btn = between('v-if="canSaveAsNewTemplate && !isSidebarDrawer"', '</button>')
    expect(btn).toContain("t('winterboard.lesson.copy.button')")
    expect(btn).toContain('class="wb-header-btn__label"')
    expect(btn).toContain(':disabled="savingTemplate"')
  })

  it('≤768 px (шапка прокручується вбік) — кнопка в приліпленому блоці біля «Вийти», не за краєм (ТЗ §4 п. 6)', () => {
    // Поріг кнопки = поріг, на якому шапка стає прокручуваною, а `.wb-header-auth` — sticky.
    expect(room).toContain("const SIDEBAR_DRAWER_QUERY = '(max-width: 768px)'")
    const iSticky = room.search(/\n {2}\.wb-header-auth \{\s*position: sticky;\s*right: 0;/)
    expect(iSticky).toBeGreaterThan(-1)
    const mediaBefore = [...room.slice(0, iSticky).matchAll(/^@media[^\n]*\{/gm)].pop()?.[0]
    expect(mediaBefore).toBe('@media (max-width: 768px) {')
    const iAuth = room.indexOf('<div class="wb-header-auth">')
    const iNarrow = room.indexOf('v-if="canSaveAsNewTemplate && isSidebarDrawer"')
    expect(iAuth).toBeGreaterThan(-1)
    expect(iNarrow).toBeGreaterThan(iAuth)
    expect(room.indexOf('</header>', iAuth)).toBeGreaterThan(iNarrow)
    const narrow = between('v-if="canSaveAsNewTemplate && isSidebarDrawer"', '</button>')
    expect(narrow).toContain('data-testid="save-as-new-template"')
    expect(narrow).toContain(':disabled="savingTemplate"')
    expect(narrow).toContain('@click="openSaveCopyDialog"')
    expect(narrow).toContain(":aria-label=\"t('winterboard.lesson.copy.button')\"")
    // у DOM завжди одна: інших входів кнопки, крім цих двох, немає
    expect(room.split('data-testid="save-as-new-template"').length - 1).toBe(2)
  })

  it('лише власнику, лише в уроці з шаблону; не в Студії й не в локальній дошці', () => {
    const def = between('const canSaveAsNewTemplate = computed(() =>', '\n\n')
    for (const cond of ['!!sessionId.value', 'isSessionOwner.value', '!!sourceLessonId.value', '!constructorMode.value', '!isLocalWorkspace']) {
      expect(def).toContain(cond)
    }
    // двох однакових кнопок немає: «Зберегти як урок» — лише БЕЗ шаблону
    expect(room).toContain('v-if="sessionId && isSessionOwner && !sourceLessonId && !constructorMode"')
  })

  it('діалог копії: той самий компонент і API, момент знімка — beforeSave/afterSave', () => {
    const dlg = between('mode="copy"', '/>')
    expect(dlg).toContain(':before-save="beginTemplateSave"')
    expect(dlg).toContain(':after-save="endTemplateSave"')
    expect(dlg).toContain('@saved="handleCopySaved"')
    expect(room).toContain('savedItemKind.value = \'copy\'')
  })

  it('на «Зберегти шаблон» спершу блок дошки й пульта, потім бар’єр; після — блок знято', () => {
    const begin = between('async function beginTemplateSave()', '\n}\n')
    expect(begin.indexOf('savingTemplate.value = true')).toBeGreaterThan(-1)
    expect(begin.indexOf('savingTemplate.value = true')).toBeLessThan(begin.indexOf('await artifactBarrier()'))
    expect(between('function endTemplateSave()', '\n}\n')).toContain('savingTemplate.value = false')
    // вмикає блок лише ця дія — не запис і не інші артефакти (INV-23 v3: запис дошку не блокує)
    expect(room.match(/savingTemplate\.value = true/g)).toHaveLength(1)
  })

  it('поки зберігається: ноутбук не малює (як inputLocked), пульт бачить busy', () => {
    expect(room).toContain("(opsSync.inputLocked || savingTemplate.value ? 'select' : store.currentTool)")
    expect(room).toContain("busy: () => (savingTemplate.value ? 'saving_template' : null),")
  })
})

describe('WBSoloRoom · бар’єр артефакту без «лог і далі»', () => {
  it('ensureBoardSavedForArtifact — через artifactBarrier; виняток flushAll — відмова', () => {
    const ensure = between('async function ensureBoardSavedForArtifact()', '\n}\n')
    expect(ensure).toContain('await artifactBarrier()')
    const barrier = between('async function artifactBarrier()', '\n}\n')
    expect(barrier).toMatch(/catch \(e\) \{\s*flushFailed = true/)
    expect(barrier).toContain('mode: opsSync.mode')
    // черга — і та, що чекає, і та, що вже в дорозі (ТЗ §4 п. 3: понад 50 ops)
    expect(barrier).toContain('pendingCount: opsSync.pendingOps.length + opsSync.inFlightOps.length')
    expect(barrier).toContain('artifactBarrierReason(')
  })
})
