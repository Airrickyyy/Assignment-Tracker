// Generates the VAPID key pair and cron secret for background push reminders
// (Phase 3C) and writes them to gitignored env files. Secrets are never
// printed.
//
//   node scripts/setup-push-keys.mjs           # first-time setup
//   node scripts/setup-push-keys.mjs --force   # rotate (existing browser
//                                              # subscriptions stop working
//                                              # until JARVIS is reopened)
//
// Writes:
//   .env.local               VITE_VAPID_PUBLIC_KEY   (public, used by the frontend)
//   supabase/functions/.env  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//                            VAPID_SUBJECT, CRON_SECRET  (Edge Function secrets)

import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root          = join(dirname(fileURLToPath(import.meta.url)), '..')
const frontendEnv   = join(root, '.env.local')
const functionsEnv  = join(root, 'supabase', 'functions', '.env')
const force         = process.argv.includes('--force')

function readEnv(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

/** Set KEY=value in env-file text, replacing an existing line if present. */
function setVar(text, key, value) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(text)) return text.replace(pattern, line)
  return text + (text && !text.endsWith('\n') ? '\n' : '') + line + '\n'
}

const existingFunctions = readEnv(functionsEnv)
if (/^VAPID_PRIVATE_KEY=.+$/m.test(existingFunctions) && !force) {
  console.log('VAPID keys already exist in supabase/functions/.env — nothing changed.')
  console.log('Pass --force to rotate them.')
  process.exit(0)
}

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub  = publicKey.export({ format: 'jwk' })
const priv = privateKey.export({ format: 'jwk' })

// Web Push wants the uncompressed public point (0x04 || x || y) and the raw
// private scalar, both base64url.
const vapidPublic = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(pub.x, 'base64url'),
  Buffer.from(pub.y, 'base64url'),
]).toString('base64url')
const vapidPrivate = priv.d
const cronSecret   = randomBytes(32).toString('hex')

let fn = existingFunctions
fn = setVar(fn, 'VAPID_PUBLIC_KEY', vapidPublic)
fn = setVar(fn, 'VAPID_PRIVATE_KEY', vapidPrivate)
if (!/^VAPID_SUBJECT=.+$/m.test(fn)) fn = setVar(fn, 'VAPID_SUBJECT', 'mailto:jarvis@example.com')
fn = setVar(fn, 'CRON_SECRET', cronSecret)
writeFileSync(functionsEnv, fn)

writeFileSync(frontendEnv, setVar(readEnv(frontendEnv), 'VITE_VAPID_PUBLIC_KEY', vapidPublic))

console.log('Wrote VITE_VAPID_PUBLIC_KEY to .env.local')
console.log('Wrote VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET to supabase/functions/.env')
console.log('Next: follow docs/PHASE-3C-SETUP.md (restart `npm run dev` to pick up the new key).')
