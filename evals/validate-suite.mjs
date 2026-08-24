import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const text = value => typeof value === 'string' && value.trim() !== ''
const levels = ['L1', 'L2', 'L3', 'L4']
const statuses = ['passed', 'failed', 'blocked', 'not-run']

export function validateSuite(suite) {
  const errors = []
  if (suite?.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (!text(suite?.id) || !text(suite?.version) || !text(suite?.objective)) errors.push('id, version, and objective are required')
  const stages = new Set(suite?.releaseOrder ?? [])
  if (stages.size === 0) errors.push('releaseOrder must define product gates')

  const dimensions = new Set()
  for (const dimension of suite?.dimensions ?? []) {
    if (!text(dimension?.id) || !text(dimension?.validates)) errors.push('every dimension needs id and validates')
    else if (dimensions.has(dimension.id)) errors.push(`duplicate dimension '${dimension.id}'`)
    else dimensions.add(dimension.id)
  }

  const covered = new Set()
  const ids = new Set()
  for (const testCase of suite?.cases ?? []) {
    const id = testCase?.id ?? '?'
    if (!/^(AST|VOI|SEC|OPS)-\d{3}$/.test(id)) errors.push(`invalid case id '${id}'`)
    else if (ids.has(id)) errors.push(`duplicate case '${id}'`)
    else ids.add(id)
    if (!stages.has(testCase?.stage)) errors.push(`case '${id}' references unknown stage '${testCase?.stage ?? '?'}'`)
    if (!['release', 'benchmark'].includes(testCase?.tier)) errors.push(`case '${id}' has invalid tier`)
    if (!levels.includes(testCase?.minEvidence)) errors.push(`case '${id}' has invalid minEvidence`)
    for (const field of ['title', 'preconditions']) if (!text(testCase?.[field])) errors.push(`case '${id}' needs ${field}`)
    for (const field of ['steps', 'criteria', 'validates']) {
      if (!Array.isArray(testCase?.[field]) || testCase[field].length === 0) errors.push(`case '${id}' needs ${field}`)
    }
    if ((testCase?.criteria?.length ?? 0) < 2) errors.push(`case '${id}' needs at least two criteria`)
    for (const dimension of testCase?.validates ?? []) {
      if (!dimensions.has(dimension)) errors.push(`case '${id}' references unknown dimension '${dimension}'`)
      covered.add(dimension)
    }
  }
  if (ids.size === 0) errors.push('suite needs cases')
  for (const dimension of dimensions) if (!covered.has(dimension)) errors.push(`dimension '${dimension}' is not covered`)
  return { errors, ids }
}

export function validateRun(run, suite, caseIds) {
  const errors = []
  const prefix = run?.executedAt || 'run'
  if (run?.suiteId !== suite.id || run?.suiteVersion !== suite.version) errors.push(`${prefix}: suite id/version mismatch`)
  if (!text(run?.executedAt)) errors.push(`${prefix}: executedAt is required`)
  if (!run?.environment || typeof run.environment !== 'object' || Array.isArray(run.environment)) errors.push(`${prefix}: environment is required`)
  const seen = new Set()
  for (const result of run?.results ?? []) {
    const id = result?.caseId ?? '?'
    if (!caseIds.has(id)) errors.push(`${prefix}: unknown case '${id}'`)
    if (seen.has(id)) errors.push(`${prefix}: duplicate result '${id}'`)
    seen.add(id)
    if (!statuses.includes(result?.status)) errors.push(`${prefix}: invalid status for '${id}'`)
    if (!['none', ...levels].includes(result?.observedLevel)) errors.push(`${prefix}: invalid observedLevel for '${id}'`)
    if (!text(result?.evidence)) errors.push(`${prefix}: '${id}' needs evidence`)
    if (result?.status === 'passed') {
      const required = levels.indexOf(suite.cases.find(item => item.id === id)?.minEvidence)
      const observed = levels.indexOf(result.observedLevel)
      if (observed < required) errors.push(`${prefix}: '${id}' cannot pass below its minimum evidence level`)
    }
  }
  for (const id of caseIds) if (!seen.has(id)) errors.push(`${prefix}: missing result '${id}'`)
  return errors
}

export function validateReleaseGate(run, suite) {
  const resultById = new Map((run?.results ?? []).map(result => [result.caseId, result]))
  const releaseCases = suite.cases.filter(testCase => testCase.tier === 'release')
  const errors = releaseCases
    .filter(testCase => resultById.get(testCase.id)?.status !== 'passed')
    .map(testCase => `latest run release gate '${testCase.id}' is '${resultById.get(testCase.id)?.status ?? 'missing'}'`)
  return {
    errors,
    passed: releaseCases.filter(testCase => resultById.get(testCase.id)?.status === 'passed').length,
    total: releaseCases.length,
  }
}

async function main() {
  const suite = JSON.parse(await readFile(resolve(directory, 'suite.json'), 'utf8'))
  const validated = validateSuite(suite)
  const errors = [...validated.errors]
  const runDirectory = resolve(directory, 'runs')
  const names = (await readdir(runDirectory)).filter(name => name.endsWith('.json')).sort()
  const runs = []
  for (const name of names) {
    const run = JSON.parse(await readFile(resolve(runDirectory, name), 'utf8'))
    runs.push(run)
    errors.push(...validateRun(run, suite, validated.ids))
  }
  if (runs.length === 0) errors.push('at least one current evaluation run is required')
  const release = runs.length > 0 ? validateReleaseGate(runs.at(-1), suite) : { errors: [], passed: 0, total: 0 }
  errors.push(...release.errors)

  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
  } else {
    const benchmarks = suite.cases.filter(testCase => testCase.tier === 'benchmark')
    const latest = runs.at(-1)
    const resultById = new Map(latest.results.map(result => [result.caseId, result]))
    const benchmarkPassed = benchmarks.filter(testCase => resultById.get(testCase.id)?.status === 'passed').length
    console.log(`validated ${suite.cases.length} cases and ${runs.length} current run(s); latest release gate ${release.passed}/${release.total} passed; benchmarks ${benchmarkPassed}/${benchmarks.length} passed`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
