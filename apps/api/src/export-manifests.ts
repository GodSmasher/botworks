// Writes every registered bot manifest to a JSON file. The admin panel bundles
// that file so it can list the fleet in mock mode without a running API.
//   npm run manifests --workspace @botworks/api
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { registry } from '@botworks/core'
import './register.js'

const target = resolve(process.argv[2] ?? '../admin/src/lib/mock/bots.json')
const manifests = registry.list()
writeFileSync(target, JSON.stringify(manifests, null, 2) + '\n')
console.log(`${manifests.length} manifests → ${target}`)
