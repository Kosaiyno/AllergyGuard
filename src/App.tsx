import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { runAllergyCheck } from './genlayer'
import type { Assessment } from './genlayer'

type UiStatus = 'idle' | 'pending' | 'success' | 'error'

const STATUS_LABELS: Record<UiStatus, string> = {
  idle: '',
  pending: 'Running AI research and GenLayer validation\u2026',
  success: '',
  error: '',
}

const HOW_IT_WORKS = [
  {
    title: 'Build your profile',
    description:
      'Type each food allergy that applies to you and add it to your profile. Your profile shapes every check you run.',
  },
  {
    title: 'Name the food',
    description:
      'Enter the name of a dish, such as Jollof rice or pancakes, that you want to understand before you eat.',
  },
  {
    title: 'Review the assessment',
    description:
      'AI researches the known ingredients associated with the dish, and GenLayer validators independently assess whether they contain or may correspond to your allergens. The finalized assessment reports the risk level, matched and uncertain allergens, research source, and supporting evidence.',
  },
]

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3 5 6v5c0 4.4 2.9 8 7 10 4.1-2 7-5.6 7-10V6l-7-3Z" />
      <path d="m9 11.8 2 2 4-4" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m6 6 8 8M14 6l-8 8" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8.75" cy="8.75" r="5.75" />
      <path d="m13.2 13.2 3.3 3.3" />
    </svg>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="10"
        cy="10"
        r="7.5"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.5"
      />
      <path
        d="M17.5 10A7.5 7.5 0 0 0 10 2.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

const RISK_THEMES: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  HIGH_RISK: {
    label: 'High risk',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
  },
  POTENTIAL_RISK: {
    label: 'Potential risk',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
    dot: 'bg-amber-500',
  },
  NO_IDENTIFIED_RISK: {
    label: 'No identified risk',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  INSUFFICIENT_INFORMATION: {
    label: 'Insufficient information',
    badge: 'border-slate-300 bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
  },
}

