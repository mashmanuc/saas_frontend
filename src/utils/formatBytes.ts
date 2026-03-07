/**
 * Format bytes into human-readable string.
 * Examples: 1024 → "1.0 KB", 1048576 → "1.0 MB", 2147483648 → "2.0 GB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(decimals)} ${sizes[i]}`
}
