import fs from 'node:fs'
import path from 'node:path'

export function loadEnv(rootDir = process.cwd()) {
  for (const fileName of ['.env.local', '.env']) {
    const envPath = path.join(rootDir, fileName)
    if (!fs.existsSync(envPath)) continue

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const equalIndex = trimmed.indexOf('=')
      if (equalIndex === -1) continue

      const key = trimmed.slice(0, equalIndex).trim()
      const rawValue = trimmed.slice(equalIndex + 1).trim()
      const value = rawValue.replace(/^["']|["']$/g, '')

      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  }
}
