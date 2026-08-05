import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import { readdirSync, existsSync } from 'fs'
import { resolve } from 'path'

// vite-plugin-compression2 emits pre-compressed copies of every asset so that
// a production web-server (nginx/CDN) can serve them with Content-Encoding
// headers without compressing on the fly.

const DIST_ASSETS = resolve('frontend/dist/assets')

test.describe('Production build compression artifacts', () => {
  test.beforeAll(() => {
    // Build the frontend; this writes dist/ including .gz and .br siblings
    execSync('npm --prefix frontend run build', {
      stdio: 'pipe',
      timeout: 120_000,
    })
  })

  test('dist/assets directory exists after build', () => {
    expect(existsSync(DIST_ASSETS)).toBe(true)
  })

  test('build produces at least one .gz compressed asset', () => {
    const gzFiles = readdirSync(DIST_ASSETS).filter(f => f.endsWith('.gz'))
    console.log('Gzip files found:', gzFiles)
    expect(gzFiles.length).toBeGreaterThan(0)
  })

  test('build produces at least one .br (brotli) compressed asset', () => {
    const brFiles = readdirSync(DIST_ASSETS).filter(f => f.endsWith('.br'))
    console.log('Brotli files found:', brFiles)
    expect(brFiles.length).toBeGreaterThan(0)
  })

  test('.gz files are smaller than their uncompressed counterparts', () => {
    const { statSync } = require('fs')
    const { join } = require('path')

    const gzFiles = readdirSync(DIST_ASSETS).filter(f => f.endsWith('.gz'))
    for (const gz of gzFiles) {
      const original = gz.slice(0, -3) // strip ".gz"
      const origPath = join(DIST_ASSETS, original)
      const gzPath = join(DIST_ASSETS, gz)
      if (existsSync(origPath)) {
        const origSize = statSync(origPath).size
        const gzSize = statSync(gzPath).size
        expect(gzSize).toBeLessThan(origSize)
      }
    }
  })

  test('.br files are smaller than their uncompressed counterparts', () => {
    const { statSync } = require('fs')
    const { join } = require('path')

    const brFiles = readdirSync(DIST_ASSETS).filter(f => f.endsWith('.br'))
    for (const br of brFiles) {
      const original = br.slice(0, -3) // strip ".br"
      const origPath = join(DIST_ASSETS, original)
      const brPath = join(DIST_ASSETS, br)
      if (existsSync(origPath)) {
        const origSize = statSync(origPath).size
        const brSize = statSync(brPath).size
        expect(brSize).toBeLessThan(origSize)
      }
    }
  })

  test('index.html is present in dist root', () => {
    expect(existsSync(resolve('frontend/dist/index.html'))).toBe(true)
  })
})