function App() {
  const [allergies, setAllergies] = useState<string[]>([])
  const [allergyInput, setAllergyInput] = useState('')
  const [allergyError, setAllergyError] = useState('')
  const [food, setFood] = useState('')
  const [status, setStatus] = useState<UiStatus>('idle')
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [checkedFood, setCheckedFood] = useState('')
  const [checkError, setCheckError] = useState('')

  const canSubmit = food.trim().length > 0 && allergies.length > 0
  const isBusy = status === 'pending'
  const riskTheme = assessment
    ? (RISK_THEMES[assessment.risk_level] ?? {
        label: assessment.risk_level.replaceAll('_', ' ').toLowerCase(),
        badge: 'border-slate-300 bg-slate-100 text-slate-700',
        dot: 'bg-slate-400',
      })
    : null

  function addAllergy() {
    const cleaned = allergyInput.trim().replace(/\s+/g, ' ')

    if (!cleaned) {
      setAllergyError('Enter an allergy before adding it.')
      return
    }

    if (
      allergies.some(
        (allergy) => allergy.toLowerCase() === cleaned.toLowerCase(),
      )
    ) {
      setAllergyError('That allergy is already in your profile.')
      return
    }

    setAllergies((current) => [...current, cleaned])
    setAllergyInput('')
    setAllergyError('')
  }

  function removeAllergy(allergyToRemove: string) {
    setAllergies((current) =>
      current.filter((allergy) => allergy !== allergyToRemove),
    )
  }

  function handleAllergyKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addAllergy()
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || isBusy) return

    const foodName = food.trim()

    setAssessment(null)
    setCheckedFood(foodName)
    setCheckError('')
    setStatus('pending')

    try {
      const result = await runAllergyCheck(foodName, allergies)
      setAssessment(result)
      setStatus('success')
    } catch (error) {
      setCheckError(
        error instanceof Error
          ? error.message
          : 'The allergy check could not be completed.',
      )
      setStatus('error')
    }
  }

  return (
    <div className="min-h-svh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="group flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/25">
              <ShieldIcon className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              Allergy<span className="text-emerald-600">Guard</span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a
              href="#how-it-works"
              className="transition hover:text-slate-950"
            >
              How it works
            </a>
            <a href="#allergens" className="transition hover:text-slate-950">
              Allergens
            </a>
            <a href="#check" className="transition hover:text-slate-950">
              Check a food
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              GenLayer StudioNet
            </span>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full bg-emerald-200/40 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 right-0 size-[24rem] rounded-full bg-teal-100/70 blur-3xl"
          />

          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-12 pb-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14 lg:px-8 lg:pt-20 lg:pb-20">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-800 uppercase">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Allergy intelligence on GenLayer
              </span>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 text-balance sm:text-5xl lg:leading-[1.08]">
                Know what&rsquo;s really in your food.
              </h1>

              <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                AllergyGuard checks a food against your personal allergy
                profile. AI researches the ingredients behind a dish, and
                GenLayer validators independently assess potential allergen
                matches &mdash; so you can ask better questions before you eat.
              </p>

              <ul className="mt-7 space-y-3 text-sm text-slate-600">
                {[
                  'A profile tailored to your food allergies',
                  'Ingredient-aware research for any dish or product',
                  'Independent validator assessment of each match',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckIcon className="size-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div
              id="check"
              className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/[0.06] sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                    Run an allergy check
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Two quick steps to set up your request.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6">
                <fieldset id="allergens" className="scroll-mt-24">
                  <legend className="sr-only">Your allergy profile</legend>

                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span className="flex size-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                        1
                      </span>
                      Your allergy profile
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {allergies.length} added
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    Type each food allergy that applies to you.
                  </p>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="allergy-input" className="sr-only">
                      Allergy name
                    </label>
                    <input
                      id="allergy-input"
                      type="text"
                      value={allergyInput}
                      onChange={(event) => {
                        setAllergyInput(event.target.value)
                        if (allergyError) setAllergyError('')
                      }}
                      onKeyDown={handleAllergyKeyDown}
                      placeholder="e.g. Peanuts"
                      autoComplete="off"
                      aria-invalid={allergyError.length > 0}
                      aria-describedby={
                        allergyError ? 'allergy-error' : undefined
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addAllergy}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      Add allergy
                    </button>
                  </div>

                  {allergyError && (
                    <p
                      id="allergy-error"
                      role="alert"
                      className="mt-1.5 text-xs leading-5 text-rose-600"
                    >
                      {allergyError}
                    </p>
                  )}

                  {allergies.length > 0 ? (
                    <ul
                      aria-label="Your added allergies"
                      className="mt-3 flex flex-wrap gap-2"
                    >
                      {allergies.map((allergy) => (
                        <li
                          key={allergy}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-1 pr-1.5 pl-3 text-sm font-medium text-emerald-900"
                        >
                          {allergy}
                          <button
                            type="button"
                            onClick={() => removeAllergy(allergy)}
                            aria-label={`Remove ${allergy}`}
                            className="flex size-5 items-center justify-center rounded-full text-emerald-700 transition hover:bg-emerald-200/80 hover:text-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600"
                          >
                            <CloseIcon className="size-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400">
                      No allergies added yet.
                    </p>
                  )}
                </fieldset>

                <div className="mt-6">
                  <label
                    htmlFor="food"
                    className="flex items-center gap-2 text-sm font-semibold text-slate-900"
                  >
                    <span className="flex size-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                      2
                    </span>
                    Search a food
                  </label>
                  <p
                    id="food-help"
                    className="mt-1.5 text-xs leading-5 text-slate-500"
                  >
                    Enter the name of a food or dish.
                  </p>

                  <div className="relative mt-3">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="food"
                      type="text"
                      value={food}
                      onChange={(event) => setFood(event.target.value)}
                      placeholder="Enter a food or dish name"
                      autoComplete="off"
                      aria-describedby="food-help"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit || isBusy}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                >
                  {isBusy ? (
                    <SpinnerIcon className="size-4 animate-spin" />
                  ) : (
                    <SearchIcon className="size-4" />
                  )}
                  {isBusy ? 'Checking\u2026' : 'Check for allergens'}
                </button>

                <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">
                  {canSubmit
                    ? 'Runs a live check on GenLayer StudioNet.'
                    : 'Add at least one allergy and enter a food or dish name to continue.'}
                </p>
              </form>

              {isBusy && (
                <div
                  role="status"
                  className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <SpinnerIcon className="mt-0.5 size-4 shrink-0 animate-spin text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {STATUS_LABELS[status]}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      AI research and validator consensus can take a few
                      minutes. Keep this page open.
                    </p>
                  </div>
                </div>
              )}

              {status === 'error' && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4"
                >
                  <p className="text-sm font-semibold text-rose-900">
                    Check failed
                  </p>
                  <p className="mt-1 text-xs leading-5 text-rose-800">
                    {checkError}
                  </p>
                </div>
              )}

              {status === 'success' && assessment && riskTheme && (
                <div
                  role="status"
                  className="mt-5 rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                        On-chain assessment
                        {assessment.check_id ? ` \u00b7 Check #${assessment.check_id}` : ''}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {assessment.food_name || checkedFood}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskTheme.badge}`}
                    >
                      <span className={`size-1.5 rounded-full ${riskTheme.dot}`} />
                      {riskTheme.label}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {assessment.explanation}
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                        Identified ingredients
                      </p>
                      {assessment.ingredients.length > 0 ? (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {assessment.ingredients.map((ingredient) => (
                            <li
                              key={ingredient}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                            >
                              {ingredient}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-xs text-slate-400">
                          None identified.
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                        Matched allergens
                      </p>
                      {assessment.matched_allergens.length > 0 ? (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {assessment.matched_allergens.map((allergen) => (
                            <li
                              key={allergen}
                              className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"
                            >
                              {allergen}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-xs text-slate-400">None.</p>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                        Uncertain matches
                      </p>
                      {assessment.uncertain_matches.length > 0 ? (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {assessment.uncertain_matches.map((match) => (
                            <li
                              key={match}
                              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                            >
                              {match}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-xs text-slate-400">None.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500">
                      Research source:{' '}
                      <span className="font-medium text-slate-700">
                        {assessment.research_source}
                      </span>
                    </p>

                    {assessment.sources.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                          Evidence
                        </p>
                        <ul className="mt-1 space-y-1">
                          {assessment.sources.map((source) => (
                            <li key={source.url}>
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium break-all text-emerald-700 underline-offset-2 hover:underline"
                              >
                                {source.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-20 border-t border-slate-200/70 bg-white/70"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-widest text-emerald-700 uppercase">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 text-balance sm:text-4xl">
                From your profile to a clearer answer.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                AllergyGuard is designed to combine fast AI research with
                independent validation, so allergen information is not left to
                a single source.
              </p>
            </div>

            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {HOW_IT_WORKS.map((step, index) => (
                <li
                  key={step.title}
                  className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-950">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <ShieldIcon className="size-4.5" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Allergy<span className="text-emerald-600">Guard</span>
            </span>
          </div>
          <p className="max-w-xl text-xs leading-5 text-slate-500 md:text-right">
            AllergyGuard is not medical advice &mdash; always
            verify ingredients with the manufacturer and consult a qualified
            clinician about your allergies.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
