<template>
  <li>
    <div
      class="node"
      :class="{ clickable: isLeaf, selected: isSelected }"
      :data-path="path"
      :data-side="side"
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
import { computed, inject, onMounted } from 'vue'

const props = defineProps({
  label: String,
  value: [String, Object],
  side: String,
  path: String,
  isRoot: { type: Boolean, default: true }
})

const store = inject('store')
const isLeaf = computed(() => typeof props.value === 'string')
const isSelected = computed(() => store.state.selectedNode === props.path)

onMounted(() => {
  // 디버그: DOM에 잘 붙었는지
  const el = document.querySelector(`[data-path="${props.path}"]`)
  console.log('[node] mounted:', { path: props.path, side: props.side, isLeaf: isLeaf.value, el })
})

function compose(path, key) {
  return path ? `${path}.${key}` : key
}

function onClick() {
  if (isLeaf.value) store.actions.selectNode(props.path)
}
</script>

<style scoped>
.node {
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: all .2s ease;
  user-select: none;
}

.node.clickable {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
}

.node.clickable:hover {
  background-color: #e9ecef;
  border-color: #dee2e6;
}

.node.selected {
  background-color: #007bff;
  color: #fff;
  border-color: #0056b3;
}

.key { font-weight: 600; margin-right: 8px; }
.type { color: #6c757d; font-size: .9em; font-style: italic; }

ul { list-style: none; padding-left: 20px; margin: 0; }
li { margin: 0; padding: 0; }
</style>
