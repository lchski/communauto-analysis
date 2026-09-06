import { calculateDpf } from '../lib/communauto.js'

// DPF rates effective June 15, 2026: $1.35 start fee + $1.15/hour,
// capped at $11/day and $30/week.
// Expected values below are derived directly from that formula (not from
// calling calculateDpf), so they serve as an independent check on it.
const START_FEE = 1.35
const HOURLY_RATE = 1.15
const DAILY_CAP = 11
const WEEKLY_CAP = 30

// calculateDpf rounds its result to the nearest cent; do the same here so
// formula-derived expectations line up with it.
const round2 = amount => Math.round(amount * 100) / 100
const firstDayCost = minutes => Math.min(START_FEE + (minutes / 60) * HOURLY_RATE, DAILY_CAP)
const laterDayCost = minutes => Math.min((minutes / 60) * HOURLY_RATE, DAILY_CAP)

const tests = [
	[30, round2(firstDayCost(30))],
	[60, round2(firstDayCost(60))],
	[60 * 3, round2(firstDayCost(60 * 3))],
	[60 * 12, round2(firstDayCost(60 * 12))], // exceeds daily cap
	[(24 * 60), round2(firstDayCost(24 * 60))], // exactly 1 day, capped
	[(25 * 60), round2(DAILY_CAP + laterDayCost(60))], // 1 day capped + 1hr into day 2
	[(24 * 60) + (5 * 60), round2(DAILY_CAP + laterDayCost(5 * 60))], // 1 day capped + 5hr into day 2
	[(24 * 60 * 2), round2(2 * DAILY_CAP)], // 2 days, both capped, under weekly cap
	[(24 * 60 * 2) + 15, round2((2 * DAILY_CAP) + laterDayCost(15))],
	[(24 * 60 * 5), WEEKLY_CAP], // 5 days of daily caps (55) exceeds the weekly cap
	[(24 * 60 * 6), WEEKLY_CAP], // 6 days of daily caps (66) exceeds the weekly cap
	[(24 * 60 * 7), WEEKLY_CAP], // one full week, capped
	[(24 * 60 * 7) + 60, round2(WEEKLY_CAP + laterDayCost(60))],
	[(24 * 60 * 7 * 2), 2 * WEEKLY_CAP], // two weeks, simple
	[(24 * 60 * 7 * 2) + 60, round2((2 * WEEKLY_CAP) + laterDayCost(60))], // two weeks, plus an hour
	[(24 * 60 * 7 * 3), 3 * WEEKLY_CAP], // three weeks, simple
	[(24 * 60 * 7 * 3) + 60, round2((3 * WEEKLY_CAP) + laterDayCost(60))], // three weeks, plus an hour
	[(24 * 60 * 7 * 3) + (24 * 60) + 60, round2((3 * WEEKLY_CAP) + DAILY_CAP + laterDayCost(60))], // 3 weeks, 1 day, 1 hour
	[105, round2(firstDayCost(105))],
	[45, round2(firstDayCost(45))],
	[120, round2(firstDayCost(120))],
	[75, round2(firstDayCost(75))],
	[165, round2(firstDayCost(165))],
	[240, round2(firstDayCost(240))],
	[2070, round2(DAILY_CAP + laterDayCost(2070 - (24 * 60)))], // 1 day capped + partial 2nd day, itself capped
	[555, round2(firstDayCost(555))], // exceeds daily cap
	[720, round2(firstDayCost(720))],
	[315, round2(firstDayCost(315))],
	[345, round2(firstDayCost(345))],
	[465, round2(firstDayCost(465))],
	[120, round2(firstDayCost(120))],
	[135, round2(firstDayCost(135))],
	[90, round2(firstDayCost(90))],
	[240, round2(firstDayCost(240))],
	[135, round2(firstDayCost(135))],
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
