<script setup>
import { ref } from 'vue'
import { NumkeyInput } from '@devslab/numkey/vue'
import { toKorean } from '@devslab/numkey'

const amount = ref('1500000') // always the CANONICAL value
const price = ref('')
</script>

<template>
  <main>
    <h1>numkey · Vue 3</h1>

    <label>
      <code>&lt;NumkeyInput v-model&gt;</code> — the model stays canonical
      <NumkeyInput v-model="amount" negative />
    </label>
    <p>
      model: <code>"{{ amount }}"</code>
      <span v-if="amount"> · reading: <b>{{ toKorean(amount) }} 원</b></span>
    </p>

    <label>
      2 decimals
      <NumkeyInput v-model="price" :decimals="2" placeholder="1234.56" />
    </label>

    <label>
      <code>v-numkey</code> directive on a plain input
      <input v-numkey="2" placeholder="1234.56">
    </label>
  </main>
</template>

<style>
body { font-family: system-ui, sans-serif; max-width: 560px; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
label { display: block; margin: 1.1rem 0 0.25rem; font-size: 0.9rem; color: #555; }
input { display: block; font-size: 1.1rem; padding: 0.4rem 0.6rem; width: 15rem; margin-top: 0.25rem; }
code { background: #f4f4f4; padding: 0.1rem 0.3rem; border-radius: 3px; }
</style>
