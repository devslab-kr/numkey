<script>
  import { numkey } from '@devslab/numkey/svelte'
  import { toKorean } from '@devslab/numkey'

  // onValue gives the CANONICAL value ("1500000"); bind:value gives the
  // DISPLAY value ("1,500,000") — the action re-syncs the binding after
  // formatting, so both stay accurate.
  let amount = $state('1500000')
  let display = $state('')
</script>

<main>
  <h1>numkey · Svelte</h1>

  <label>
    <code>use:numkey</code> with <code>onValue</code> — canonical value
    <input
      value="1500000"
      use:numkey={{ negative: true, onValue: (v) => (amount = v) }}
    />
  </label>
  <p>
    canonical: <code>"{amount}"</code>
    {#if amount}· reading: <b>{toKorean(amount)} 원</b>{/if}
  </p>

  <label>
    <code>bind:value</code> — display value, re-synced after formatting
    <input use:numkey={2} bind:value={display} placeholder="1234.56" />
  </label>
  <p>bound: <code>"{display}"</code></p>

  <label>
    Indian lakh grouping · <code>group: [3, 2]</code>
    <input use:numkey={{ group: [3, 2] }} value="12345678" />
  </label>
</main>

<style>
  :global(body) { font-family: system-ui, sans-serif; max-width: 560px; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
  label { display: block; margin: 1.1rem 0 0.25rem; font-size: 0.9rem; color: #555; }
  input { display: block; font-size: 1.1rem; padding: 0.4rem 0.6rem; width: 15rem; margin-top: 0.25rem; }
  code { background: #f4f4f4; padding: 0.1rem 0.3rem; border-radius: 3px; }
</style>
