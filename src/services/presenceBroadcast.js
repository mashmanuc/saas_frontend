/**
 * Presence cross-tab sync via BroadcastChannel + leader election.
 *
 * Architecture (per MANIFEST.md — Platform Expansion Law):
 * - Domain: Presence coordination across browser tabs
 * - Extensible: any store can listen for tab-sync messages
 * - Additive: leader election is opt-in, stores work without it
 *
 * Leader election:
 * - Each tab sends heartbeats every HEARTBEAT_MS
 * - If no leader heartbeat for LEADER_TIMEOUT_MS, lowest-id tab claims leadership
 * - Leader tab does HTTP polling; follower tabs receive status via BroadcastChannel
 * - On leader tab close, remaining tabs elect new leader
 */

const CHANNEL_NAME = 'presence_sync'
const HEARTBEAT_MS = 3000
const LEADER_TIMEOUT_MS = 8000

let channel = null
let tabId = null
let leaderId = null
let lastLeaderHeartbeat = 0
let heartbeatTimer = null
let electionTimer = null
let onStatusUpdate = null
let onLeaderChange = null
let disposed = false

function generateTabId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isSupported() {
  return typeof BroadcastChannel !== 'undefined'
}

function init(handlers = {}) {
  if (disposed) return
  if (!isSupported()) return

  onStatusUpdate = handlers.onStatusUpdate || null
  onLeaderChange = handlers.onLeaderChange || null

  tabId = generateTabId()
  channel = new BroadcastChannel(CHANNEL_NAME)

  channel.onmessage = (event) => {
    const msg = event.data
    if (!msg || !msg.type) return

    switch (msg.type) {
      case 'status_update':
        if (msg.tabId !== tabId && onStatusUpdate) {
          onStatusUpdate(msg.statuses)
        }
        break

      case 'leader_heartbeat':
        if (msg.tabId !== tabId) {
          leaderId = msg.tabId
          lastLeaderHeartbeat = Date.now()
          if (onLeaderChange) onLeaderChange(isLeader())
        }
        break

      case 'leader_claim':
        if (msg.tabId < tabId || (leaderId && msg.tabId <= leaderId)) {
          leaderId = msg.tabId
          lastLeaderHeartbeat = Date.now()
          if (onLeaderChange) onLeaderChange(isLeader())
        }
        break

      case 'tab_close':
        if (msg.tabId === leaderId) {
          leaderId = null
          lastLeaderHeartbeat = 0
          scheduleElection()
        }
        break
    }
  }

  // Claim leadership immediately (lowest tabId wins on conflict)
  claimLeadership()
  startHeartbeat()
  startElectionWatch()

  // Announce close on tab unload
  window.addEventListener('beforeunload', handleUnload)
}

function claimLeadership() {
  if (!channel || disposed) return
  leaderId = tabId
  lastLeaderHeartbeat = Date.now()
  channel.postMessage({ type: 'leader_claim', tabId })
  if (onLeaderChange) onLeaderChange(true)
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = setInterval(() => {
    if (disposed || !channel) return
    if (isLeader()) {
      channel.postMessage({ type: 'leader_heartbeat', tabId })
    }
  }, HEARTBEAT_MS)
}

function startElectionWatch() {
  if (electionTimer) clearInterval(electionTimer)
  electionTimer = setInterval(() => {
    if (disposed) return
    if (!leaderId || (Date.now() - lastLeaderHeartbeat > LEADER_TIMEOUT_MS)) {
      claimLeadership()
    }
  }, LEADER_TIMEOUT_MS / 2)
}

function scheduleElection() {
  // Small random delay to avoid thundering herd
  setTimeout(() => {
    if (disposed) return
    if (!leaderId || (Date.now() - lastLeaderHeartbeat > LEADER_TIMEOUT_MS)) {
      claimLeadership()
    }
  }, Math.random() * 500 + 100)
}

function isLeader() {
  return leaderId === tabId
}

function broadcastStatuses(statuses) {
  if (!channel || disposed) return
  channel.postMessage({
    type: 'status_update',
    tabId,
    statuses,
  })
}

function handleUnload() {
  if (!channel || disposed) return
  try {
    channel.postMessage({ type: 'tab_close', tabId })
  } catch {
    // ignore — tab is closing
  }
}

function dispose() {
  disposed = true
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  if (electionTimer) {
    clearInterval(electionTimer)
    electionTimer = null
  }
  window.removeEventListener('beforeunload', handleUnload)
  if (channel) {
    try {
      channel.postMessage({ type: 'tab_close', tabId })
      channel.close()
    } catch {
      // ignore
    }
    channel = null
  }
  leaderId = null
  tabId = null
  onStatusUpdate = null
  onLeaderChange = null
}

export const presenceBroadcast = {
  init,
  dispose,
  isLeader,
  isSupported,
  broadcastStatuses,
  getTabId: () => tabId,
  getLeaderId: () => leaderId,
}
