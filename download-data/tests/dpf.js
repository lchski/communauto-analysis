import { calculateDpf } from '../lib/communauto.js'

const tests = [
	[30, 1.75], // Communauto example
	[60, 2.25], // Communauto example
	[60 * 3, 4.25], // Communauto example
	[60 * 12, 10],
	[(24 * 60), 10],
	[(25 * 60), 11],
	[(24 * 60) + (5 * 60), 15],
	[(24 * 60 * 2), 20], // Communauto example
	[(24 * 60 * 2) + 15, Math.round((20 + (15/60)) * 100) / 100],
	[(24 * 60 * 5), 25],
	[(24 * 60 * 6), 25],
	[(24 * 60 * 7), 25], // Communauto example
	[(24 * 60 * 7) + 60, 26],
	[(24 * 60 * 7 * 2), 50], // two weeks, simple
	[(24 * 60 * 7 * 2) + 60, 51], // two weeks, plus an hour
	[(24 * 60 * 7 * 3), 75], // three weeks, simple
	[(24 * 60 * 7 * 3) + 60, 76], // three weeks, plus an hour,
	[(24 * 60 * 7 * 3) + (24 * 60) + 60, 75 + 10 + 1], // 3 weeks, 1 day, 1 hour,
	[105,3.0],
	[45,2.0],
	[120,3.25],
	[75,2.5],
	[165,4.0],
	[240,5.25],
	[2070,20.0],
	[555,10.0],
	[720,10.0],
	[315,6.5],
	[345,7.0],
	[465,9.0],
	[120,3.25],
	[135,3.5],
	[90,2.75],
	[240,5.25],
	[135,3.5],
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
