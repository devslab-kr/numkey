# Contributing to numkey

Thanks for your interest! Issues and pull requests are welcome — bug reports,
locale quirks, docs fixes, and new ideas alike. 이슈·PR 환영합니다 (한국어로
쓰셔도 됩니다).

## Dev setup

```sh
git clone https://github.com/devslab-kr/numkey.git
cd numkey
npm install
npm test          # vitest (core + jsdom DOM/caret + Vue mount tests)
npm run typecheck
npm run build     # ESM/CJS + dist/numkey.global.js (CDN build)
```

The demo site is `site/index.html` — after `npm run build`, copy
`dist/numkey.global.js*` into `site/` and open it (the copies are
gitignored; the Pages workflow assembles fresh ones on deploy).

## Guidelines

- **Every behavior change needs a test.** Caret behavior is the heart of the
  library — for input-flow bugs, write the regression test the way a user
  types (char by char), not by assigning the whole value at once; that
  difference has caught real bugs here.
- The canonical value model is string-first on purpose (money-safe, never
  IEEE 754) — PRs that route values through `Number` will be asked to rework.
- Don't touch the input mid-IME-composition; anything running on `input`
  events must stay behind the composition guard.
- `react` is intentionally NOT a devDependency — React adapters share the
  tested `dom.ts` building blocks; Vue components are mount-tested.
- Keep docs bilingual where structure allows (README.md / README.ko.md).

## Releases

Maintainer-driven via a dispatch workflow — you don't need to touch
versions, tags, or the CHANGELOG header format in a feature PR; just add an
entry describing your change under the unreleased heading if one exists.
