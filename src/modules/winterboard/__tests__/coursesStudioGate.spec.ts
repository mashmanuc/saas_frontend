/**
 * Вкладка «Мої курси» прибрана з прода — стережемо саме це.
 *
 * ⚠️ Навіщо пакет. 2026-08-27 власник відкрив m4sh.org і побачив живу вкладку
 * «Мої курси» з написом «Курсів ще немає»: «курси на прод влізли, а вони не
 * робочі — треба прибрати». До того дня вкладки «Конструктор» і «Мої курси»
 * сиділи на ОДНОМУ прапорці `isLessonConstructorEnabled()`, тож прибрати
 * курси можна було лише разом із конструктором уроку, який працює.
 *
 * ⚠️ І окремо — урок про перевірку. Я стверджувала, що курси на проді
 * вимкнені, бо бачила `default: false` і `.env.local` у `.gitignore`.
 * Змінна виявилась виставленою в панелі Cloudflare Pages, звідки її в
 * репозиторії не видно. Тести нижче тому перевіряють ФОРМУ гейта (окрема
 * ручка існує і застосована в трьох місцях), а не «на проді вимкнено» —
 * останнього з репозиторію довести неможливо в принципі.
 */
import { describe, it, expect } from 'vitest'

async function readRepoFile(rel: string): Promise<string> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  // process.cwd() === frontend/ під час прогону vitest
  return fs.readFile(path.resolve(process.cwd(), '..', rel), 'utf-8')
}

const FLAGS = 'frontend/src/modules/winterboard/config/featureFlags.ts'
const VIEW  = 'frontend/src/modules/winterboard/views/WBBoardList.vue'

describe('окрема ручка для курсів', () => {
  it('🔴 `isCoursesStudioEnabled` існує і за замовчуванням false', async () => {
    const src = await readRepoFile(FLAGS)
    const i = src.indexOf('export function isCoursesStudioEnabled')
    expect(i).toBeGreaterThan(0)
    // Тіло функції до наступного `export` або кінця файлу.
    const rest = src.slice(i)
    const body = rest.slice(0, rest.indexOf('\n}') + 2)
    expect(body).toContain('return false')
    expect(body).toContain('VITE_COURSES_STUDIO_ENABLED')
  })

  it('🔴 ручка НЕ та сама, що в конструктора уроку', async () => {
    // Якщо хтось «спростить», повернувши курси на lessonConstructorEnabled,
    // конструктор знову стане заручником курсів — саме той дефект, що ловимо.
    const src = await readRepoFile(FLAGS)
    expect(src).toContain("const LS_KEY_COURSES = 'courses_studio_enabled'")
    expect(src).toContain("const LS_KEY_LC = 'lc_enabled'")
  })
})

describe('гейт застосовано в усіх трьох місцях', () => {
  it('кнопка вкладки під `coursesStudioEnabled`', async () => {
    const src = await readRepoFile(VIEW)
    const i = src.indexOf("lessonConstructor.courses.listTitle")
    expect(i).toBeGreaterThan(0)
    // Умова кнопки стоїть вище за її підпис.
    const block = src.slice(Math.max(0, i - 400), i)
    expect(block).toContain('lessonConstructorEnabled && coursesStudioEnabled')
  })

  it('панель курсів під `coursesStudioEnabled`', async () => {
    const src = await readRepoFile(VIEW)
    const i = src.indexOf('<CoursesStudioPanel')
    expect(i).toBeGreaterThan(0)
    const block = src.slice(i, i + 300)
    expect(block).toContain('coursesStudioEnabled')
  })

  it('🔴 застарілий localStorage не лишає тьютора на порожній вкладці', async () => {
    // Хто стояв на «Мої курси» до вимкнення, має повернутись у бібліотеку,
    // інакше побачить сторінку без жодної активної вкладки.
    const src = await readRepoFile(VIEW)
    const i = src.indexOf('function _loadStudioMode')
    expect(i).toBeGreaterThan(0)
    const body = src.slice(i, i + 900)
    expect(body).toContain("saved === 'courses' && !isCoursesStudioEnabled()")
    // Перевірка мусить стояти ПЕРЕД загальним поверненням збереженого режиму.
    expect(body.indexOf("!isCoursesStudioEnabled()"))
      .toBeLessThan(body.indexOf("saved === 'library' ||"))
  })
})

describe('конструктор уроку НЕ зачеплено', () => {
  it('🔴 вкладка «Конструктор» лишається на своєму прапорці', async () => {
    // Власник просив прибрати курси, а не конструктор. Якщо цей тест падає —
    // прибрали зайве.
    const src = await readRepoFile(VIEW)
    const i = src.indexOf("winterboard.boards.modeConstructor")
    expect(i).toBeGreaterThan(0)
    // Рівно ЦЕЙ <button>, а не вікно фіксованої довжини: перша редакція тесту
    // брала 600 символів назад і зачіпала сусідній елемент — падала на
    // справному коді.
    const btn = src.slice(src.lastIndexOf('<button', i), i)
    expect(btn).toContain('v-if="lessonConstructorEnabled"')
    expect(btn).not.toContain('coursesStudioEnabled')
  })

  it('сторінка конструктора монтується без ручки курсів', async () => {
    const src = await readRepoFile(VIEW)
    const i = src.indexOf('<LessonConstructorPage')
    expect(i).toBeGreaterThan(0)
    // Обрізаємо рівно по кінцю тега — нижче одразу стоїть <CoursesStudioPanel>,
    // і фіксоване вікно затягувало його `coursesStudioEnabled` сюди.
    const tag = src.slice(i, src.indexOf('/>', i) + 2)
    expect(tag).toContain('lessonConstructorEnabled')
    expect(tag).not.toContain('coursesStudioEnabled')
  })
})
