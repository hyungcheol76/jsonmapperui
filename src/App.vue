<template>
  <div class="layout">
    <div class="pane">
      <h2>소스 JSON</h2>
      <JsonTree side="src" :data="source" path="" />
    </div>
    
    <div class="center-panel">
      <MappingPanel />
    </div>

    <MappingLayer />
    
    <div class="pane">
      <h2>타겟 JSON</h2>
      <JsonTree side="dst" :data="target" path="" />
    </div>
  </div>
  <div class="footer">
    <button class="ghost" @click="actions.clearMappings">모든 매핑 삭제</button>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import JsonTree from './components/JsonTree.vue'
import MappingLayer from './components/MappingLayer.vue'
import MappingPanel from './components/MappingPanel.vue'

const store = inject('store')

const source = {
  employee: {
    age: 'string',
    city: 'string',
    name: 'string',
  }
}

const target = {
  user: {
    info: {
      age: 'string',
      cityaddress: 'string',
    },
    name: 'string'
  }
}
</script>
