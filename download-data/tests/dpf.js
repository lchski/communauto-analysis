import { calculateDpf } from '../lib/communauto.js'

// Values below reflect the DPF rates effective June 15, 2026:
// $1.35 start fee + $1.15/hour, capped at $11/day and $30/week.
const tests = [
	[30, 1.93],
	[60, 2.5],
	[60 * 3, 4.8],
	[60 * 12, 11],
	[(24 * 60), 11],
	[(25 * 60), 12.15],
	[(24 * 60) + (5 * 60), 16.75],
	[(24 * 60 * 2), 22],
	[(24 * 60 * 2) + 15, 22.29],
	[(24 * 60 * 5), 30],
	[(24 * 60 * 6), 30],
	[(24 * 60 * 7), 30], // one full week, capped
	[(24 * 60 * 7) + 60, 31.15],
	[(24 * 60 * 7 * 2), 60], // two weeks, simple
	[(24 * 60 * 7 * 2) + 60, 61.15], // two weeks, plus an hour
	[(24 * 60 * 7 * 3), 90], // three weeks, simple
	[(24 * 60 * 7 * 3) + 60, 91.15], // three weeks, plus an hour,
	[(24 * 60 * 7 * 3) + (24 * 60) + 60, 90 + 11 + 1.15], // 3 weeks, 1 day, 1 hour,
	[105,3.36],
	[45,2.21],
	[120,3.65],
	[75,2.79],
	[165,4.51],
	[240,5.95],
	[2070,22],
	[555,11],
	[720,11],
	[315,7.39],
	[345,7.96],
	[465,10.26],
	[120,3.65],
	[135,3.94],
	[90,3.08],
	[240,5.95],
	[135,3.94],
]

const testEvals = tests
	.map(scenario => ({minutes: scenario[0], expectedCost: scenario[1]}))
	.map(scenario => ({...scenario, dpf: calculateDpf(scenario.minutes)}))
	.map(scenario => ({...scenario, evalsResult: scenario.expectedCost == scenario.dpf}))

let testEvalSummary = {
	passed: testEvals.filter(testEval => testEval.evalsResult === true).map(testEval => testEval.minutes),
	failed: testEvals.filter(testEval => testEval.evalsResult === false).map(testEval => testEval.minutes),
	total: testEvals.length,
}

testEvalSummary.pass = testEvalSummary.passed.length
testEvalSummary.fail = testEvalSummary.failed.length
testEvalSummary.pass_rate = Math.round(testEvalSummary.pass / testEvalSummary.total * 100) / 100

console.log(testEvalSummary)
