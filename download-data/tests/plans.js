import fs from 'node:fs'

import { calculateRentalCost } from '../lib/communauto.js'

/**
 * Test runner
 */
const tests = JSON.parse(fs.readFileSync('data/indices/rate-tests.json'))

const testsOverrideFileContents = fs.readFileSync('data/indices/rate-tests-override.json', {encoding: "utf-8"})
const testsOverride = testsOverrideFileContents === '' ? [] : JSON.parse(testsOverrideFileContents)

const testsToRun = (testsOverride.length === 0) ? tests :
	tests.filter(test => testsOverride.includes(test.scenario))

const testEvals = testsToRun.map(test => {
	const estimatesForScenario = calculateRentalCost(test.startDate, test.endDate, test.distance)

	let testResults = {
		scenario: test.scenario,
		testEvals: test.estimateTests
			.filter(estimate => estimate.plan !== "Open Super") // remove plan we don't compare against
			.map(estimate => ({
				plan: estimate.plan,
				expected: {
					duration: estimate.duration,
					distance: estimate.distance,
					total: estimate.total
				},
				actual: {
					duration: estimatesForScenario[estimate.plan].timeCost,
					distance: estimatesForScenario[estimate.plan].kmCost,
					total: estimatesForScenario[estimate.plan].totalCost,
					reconciliation: estimatesForScenario[estimate.plan].reconciliation
				}
			}))
			.map(estimate => ({
				...estimate,
				differenceExpectedActual: Math.round((estimate.actual.total - estimate.expected.total) * 100) / 100
			}))
			.map(estimate => ({
				...estimate,
				testResult: Math.abs(estimate.differenceExpectedActual) < 0.1 // NB! This sets our margin of error—10 cents is fine
			}))
	}

	testResults.evalsResult = testResults.testEvals.every(testEval => testEval.testResult)

	return testResults
})

fs.writeFileSync('data/out/rate-tests-evals.json', JSON.stringify(testEvals, null, 2))

fs.writeFileSync('data/out/rate-plan-failures.json', JSON.stringify(
	testEvals.filter(testEval => testEval.evalsResult === false).map(testEval => testEval.scenario),
	null,
	2
))

let testEvalSummary = {
	passed: testEvals.filter(testEval => testEval.evalsResult === true).map(testEval => testEval.scenario),
	failed: testEvals.filter(testEval => testEval.evalsResult === false).map(testEval => testEval.scenario),
	total: testEvals.length,
}

testEvalSummary.pass = testEvalSummary.passed.length
testEvalSummary.fail = testEvalSummary.failed.length
testEvalSummary.pass_rate = Math.round(testEvalSummary.pass / testEvalSummary.total * 100) / 100

console.log(testEvalSummary)
