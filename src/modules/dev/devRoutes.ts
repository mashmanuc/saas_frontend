/**
 * DEV-only маршрути лабораторій.
 *
 * Функція від прапорця, а не умова всередині роутера: так тест перевіряє, що в
 * production-конфігурації (`isDev = false`) маршруту НЕ ІСНУЄ, а не лише «сховано меню».
 * Роутер кличе `devOnlyRoutes(import.meta.env.DEV)`; у production-збірці Vite підставляє
 * `false`, і гілка разом із lazy-імпортом сторінки відрізається.
 *
 * ⚠️ Це не feature-flag продукту (пастка `import.meta.env.DEV || VITE_*` із debts/FROZEN.md
 * стосується функцій для користувача). Лабораторія користувачеві не призначена взагалі.
 */
import type { RouteRecordRaw } from 'vue-router'

/** V-D3 · локальна перевірка капсули накладання трикутників (ТЗ V-D3 §4.4). */
export const DEV_VISUAL_CAPSULE_TRIANGLES_PATH = '/dev/visual-capsules/triangles-overlay'

export function devOnlyRoutes(isDev: boolean): RouteRecordRaw[] {
  if (isDev !== true) return []
  return [
    {
      path: DEV_VISUAL_CAPSULE_TRIANGLES_PATH,
      name: 'dev-visual-capsule-triangles-overlay',
      component: () => import('./views/DevVisualCapsuleTrianglesOverlay.vue'),
      // Без логіна й без БД: лабораторія не читає й не пише нічого на сервері.
      meta: { requiresAuth: false, devOnly: true },
    },
  ]
}
