import { createApp } from 'vue'
import App from './App.vue'
import { vNumkey } from '@devslab/numkey/vue'

createApp(App).directive('numkey', vNumkey).mount('#app')
