export type Assessment = {
  risk_level: string
  ingredients: string[]
  matched_allergens: string[]
  uncertain_matches: string[]
  explanation: string
  sources: { title: string; url: string }[]
  research_source: string
  food_name?: string
  check_id?: number
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function parseAssessment(raw: unknown): Assessment | null {
  let data: unknown = raw

  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return null
    }
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  const result = data as Record<string, unknown>

  if (typeof result.risk_level !== 'string') return null

  const sources = Array.isArray(result.sources)
    ? result.sources.flatMap((source) => {
        if (!source || typeof source !== 'object') return []
        const { title, url } = source as Record<string, unknown>
        if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return []
        return [{ title: typeof title === 'string' ? title : url, url }]
      })
    : []

  return {
    risk_level: result.risk_level,
    ingredients: toStringArray(result.ingredients),
    matched_allergens: toStringArray(result.matched_allergens),
    uncertain_matches: toStringArray(result.uncertain_matches),
    explanation:
      typeof result.explanation === 'string' ? result.explanation : '',
    sources,
    research_source:
      typeof result.research_source === 'string'
        ? result.research_source
        : 'Unknown',
    food_name:
      typeof result.food_name === 'string' ? result.food_name : undefined,
    check_id:
      typeof result.check_id === 'number' ? result.check_id : undefined,
  }
}

export async function runAllergyCheck(
  foodName: string,
  allergies: string[],
): Promise<Assessment> {
  let response: Response

  try {
    response = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodName, allergies }),
    })
  } catch (error) {
    throw new Error('Could not reach the allergy check service.', {
      cause: error,
    })
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new Error('The allergy check service returned an invalid response.')
  }

  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null

  if (!response.ok) {
    throw new Error(
      typeof record?.error === 'string'
        ? record.error
        : `The allergy check failed (${response.status}).`,
    )
  }

  const assessment = parseAssessment(record?.result)

  if (!assessment) {
    throw new Error('The allergy check service returned an unreadable assessment.')
  }

  return assessment
}
