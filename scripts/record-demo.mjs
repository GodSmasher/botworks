// Records a short walkthrough of the demo as a GIF for the README.
//
//   node scripts/record-demo.mjs                 # against the hosted demo
//   BASE_URL=http://localhost:3000 node scripts/record-demo.mjs
//
// Uses Playwright's Chromium if installed, otherwise your local Google Chrome.
// Needs ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg). Output: docs/demo.gif
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const BASE = (process.env.BASE_URL ?? 'https://botworks-psi.vercel.app').replace(/\/$/, '')
const OUT = 'docs/demo.gif'
const SIZE = { width: 1280, height: 900 }
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'

// One stop per screen: where to go, how long to linger, how far to scroll.
const TOUR = [
  { path: '/dashboard', linger: 2600, scroll: 0 },
  { path: '/bots', linger: 2400, scroll: 350 },
  { path: '/connectors', linger: 2200, scroll: 0 },
  { path: '/route-bot', linger: 2400, scroll: 300 },
  { path: '/lang?to=de&next=/dashboard', linger: 2600, scroll: 0 },
  { path: '/analytics', linger: 2400, scroll: 0 },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function smoothScroll(page, px) {
  for (let done = 0; done < px; done += 40) {
    await page.mouse.wheel(0, 40)
    await sleep(40)
  }
}

const tmp = 'docs/.video'
rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }))
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: tmp, size: SIZE }, deviceScaleFactor: 1 })
const page = await context.newPage()

for (const stop of TOUR) {
  await page.goto(BASE + stop.path, { waitUntil: 'networkidle' })
  await sleep(stop.linger)
  if (stop.scroll) await smoothScroll(page, stop.scroll)
  await sleep(600)
}

await context.close()
await browser.close()

const webm = join(tmp, readdirSync(tmp).find((f) => f.endsWith('.webm')))
mkdirSync('docs', { recursive: true })
// Two-pass palette conversion keeps the GIF small and the UI text crisp.
const filters = 'fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5'
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', webm, '-vf', filters, '-loop', '0', OUT], { stdio: 'inherit' })
renameSync(webm, 'docs/demo.webm')
rmSync(tmp, { recursive: true, force: true })
console.log(`wrote ${OUT} and docs/demo.webm from ${BASE}`)
