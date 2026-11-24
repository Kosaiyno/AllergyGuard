import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAccount, createClient, isSuccessful } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'
import { TransactionHashVariant } from 'genlayer-js/types'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {
  // .env is optional when the key is supplied through the environment.
}

const PORT = Number(process.env.PORT || 8787)
const CONTRACT_ADDRESS = '0xCC13DB169A50db1c0B0E9fC327A9825F6Ac76151'
const PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY

if (!PRIVATE_KEY || !/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  console.error(
    'Missing or invalid GENLAYER_PRIVATE_KEY. Add it to .env (see .env.example).',
  )
  process.exit(1)
}

const account = createAccount(PRIVATE_KEY)
const walletClient = createClient({ chain: studionet, account })
const readClient = createClient({ chain: studionet })

// The contract stores only one last_result, so checks must run one at a time.
let queue = Promise.resolve()

function runQueued(task) {
  const run = queue.then(task)
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    request.on('data', (chunk) => {
      size += chunk.length
      if (size > 10_000) {
        reject(new HttpError(413, 'Request body is too large.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })

    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new HttpError(400, 'Request body must be valid JSON.'))
      }
    })

    request.on('error', reject)
  })
}

function validateInput(body) {
  const foodName =
    body && typeof body.foodName === 'string' ? body.foodName.trim() : ''

  const allergies =
    body && Array.isArray(body.allergies)
      ? [
          ...new Set(
            body.allergies
              .filter((item) => typeof item === 'string')
              .map((item) => item.trim())
              .filter(Boolean),
          ),
        ]
      : []

  if (!foodName) throw new HttpError(400, 'Food name is required.')
  if (foodName.length > 120)
    throw new HttpError(400, 'Food name is too long.')
  if (allergies.length === 0)
    throw new HttpError(400, 'Add at least one food allergy.')
  if (allergies.length > 30) throw new HttpError(400, 'Too many allergies.')
  if (allergies.some((item) => item.length > 80))
    throw new HttpError(400, 'An allergy name is too long.')

  return { foodName, allergies }
}

async function checkFood(foodName, allergies) {
  const write = {
    address: CONTRACT_ADDRESS,
    functionName: 'check_food',
    args: [foodName, allergies],
  }

  const estimate = await walletClient.estimateTransactionFeesForWrite(write)
  const hash = await walletClient.writeContract({
    ...write,
    fees: {
      distribution: estimate.distribution,
      feeValue: estimate.feeValue,
    },
  })

  const receipt = await walletClient.waitForTransactionReceipt({
    hash,
    waitUntil: 'finalized',
    retries: 240,
    interval: 3000,
  })

  if (!isSuccessful(receipt)) {
    const detail = [receipt.statusName, receipt.txExecutionResultName]
      .filter(Boolean)
      .join(' / ')
    throw new Error(
      `Contract execution failed${detail ? ` (${detail})` : ''}.`,
    )
  }

  const raw = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_last_result',
    args: [],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  })

  let result

  try {
    result = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    throw new Error('The contract returned an unreadable assessment.')
  }

  if (!result || typeof result !== 'object') {
    throw new Error('The contract returned an unreadable assessment.')
  }

  return { result, txHash: hash }
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/api/health') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method !== 'POST' || request.url !== '/api/check') {
    sendJson(response, 404, { error: 'Not found.' })
    return
  }

  try {
    const body = await readBody(request)
    const { foodName, allergies } = validateInput(body)
    const result = await runQueued(() => checkFood(foodName, allergies))
    sendJson(response, 200, result)
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502
    const message =
      error instanceof Error
        ? error.message
        : 'The allergy check could not be completed.'

    if (status >= 500) {
      console.error('[check_food]', message)
    }

    sendJson(response, status, { error: message })
  }
})

// AI research plus validator consensus can take several minutes.
server.requestTimeout = 0

server.listen(PORT, () => {
  console.log(`AllergyGuard relayer listening on http://localhost:${PORT}`)
  console.log(`Relayer account: ${account.address}`)
})
