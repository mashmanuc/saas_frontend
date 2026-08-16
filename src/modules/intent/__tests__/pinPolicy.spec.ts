/**
 * PIN-політика: рішення людини старше за автоматику.
 *
 * Скарга власника (2026-08-17): «Нахера Інтегралику кнопка відкріпити — вона
 * ніхера ж не робить». Кнопка працювала, але авто-закріплення спрацьовувало на
 * КОЖНІЙ дії на дошці й на кожному відкритті панелі, тож ефект відкріплення
 * жив до наступної команди. Ці тести стережуть саме це: чи переживає ручний
 * вибір наступні дії.
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { createPinPolicy } from '../pinPolicy'

describe('pinPolicy — автоматика не перебиває людину', () => {
  it('перше малювання закріплює панель', () => {
    const p = createPinPolicy(() => true)
    expect(p.isPinned.value).toBe(false)
    p.autoPinOnce()
    expect(p.isPinned.value).toBe(true)
  })

  it('друге і третє малювання нічого не міняють (авто-pin один раз)', () => {
    const p = createPinPolicy(() => true)
    p.autoPinOnce()
    p.togglePin()                 // людина відкріпила
    expect(p.isPinned.value).toBe(false)
    p.autoPinOnce()               // ← дія на дошці; раніше тут закріплювало знову
    p.autoPinOnce()
    expect(p.isPinned.value).toBe(false)
  })

  it('ручне відкріплення переживає відкриття панелі', () => {
    // openPalette() теж кличе autoPinOnce — і теж не має скасовувати вибір.
    const p = createPinPolicy(() => true)
    p.autoPinOnce()
    p.togglePin()
    p.autoPinOnce()               // «відкрили панель наново»
    expect(p.isPinned.value).toBe(false)
  })

  it('закріпив вручну → автоматика знову дозволена', () => {
    const p = createPinPolicy(() => true)
    p.togglePin()                 // вручну закріпив
    expect(p.isPinned.value).toBe(true)
    expect(p.userUnpinned.value).toBe(false)
    p.togglePin()                 // вручну відкріпив
    expect(p.userUnpinned.value).toBe(true)
  })

  it('новий діалог (↺) скидає звичку — авто-pin знову спрацює', () => {
    const p = createPinPolicy(() => true)
    p.autoPinOnce()
    p.togglePin()
    p.resetHabit()
    p.autoPinOnce()
    expect(p.isPinned.value).toBe(true)
  })

  it('де pin неможливий — автоматика мовчить і кнопка нічого не «залипає»', () => {
    // Немає дошки або вузький екран: canPin=false.
    const can = ref(false)
    const p = createPinPolicy(() => can.value)
    p.autoPinOnce()
    expect(p.isPinned.value).toBe(false)
    expect(p.autoPinnedOnce.value).toBe(false)   // спроба не «згоріла»
    // Відкрили дошку — тепер має спрацювати.
    can.value = true
    p.autoPinOnce()
    expect(p.isPinned.value).toBe(true)
  })

  it('пішов із дошки — панель перестає бути закріпленою (без залиплого стану)', () => {
    const can = ref(true)
    const p = createPinPolicy(() => can.value)
    p.autoPinOnce()
    expect(p.isPinned.value).toBe(true)
    can.value = false             // перейшли у «Матеріали»
    expect(p.isPinned.value).toBe(false)   // клік повз панель знову закриває
    can.value = true              // повернулись на дошку
    expect(p.isPinned.value).toBe(true)    // побажання збережене
  })
})
