<template>
  <div class="solo-workspace-v2">
    <!-- Header -->
    <header class="solo-workspace-v2__header">
      <h1>Solo Workspace V2 (NEW) 🎨</h1>
      <p>This is the NEW Solo v2 board with Arrow, Circle, PDF Import, and Background Picker!</p>
      <button class="btn btn-primary" @click="handleExit">Exit</button>
    </header>

    <!-- Main content: Toolbar + Canvas -->
    <div class="solo-workspace-v2__main">
      <!-- Solo Toolbar V2 -->
      <SoloToolbar
        :current-tool="currentTool"
        :current-color="currentColor"
        :current-size="currentSize"
        :preset-colors="presetColors"
        :preset-sizes="presetSizes"
        @tool-change="handleToolChange"
        @color-change="handleColorChange"
        @size-change="handleSizeChange"
      />

      <!-- Canvas placeholder -->
      <div class="solo-workspace-v2__canvas">
        <p>Canvas Area - Solo V2</p>
        <p>Current Tool: {{ currentTool }}</p>
        <p>Current Color: <span :style="{ color: currentColor }">{{ currentColor }}</span></p>
        <p>Current Size: {{ currentSize }}</p>
      </div>
    </div>

    <!-- Footer -->
    <footer class="solo-workspace-v2__footer">
      <p>Solo V2 - New Features: Arrow Tool, Circle Tool, PDF Import, Background Picker</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Tool } from '../types/solo'
import SoloToolbar from '../components/toolbar/SoloToolbar.vue'

const router = useRouter()

// Tool state
const currentTool = ref<Tool>('pen')
const currentColor = ref('#000000')
const currentSize = ref(2)

// Preset values for toolbar
const presetColors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF']
const presetSizes = [1, 2, 4, 8, 16]

// Handlers
function handleToolChange(tool: Tool): void {
  currentTool.value = tool
  console.log('[SoloWorkspaceV2] Tool changed:', tool)
}

function handleColorChange(color: string): void {
  currentColor.value = color
  console.log('[SoloWorkspaceV2] Color changed:', color)
}

function handleSizeChange(size: number): void {
  currentSize.value = size
  console.log('[SoloWorkspaceV2] Size changed:', size)
}

function handleExit(): void {
  router.push('/solo')
}
</script>

<style scoped>
.solo-workspace-v2 {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.solo-workspace-v2__header {
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  text-align: center;
}

.solo-workspace-v2__header h1 {
  margin: 0 0 10px 0;
  font-size: 32px;
}

.solo-workspace-v2__header p {
  margin: 10px 0;
  font-size: 16px;
}

.solo-workspace-v2__main {
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 20px;
  gap: 20px;
}

.solo-workspace-v2__canvas {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 40px;
  color: #333;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.solo-workspace-v2__canvas p {
  margin: 10px 0;
}

.solo-workspace-v2__footer {
  padding: 15px;
  background: rgba(0, 0, 0, 0.3);
  text-align: center;
  font-size: 14px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-primary:hover {
  background: #45a049;
}
</style>
