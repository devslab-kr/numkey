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
  'site/project-lockup.svg': '905cf0a05ab5d3787bc02ff7d4591bfa020d72aefdd0e0d0c53271da6d3f383c',
}

for (const [file, expected] of Object.entries(assets)) {
  assert.equal(await hash(file), expected, `${file} must be the approved O04 asset`)
}

const preview = 'https://raw.githubusercontent.com/devslab-kr/numkey/main/docs/preview.png'
for (const file of ['README.md', 'README.ko.md']) {
  const content = await read(file)
  assert.match(content, /Open source by \[DevsLab\]\(https:\/\/devslab\.kr\/brand\/open-source\/\)/, `${file} needs the DevsLab endorsement`)
  assert.match(content, /docs\/assets\/brand\/readme-header\.png/, `${file} needs the O04 README header`)
  assert.match(content, new RegExp(preview.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${file} must retain the preview reference`)
}

const site = await read('site/index.html')
assert.match(site, /src="project-lockup\.svg"/, 'site must use the O04 lockup')
assert.match(await read('site/project-lockup.svg'), /data-oss-lockup="O04"/, 'site lockup must identify O04')
assert.match(site, /rel="canonical" href="https:\/\/devslab-kr\.github\.io\/numkey\/"/, 'site needs a canonical URL')
assert.match(site, /property="og:title" content="numkey/, 'site needs an Open Graph title')
assert.match(site, /property="og:image" content="https:\/\/devslab-kr\.github\.io\/numkey\/og\.png"/, 'site needs the O04 Open Graph image')
assert.match(site, /name="twitter:card" content="summary_large_image"/, 'site needs a Twitter card')

console.log(`Verified ${Object.keys(assets).length} approved O04 assets and numkey brand surfaces.`)
