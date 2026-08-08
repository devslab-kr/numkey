# Backlog — considered, not committed

Ideas that came up for numkey, with the reasoning. The
[Roadmap](../README.md#roadmap) holds only what shipped; this file holds
everything else, so the same discussion doesn't get re-run and so
contributors can see what's wanted before opening a PR.

numkey를 두고 검토한 항목과 그 근거입니다. README 로드맵에는 출시된 것만
두고, 나머지는 여기 적어 같은 논의를 반복하지 않도록 합니다.

**Last reviewed: 2026-08-09.** Signal at that point: **0 issues** ever
opened, ~12 npm downloads/week. Nothing below was requested by a user.
/ 이슈 0건, 주간 다운로드 12. 아래는 전부 사용자 요청이 아닙니다.

## In-field prefix / suffix — the one real feature gap

Showing the unit inside the input (`₩ 1,234,567`, `1,234 원`, `12 %`).
numkey has **no** prefix/suffix support at all, while AutoNumeric and
react-number-format both do — it is the clearest gap against the
alternatives, and Korean business forms ask for it.
필드 안에 단위를 함께 표시하는 기능. 경쟁 라이브러리는 다 갖고 있고
한국 업무 폼에서 흔한 요구인데 numkey에는 전혀 없습니다.

What it would take:

- The **read side already works** — `parse('₩ 1,234,567원')` → `'1234567'`,
  since parse drops everything that isn't a digit, sign or decimal mark.
- The cost is **display + caret math**. The caret is the most delicate part
  of this library (`countSignificant` / `caretIndex` count *significant
  characters*), and affixes are non-significant characters that must never
  be deletable, selectable-through, or counted. Backspace at the boundary
  and select-all-then-type both need deciding.
- Harder than the lakh grouping work, which needed no caret changes at all.

Not scheduled: demand-gated. One real request and it moves to the roadmap.

## Korean reading of negative amounts — unspecified

`toKorean('-9876543')` currently returns `"-987만 6,543"`. The reading is
meant to be human-readable text, so leaving the sign as a bare glyph is
half-and-half; Korean would more often be read "마이너스 987만 6,543".
Banking UIs differ, so this is a **product decision, not a bug** — but it
is currently neither decided nor documented, and there is no test pinning
it. Whichever way it goes, write it down and cover it.
음수 병기 표기가 미정입니다. 지금은 `-987만 6,543`. "마이너스"가 맞는지는
제품 판단이며, 정하고 문서화 + 테스트로 고정해야 합니다.

## Deliberately NOT doing

- **Indian lakh grouping** — shipped in v0.6, no longer a backlog item.
- **Sharing a core package with [kokey](https://github.com/devslab-kr/kokey)** —
  the two are siblings in the "-key" family but deliberately share no
  runtime code; only build infra and conventions were copied. Extract an
  input-core only if a third input library creates real three-way
  duplication. / 공용 런타임 패키지는 세 번째 입력 라이브러리가 생겨
  실제 3중 중복이 날 때만.

## The rule we're applying

With zero issues and low download numbers, more features will not move
anything — discovery is the bottleneck, not capability. Wait for a real
request, then build. An idea sitting in this file is not a promise.
이슈 0건·낮은 다운로드 상황에서 기능을 더 얹어도 지표는 안 움직입니다.
실제 요청이 오면 그때 만듭니다. 여기 적힌 항목은 약속이 아닙니다.
