<template>
  <ul class="tree">
    <TreeNode
      v-for="(val, key) in data"
      :key="key"
      :label="key"
      :value="val"
      :side="side"
      :path="compose(path, key)"
      :isRoot="true"
    />
  </ul>
</template>

<script setup>
import TreeNode from './TreeNode.vue'

const props = defineProps({
  side: { type: String, required: true },
  data: { type: Object, required: true },
  path: { type: String, default: '' }
})

function compose(parent, key){
  return parent ? `${parent}.${key}` : key
}
</script>
