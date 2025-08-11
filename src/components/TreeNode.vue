<template>
  <li>
    <div 
      class="node" 
      :class="{ clickable: isLeaf, selected: isSelected, dragging: isDragging }"
      :data-path="path"
      :data-side="side"
      draggable="true"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @drop="onDrop"
      @click="onClick"
    >
      <span class="key">{{ label }}</span>
      <span class="type" v-if="isLeaf">{{ value }}</span>
    </div>
    <ul v-if="!isLeaf">
      <TreeNode
        v-for="(v, k) in value"
        :key="k"
        :label="k"
        :value="v"
        :side="side"
        :path="compose(path, k)"
        :isRoot="false"
      />
    </ul>
  </li>
</template>

<script setup>
import { ref, computed, inject } from 'vue'

const props = defineProps({
  label: String,
  value: [String, Object],
  side: String,
  path: String,
  isRoot: {
    type: Boolean,
    default: true
  }
})

const store = inject('store')

const isSelected = computed(() => store.state.selectedNode === props.path)
const isDragging = ref(false)
const isLeaf = computed(() => typeof props.value === 'string')

function compose(path, key) {
  return path ? `${path}.${key}` : key
}

function onDragStart(e) {
  if (!isLeaf.value) return
  
  isDragging.value = true
  store.actions.setPendingSource(props.path)
  e.dataTransfer.setData('text/plain', props.path)
}

function onDragEnd() {
  isDragging.value = false
}

function onDragOver(e) {
  if (props.side === 'dst' && isLeaf.value) {
    e.preventDefault()
  }
}

function onDrop(e) {
  if (props.side !== 'dst' || !isLeaf.value) return
  
  e.preventDefault()
  const sourcePath = e.dataTransfer.getData('text/plain')
  
  if (sourcePath && props.side === 'dst') {
    store.actions.completeToTarget(props.path)
  }
}

function onClick() {
  if (isLeaf.value) {
    store.actions.selectNode(props.path)
  }
}
</script>
