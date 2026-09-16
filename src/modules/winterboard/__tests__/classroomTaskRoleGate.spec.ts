/**
 * T-03: роль із кімнати мусить дійти до обох шляхів рендера nmt_task.
 *
 * Сервер правильно відхиляв student asset_update, але картка вже встигала
 * оптимістично відкрити ключ і розбір. Найбезпечніша межа — не давати учню
 * tutor-only контрол узагалі. Цей тест стереже весь prop-chain, а не лише
 * локальну умову всередині картки.
 */
import { describe, expect, it } from 'vitest'

async function readRepoFile(rel: string): Promise<string> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  return fs.readFile(path.resolve(process.cwd(), rel), 'utf-8')
}

/**
 * Відкривальні теги компонента `name` (точна назва: `WBCanvasLoader` ≠ `WBCanvas`).
 *
 * TLV2-03S: той самий рядок `:is-tutor=…` у файлі стоїть і на інших компонентах, тож
 * пошук по всьому файлу не помічав, коли його прибирали саме з потрібного тега.
 */
function openingTags(src: string, name: string): string[] {
  const tags: string[] = []
  const re = new RegExp(`<${name}(?=[\\s/>])`, 'g')
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const rest = src.slice(m.index)
    const end = rest.search(/\n\s*\/?>/)
    tags.push(end === -1 ? rest : rest.slice(0, end))
  }
  return tags
}

describe('classroom nmt_task role gate', () => {
  it('кімната передає фактичну роль саме у WBCanvas', async () => {
    const src = await readRepoFile('src/modules/winterboard/views/WBClassroomRoom.vue')
    const canvases = openingTags(src, 'WBCanvas')
    expect(canvases).toHaveLength(1)
    expect(canvases[0]).toContain(':is-tutor="classroomRole.isTeacher.value"')
  })

  it('уніфікований і legacy renderer задачі отримують tutor gate', async () => {
    const src = await readRepoFile('src/modules/winterboard/components/canvas/WBCanvas.vue')
    const layers = openingTags(src, 'WBOverlayLayer')
    expect(layers).toHaveLength(1)
    expect(layers[0]).toContain(':is-tutor="props.isTutor !== false"')
    const legacyTasks = openingTags(src, 'NmtTaskRenderer')
    expect(legacyTasks).toHaveLength(1)
    expect(legacyTasks[0]).toContain(':is-tutor="props.isTutor !== false"')

    const registry = await readRepoFile(
      'src/modules/winterboard/components/canvas/overlayRegistry.ts',
    )
    expect(registry).toContain('isTutor: ctx.isTutor')
  })
})
