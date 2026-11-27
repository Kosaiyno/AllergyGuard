# AllergyGuard

AllergyGuard checks a food or dish against a personal allergy profile. AI researches the ingredients associated with the food, and GenLayer validators independently assess whether those ingredients contain or may correspond to the user's declared allergens.

The app runs on GenLayer StudioNet and returns a finalized on-chain assessment.

## Features

- Add and remove custom food allergies, with empty and duplicate validation.
- Search by food or dish name.
- Server-side relayer handles transaction signing and fees, so users do not connect a wallet.
- Live loading, pending, success, and error states.
- Results show:
  - Risk level
  - Identified ingredients
  - Matched allergens
  - Uncertain matches
  - Plain-language explanation
  - Research source
  - Evidence URLs

## Architecture

```
Browser (React + Vite)
        │  POST /api/check
        ▼
Node relayer (server/index.mjs)
        │  signs check_food, pays GEN fees
        ▼
GenLayer StudioNet contract
        │  AI research + validator consensus
        ▼
get_last_result() → parsed assessment
```

- **Frontend:** React, TypeScript, Tailwind CSS v4, Vite.
- **Relayer:** Node HTTP server using `genlayer-js`. Keeps the private key server-side.
- **Contract:** `AllergyGuard` at `0xCC13DB169A50db1c0B0E9fC327A9825F6Ac76151` on StudioNet.

## Smart contract

The Intelligent Contract source is included at [`contracts/allergyguard.py`](contracts/allergyguard.py).

- **Contract name:** `AllergyGuard`
- **Network:** GenLayer StudioNet
- **Address:** `0xCC13DB169A50db1c0B0E9fC327A9825F6Ac76151`
- **Write method:** `check_food(food_name, allergy_names)`
- **View methods:** `get_last_result()`, `get_check_count()`

The contract researches known ingredients through web sources, uses an LLM prompt to assess them against the declared allergies, and requires independent GenLayer validators to agree on the risk level and allergen matches before finalizing the result.

## Setup

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```env
GENLAYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
PORT=8787
```

Use a dedicated burner wallet and fund it with a small amount of GEN on GenLayer StudioNet. The relayer pays transaction fees.

> Never commit `.env`. It is already listed in `.gitignore`.

## Run locally

Start the relayer in one terminal:

```bash
npm run server
```

Start the frontend in another:

```bash
npm run dev
```

Open http://localhost:5173/.

Vite proxies `/api` requests to `http://localhost:8787`.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite frontend |
| `npm run server` | Start the GenLayer relayer |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |

## API

`POST /api/check`

```json
{
  "foodName": "Jollof rice",
  "allergies": ["Shellfish", "Peanuts"]
}
```

`GET /api/health` returns `{ "ok": true }`.

The relayer validates input, executes checks one at a time, waits for finalization, and returns the parsed assessment.

## Security notes

- The private key is loaded from `.env` and never sent to the browser.
- The current relayer has no authentication or rate limiting. Add both before exposing it publicly.
- AllergyGuard is not medical advice. Always verify ingredients with the manufacturer and consult a qualified clinician.
