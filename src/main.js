import { createApp, reactive, provide, h } from 'vue'
import App from './App.vue'
import './styles.css'

export const createStore = () => {
  const state = reactive({
    pendingSource: null,
    mappings: [],
  })

  const actions = {
    beginFromSource(path) { state.pendingSource = { path } },

    completeToTarget(targetPath) {
      if (!state.pendingSource) return
      const sourcePath = state.pendingSource.path
      const exists = state.mappings.some(m => m.sourcePath === sourcePath && m.targetPath === targetPath)
      if (!exists) {
        state.mappings.push({ id: `${sourcePath}__${targetPath}`, sourcePath, targetPath })
      }
      state.pendingSource = null
    },

    removeMapping(id) {
      state.mappings = state.mappings.filter(m => m.id !== id)
    }
  }

  return { state, actions }
}

const app = createApp({
  setup() {
    const store = createStore()
    provide('store', store)
    return () => h(App)
  }
})

app.mount('#app')
