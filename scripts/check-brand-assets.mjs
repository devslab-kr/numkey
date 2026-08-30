import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve(import.meta.dirname, '..')
const read = (file) => readFile(resolve(root, file), 'utf8')
const hash = async (file) => createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')

const assets = {
  'docs/assets/brand/project-mark.svg': '4ec733f9542323f6d2840ba743c4a11df4d416a7efa1d214567d62b58653619b',
  'docs/assets/brand/project-lockup.svg': '905cf0a05ab5d3787bc02ff7d4591bfa020d72aefdd0e0d0c53271da6d3f383c',
  'docs/assets/brand/readme-header.png': '481391d02b1f50ed6dba1790c0899bcc7d16948421bba66778756a89921b5dbb',
  'site/favicon.svg': '4ec733f9542323f6d2840ba743c4a11df4d416a7efa1d214567d62b58653619b',
  'site/favicon.ico': '4205e96a25955ce59c730fd380e45db18b153e152424661df1822ed296ccaf1c',
  'site/apple-touch-icon.png': '298658c5507dd8acacfa0b2c26b0cd00b612f0932698e4223f0a8a97957fafed',
  'site/og.png': 'affd93edb1d511780bad26de47cc673a5e93014967916029dd8db68ef9ec394e',
  'site/project-mark-color.svg': '4ec733f9542323f6d2840ba743c4a11df4d416a7efa1d214567d62b58653619b',
  'site/project-mark-reversed.svg': 'dc08a6ba51a2a8e9cb82d56f900ef2de9330ac72fbb3c727e0436a4ab2f3944f',
}

for (const [file, expected] of Object.entries(assets)) {
  assert.equal(await hash(file), expected, `${file} must be the approved O04 asset`)
}

const checksumFile = 'docs/assets/brand/checksums.txt'
assert.equal(await hash(checksumFile), 'f1c266d086750eed1fc053e10e858ad9d33c3227d468b823cc7c7d8ca2f4a1ed', 'vendored O04 checksums.txt must remain exact')
const checksums = await read(checksumFile)
for (const [asset, expected] of Object.entries({
  'glyph-color.svg': '4ec733f9542323f6d2840ba743c4a11df4d416a7efa1d214567d62b58653619b',
  'lockup-endorsed.svg': '905cf0a05ab5d3787bc02ff7d4591bfa020d72aefdd0e0d0c53271da6d3f383c',
  'readme-header.png': '481391d02b1f50ed6dba1790c0899bcc7d16948421bba66778756a89921b5dbb',
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
