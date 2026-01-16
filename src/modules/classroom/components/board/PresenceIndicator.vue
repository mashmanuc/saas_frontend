<template>
  <div class="presence-indicator">
    <div v-if="activeUsers.length > 0" class="presence-list">
      <div class="presence-header">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="presence-icon"
        >
          <circle cx="8" cy="8" r="3" fill="currentColor" />
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" fill="none" />
        </svg>
        <span class="presence-count">{{ activeUsers.length }}</span>
      </div>
      
      <div class="presence-dropdown">
        <div
          v-for="user in activeUsers"
          :key="user.userId"
          class="presence-user"
        >
          <div class="user-avatar">
            {{ getUserInitials(user.userName) }}
          </div>
          <div class="user-info">
            <div class="user-name">
              {{ user.userName }}
              <span v-if="getUserRole(user.userId)" class="role-badge" :class="`role-badge--${getUserRole(user.userId)}`">
                {{ getRoleBadge(getUserRole(user.userId)) }}
              </span>
            </div>
            <div class="user-status">
              <span class="status-dot"></span>
              {{ $t('whiteboard.presence.active') }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="presence-empty">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="presence-icon offline"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PresenceUser } from '@/core/whiteboard/adapters/RealtimeAdapter'
import { useWhiteboardStore } from '@/modules/classroom/stores/whiteboardStore'

interface Props {
  users: PresenceUser[]
  participantsRoles?: Record<string, 'viewer' | 'editor' | 'moderator'>
}

const props = defineProps<Props>()
const whiteboardStore = useWhiteboardStore()

const activeUsers = computed(() => {
  return props.users.filter(u => u.isActive)
})

function getUserInitials(name: string): string {
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

function getUserRole(userId: string): 'viewer' | 'editor' | 'moderator' | null {
  return props.participantsRoles?.[userId] || null
}

function getRoleBadge(role: 'viewer' | 'editor' | 'moderator' | null): string {
  if (!role) return ''
  
  const badges: Record<string, string> = {
    'viewer': 'VIEW',
    'editor': 'EDIT',
    'moderator': 'MOD'
  }
  
  return badges[role] || ''
}
</script>

<style scoped>
.presence-indicator {
  position: relative;
  display: inline-block;
}

.presence-list {
  position: relative;
}

.presence-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.presence-header:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.presence-header:hover + .presence-dropdown {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.presence-icon {
  color: var(--color-success);
}

.presence-icon.offline {
  color: var(--color-text-secondary);
}

.presence-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.presence-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 240px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 8px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-8px);
  transition: all 0.2s;
  z-index: 1000;
}

.presence-dropdown:hover {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.presence-user {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.presence-user:hover {
  background: var(--color-surface-hover);
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.user-info {
  flex: 1;
}

.user-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.role-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.role-badge--viewer {
  background: #e3f2fd;
  color: #1976d2;
}

.role-badge--editor {
  background: #e8f5e9;
  color: #388e3c;
}

.role-badge--moderator {
  background: #f3e5f5;
  color: #7b1fa2;
}

.user-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success);
}

.presence-empty {
  padding: 6px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}
</style>
