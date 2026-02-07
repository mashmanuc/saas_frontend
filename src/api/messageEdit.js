/**
 * Phase 2: Message Edit/Delete/Clear API
 * v0.88.1
 */
import apiClient from './apiClient'

/**
 * Edit a message
 * @param {string} messageId - UUID of message to edit
 * @param {Object} payload - { body: string }
 * @returns {Promise<Object>} Updated message
 */
export async function editMessage(messageId, payload) {
  const response = await apiClient.patch(`/chat/messages/${messageId}/`, payload)
  return response.data
}

/**
 * Delete a message (soft delete)
 * @param {string} messageId - UUID of message to delete
 * @returns {Promise<Object>} Delete confirmation
 */
export async function deleteMessage(messageId) {
  const response = await apiClient.delete(`/chat/messages/${messageId}/delete/`)
  return response.data
}

/**
 * Clear chat history
 * @param {string} threadId - UUID of thread
 * @param {Object} options - { clear_mode: 'symmetric' | 'per_user' }
 * @returns {Promise<Object>} Clear confirmation
 */
export async function clearChatHistory(threadId, options = {}) {
  const response = await apiClient.delete(`/chat/threads/${threadId}/clear/`, {
    data: options
  })
  return response.data
}

export default {
  editMessage,
  deleteMessage,
  clearChatHistory
}
