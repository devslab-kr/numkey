import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve(import.meta.dirname, '..')
const read = (file) => readFile(resolve(root, file), 'utf8')
const hash = async (file) => createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')

const assets = {
  'docs/assets/brand/project-mark.svg': 'db727c53441d059a57d3de4b1201a3681b71b57b9e1854d32881617caa57d236',
  'docs/assets/brand/project-lockup.svg': '513474611e05d422c63b15d0de3561435fc6b23b135ba1f7831c75bd7e634b5a',
  'docs/assets/brand/readme-header.png': '7abcef4d8a4a2d58cba15cec977d86a46ff96970700b9cce2ca47f67814ee76f',
  'site/favicon.svg': 'db727c53441d059a57d3de4b1201a3681b71b57b9e1854d32881617caa57d236',
  'site/favicon.ico': '22bbfcdf8fd518251f5d8ecc8aa8b4398a4e795d2eb3b087af5221f90c0f6b7b',
  'site/apple-touch-icon.png': '262bdf7d2028fd50c95876ff1ffebe83c44ac75b8476f7ab399e106adf56e6e4',
  'site/og.png': '96fb0eebc5da137e1a99bc3f58ef6f568f13eede79778f0e0a1b56ab143a304b',
  'site/project-mark-color.svg': 'db727c53441d059a57d3de4b1201a3681b71b57b9e1854d32881617caa57d236',
  'site/project-mark-reversed.svg': '0d68b20d404b13618b97170d700f07d60e78a072db6e9553df964b7b0a85593f',
}

for (const [file, expected] of Object.entries(assets)) {
  assert.equal(await hash(file), expected, `${file} must be the approved O04 asset`)
}

const checksumFile = 'docs/assets/brand/checksums.txt'
assert.equal(await hash(checksumFile), 'f26faff6340a3a572dbcc1e78a787d7494caa1927df5d42a4ae0c5e60dc79fa1', 'vendored O04 checksums.txt must remain exact')
const checksums = await read(checksumFile)
for (const [asset, expected] of Object.entries({
  'glyph-color.svg': 'db727c53441d059a57d3de4b1201a3681b71b57b9e1854d32881617caa57d236',
  'lockup-endorsed.svg': '513474611e05d422c63b15d0de3561435fc6b23b135ba1f7831c75bd7e634b5a',
  'readme-header.png': '7abcef4d8a4a2d58cba15cec977d86a46ff96970700b9cce2ca47f67814ee76f',
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
