import { createSignal } from 'solid-js'
// `numkey` is used by the use:numkey directive below — Solid compiles
// `use:x` to a reference to `x`, so the import must stay even though it
// never appears as a value.
import { numkey, useNumkey } from '@devslab/numkey/solid'
import { toKorean } from '@devslab/numkey'

const styles = `
body { font-family: system-ui, sans-serif; max-width: 560px; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
label { display: block; margin: 1.1rem 0 0.25rem; font-size: 0.9rem; color: #555; }
input { display: block; font-size: 1.1rem; padding: 0.4rem 0.6rem; width: 15rem; margin-top: 0.25rem; }
code { background: #f4f4f4; padding: 0.1rem 0.3rem; border-radius: 3px; }
`

export default function App() {
  const [amount, setAmount] = createSignal('1500000') // CANONICAL value

  return (
    <main>
      <style>{styles}</style>
      <h1>numkey · Solid</h1>

      <label>
        <code>use:numkey</code> with <code>onValue</code> — canonical value
        <input
          value="1500000"
          use:numkey={{ negative: true, onValue: setAmount }}
        />
      </label>
      <p>
        signal: <code>"{amount()}"</code>
        {amount() && <> · reading: <b>{toKorean(amount())} 원</b></>}
      </p>

      <label>
        <code>useNumkey</code> ref factory — 2 decimals
        <input ref={useNumkey({ decimals: 2 })} value="1234567.89" />
      </label>

      <label>
        Indian lakh grouping · <code>group: [3, 2]</code>
        <input use:numkey={{ group: [3, 2] }} value="12345678" />
      </label>
    </main>
  )
}
