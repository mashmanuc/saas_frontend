/**
 * System Version Compatibility Guard (P0)
 * Frontend version constant — must match backend SYSTEM_VERSION
 * 
 * Гарантує інваріант: CODE_VERSION == DATA_VERSION
 * При невідповідності → fail fast
 */

// 🔒 P0: Глобальна версія системи (має співпадати з backend/core/version.py)
export const SYSTEM_VERSION = 1

/**
 * Fail-fast перевірка версії snapshot
 * @param snapshotVersion Версія з даних snapshot
 * @throws Error якщо версії не співпадають
 */
export function validateSnapshotVersion(snapshotVersion: number | undefined): void {
  if (snapshotVersion === undefined) {
    throw new Error(
      `[Snapshot] Missing version field. ` +
      `Required: ${SYSTEM_VERSION}, got: undefined. ` +
      `Data may be corrupted or from incompatible system version.`
    )
  }

  if (snapshotVersion !== SYSTEM_VERSION) {
    throw new Error(
      `[Snapshot] Version mismatch. ` +
      `Code: ${SYSTEM_VERSION}, Data: ${snapshotVersion}. ` +
      `Required: rollback to compatible version or data cleanup`
    )
  }
}

/**
 * Fail-fast перевірка версії ops
 * @param opVersion Версія з даних op
 * @throws Error якщо версії не співпадають
 */
export function validateOpVersion(opVersion: number | undefined): void {
  if (opVersion === undefined) {
    throw new Error(
      `[Op] Missing version field. ` +
      `Required: ${SYSTEM_VERSION}, got: undefined`
    )
  }

  if (opVersion !== SYSTEM_VERSION) {
    throw new Error(
      `[Op] Version mismatch. ` +
      `Code: ${SYSTEM_VERSION}, Data: ${opVersion}. ` +
      `Cannot apply incompatible operation`
    )
  }
}

/**
 * Додає версію до даних при відправці
 * @param data Об'єкт даних
 * @returns Об'єкт з доданим полем version
 */
export function addVersion<T extends object>(data: T): T & { version: number } {
  return {
    ...data,
    version: SYSTEM_VERSION
  }
}
