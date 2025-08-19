<template>
  <div v-if="!hasData" class="empty-state">
    <p class="empty-message">{{ emptyMessage }}</p>
  </div>
  <ul v-else class="tree">
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
import { computed, shallowRef } from 'vue'
import TreeNode from './TreeNode.vue'

const props = defineProps({
  side: { type: String, required: true },
  data: { type: Object, required: true },
  path: { type: String, default: '' }
})

// 성능 최적화: 깊은 반응성 대신 얕은 반응성 사용
const hasData = computed(() => {
  return Object.keys(props.data).length > 0
})

const emptyMessage = computed(() => {
  return props.side === 'src' ? '소스 스키마 파일을 선택해주세요' : '타겟 스키마 파일을 선택해주세요'
})

// 성능 최적화: 메모이제이션된 compose 함수 (캐시 크기 제한)
const composeCache = new Map()
function compose(parent, key){
  const cacheKey = `${parent}:${key}`
  if (composeCache.has(cacheKey)) {
    return composeCache.get(cacheKey)
  }
  const result = parent ? `${parent}.${key}` : key
  // 캐시 크기 제한 (메모리 누수 방지)
  if (composeCache.size > 1000) {
    const firstKey = composeCache.keys().next().value
    composeCache.delete(firstKey)
  }
  composeCache.set(cacheKey, result)
  return result
}
</script>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
}

.empty-message {
  font-size: 14px;
  text-align: center;
  color: #999;
  font-style: italic;
}
</style>
