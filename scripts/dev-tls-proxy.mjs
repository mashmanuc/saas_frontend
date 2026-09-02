/**
 * Локальний TLS-проксі для Paddle E2E (PHASE2_PADDLE_E2E_RUNBOOK).
 *
 * Навіщо: Paddle примусово генерує https-посилання
 * (`https://localhost:5173/billing/pay?_ptxn=`), а `server.https` у Vite
 * на Node 22.21.0 падає на першому WebSocket-upgrade (HMR) —
 * регресія nodejs/node#60336, у 22.x не бекпортована.
 *
 * Що робить: слухає https на LISTEN_PORT і байт-у-байт перекидає
 * розшифрований потік у звичайний http-Vite на TARGET_PORT. HTTP-парсер
 * Node не задіяний узагалі (`tls` + `net`), тому WebSocket/HMR проходять
 * наскрізь як звичайні байти.
 *
 * Запуск:  node scripts/dev-tls-proxy.mjs [targetPort=5180] [listenPort=5173]
 * Сертифікат: .certs/localhost-key.pem + .certs/localhost.pem (gitignored),
 *   openssl-команда в рунбуку.
 */
import tls from 'node:tls'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const targetPort = Number(process.argv[2] || 5180)
const listenPort = Number(process.argv[3] || 5173)
const certDir = path.resolve(__dirname, '..', '.certs')
const keyPath = path.join(certDir, 'localhost-key.pem')
const certPath = path.join(certDir, 'localhost.pem')

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error(`[tls-proxy] нема ${keyPath} / ${certPath} — див. PHASE2_PADDLE_E2E_RUNBOOK`)
  process.exit(1)
}

const server = tls.createServer(
  { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
  (client) => {
    // 'localhost', не '127.0.0.1': Vite за замовчуванням біндиться на ::1,
    // а Node ≥20 з hostname пробує обидві сім'ї адрес (happy eyeballs).
    const upstream = net.connect({ port: targetPort, host: 'localhost' })
    const fail = (side) => (err) => {
      // ECONNRESET при закритті вкладки — норма; решту показуємо.
      if (err.code !== 'ECONNRESET') console.error(`[tls-proxy] ${side}:`, err.message)
      client.destroy()
      upstream.destroy()
    }
    client.on('error', fail('client'))
    upstream.on('error', fail('upstream'))
    client.pipe(upstream).pipe(client)
  },
)

server.on('tlsClientError', (err) => {
  // Браузер, що ще не прийняв самопідписаний сертифікат — очікувано, без стеку.
  if (!/ssl|tls/i.test(err.message)) console.error('[tls-proxy] tls:', err.message)
})

// Без host → dual-stack (:: і 0.0.0.0): браузер може піти на localhost як ::1.
server.listen(listenPort, () => {
  console.log(`[tls-proxy] https://localhost:${listenPort} -> http://localhost:${targetPort}`)
})
