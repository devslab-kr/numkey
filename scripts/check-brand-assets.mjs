import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve(import.meta.dirname, '..')
const read = (file) => readFile(resolve(root, file), 'utf8')
const hash = async (file) => createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')
const normalizedTextHash = async (file) => createHash('sha256')
  .update((await read(file)).replace(/\r\n/g, '\n'))
  .digest('hex')

const assets = {
  'docs/assets/brand/project-mark.svg': 'c37aff9f978c72c9ee2b87ef48da4fef3ce93b8f52e6ad50356270a29d27f876',
  'docs/assets/brand/project-lockup.svg': '4484a6e4758a977c61069a6e9801a98312f4f9659039c733f6c6c2d22b78acc0',
  'docs/assets/brand/readme-header.png': '0866d21631c3670c8d0175f12041ad2c0efb7f05b81574a8de416fffdcb9ca4e',
  'site/favicon.svg': 'c37aff9f978c72c9ee2b87ef48da4fef3ce93b8f52e6ad50356270a29d27f876',
  'site/favicon.ico': '2e2f07ad236cb667d55c2217e906fdaefde1a7733cad0409f7c865257f1790f5',
  'site/apple-touch-icon.png': '56d46296c69749fe7cf18c72ff16411534eebe3fee84369b4033c80449140f30',
  'site/og.png': '6b6acc88be7d462a090680e39762a5fcf6af7b93e1e9ea223352894e51f6f1ed',
  'site/project-mark-color.svg': 'c37aff9f978c72c9ee2b87ef48da4fef3ce93b8f52e6ad50356270a29d27f876',
  'site/project-mark-reversed.svg': '66ccdf0c912e78bacabeaffdb941e08babb31a22e9841428e01f30e4093fea99',
}

for (const [file, expected] of Object.entries(assets)) {
  assert.equal(await hash(file), expected, `${file} must be the approved O04 asset`)
}

const checksumFile = 'docs/assets/brand/checksums.txt'
assert.equal(await normalizedTextHash(checksumFile), 'b8cab1b4a7565c9753652e3330e980b0fa97f76b13c01f0944acd78c3996e24a', 'vendored O04 checksums.txt must remain exact across line-ending policies')
const checksums = await read(checksumFile)
for (const [asset, expected] of Object.entries({
  'glyph-color.svg': 'c37aff9f978c72c9ee2b87ef48da4fef3ce93b8f52e6ad50356270a29d27f876',
  'lockup-endorsed.svg': '4484a6e4758a977c61069a6e9801a98312f4f9659039c733f6c6c2d22b78acc0',
  'readme-header.png': '0866d21631c3670c8d0175f12041ad2c0efb7f05b81574a8de416fffdcb9ca4e',
})) {
  assert.match(checksums, new RegExp(`${expected}  ${asset}`), `checksums.txt must declare ${asset}`)
}

const preview = 'https://raw.githubusercontent.com/devslab-kr/numkey/main/docs/preview.png'
assert.equal(await hash('docs/preview.png'), 'c26e0695abc6122c508d1af04173ad95c864b8c82965b827b210f4e5a7b67715', 'docs/preview.png must be preserved byte-for-byte')
for (const [file, endorsement] of [
  ['README.md', /Open source by \[DevsLab\]\(https:\/\/devslab\.kr\/brand\/open-source\/\)/],
  ['README.ko.md', /\[DevsLab 오픈소스\]\(https:\/\/devslab\.kr\/brand\/open-source\/\)/],
]) {
  const content = await read(file)
  assert.match(content, endorsement, `${file} needs its localized DevsLab endorsement`)
  assert.match(content, /docs\/assets\/brand\/readme-header\.png/, `${file} needs the O04 README header`)
  assert.match(content, new RegExp(preview.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${file} must retain the preview reference`)
}

const site = await read('site/index.html')
assert.match(site, /srcset="project-mark-reversed\.svg"/, 'dark mode must use the explicit O04 reversed mark')
assert.match(site, /src="project-mark-color\.svg"/, 'light mode must use the explicit O04 color mark')
assert.doesNotMatch(site, /src="project-lockup\.svg"/, 'site must not render an unstyleable currentColor lockup through img')
assert.match(site, /rel="canonical" href="https:\/\/devslab-kr\.github\.io\/numkey\/"/, 'site needs a canonical URL')
assert.match(site, /property="og:title" content="numkey/, 'site needs an Open Graph title')
assert.match(site, /property="og:image" content="https:\/\/devslab-kr\.github\.io\/numkey\/og\.png"/, 'site needs the O04 Open Graph image')
assert.match(site, /name="twitter:card" content="summary_large_image"/, 'site needs a Twitter card')
assert.match(site, /name="twitter:image:alt" content="numkey - a stable caret across grouped numeric units"/, 'site needs Twitter image alt text')
const lightGlow = site.indexOf('rgb(6 182 212 / .11)')
const darkGlow = site.lastIndexOf('@media (prefers-color-scheme: dark)')
assert.ok(darkGlow > lightGlow, 'dark atmosphere override must follow the light glow in source order')
assert.match(site.slice(darkGlow), /rgb\(6 182 212 \/ \.10\)/, 'dark atmosphere must cap cyan opacity at .10')

const pkg = JSON.parse(await read('package.json'))
assert.equal(pkg.scripts.verify, 'npm run check:brand && npm run typecheck && npm run test && npm run build', 'routine verification must include the brand check')
assert.equal(pkg.scripts.prepublishOnly, 'npm run verify', 'publishing must use routine verification')
for (const workflow of ['.github/workflows/ci.yml', '.github/workflows/publish.yml']) {
  assert.match(await read(workflow), /npm run verify/, `${workflow} must use the routine verification gate`)
}

console.log(`Verified ${Object.keys(assets).length} approved O04 assets and numkey brand surfaces.`)
