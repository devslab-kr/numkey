import { useState } from 'react'
import { NumkeyInput, useNumkey } from '@devslab/numkey/react'
import { toKorean } from '@devslab/numkey'

const styles = `
body { font-family: system-ui, sans-serif; max-width: 560px; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
label { display: block; margin: 1.1rem 0 0.25rem; font-size: 0.9rem; color: #555; }
input { display: block; font-size: 1.1rem; padding: 0.4rem 0.6rem; width: 15rem; margin-top: 0.25rem; }
code { background: #f4f4f4; padding: 0.1rem 0.3rem; border-radius: 3px; }
`

export default function App() {
  const [amount, setAmount] = useState('1500000') // always the CANONICAL value

  return (
    <main>
      <style>{styles}</style>
      <h1>numkey · React</h1>

      <label>
        <code>&lt;NumkeyInput /&gt;</code> controlled — state stays canonical
        <NumkeyInput value={amount} onValueChange={setAmount} negative />
      </label>
      <p>
        state: <code>"{amount}"</code>
        {amount && <> · reading: <b>{toKorean(amount)} 원</b></>}
      </p>

      <label>
        <code>useNumkey</code> ref hook — uncontrolled
        <input ref={useNumkey({ decimals: 2 })} defaultValue="1234567.89" />
      </label>
    </main>
  )
}
