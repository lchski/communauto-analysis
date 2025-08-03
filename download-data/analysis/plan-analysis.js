import { readFileSync, writeFileSync } from 'fs'

/**
 * Costing functions
 */

// Communauto explanation of how trips are calculated:
//   https://communauto.com/exemples-to-show-how-trip-costs-are-calculated/?lang=en
//
// Plan rate is calculated, along with the long distance and workday rates (if the trip is eligible for a workday rate).
// Then, the lowest is taken. For Value plans, the OpenPlus plan is included as a possible lowest value.
//
// Algo:
// - Calculate each plan standalone.
// - Reconcile to the lowest eligible plan.

function calculateBaseRentalCost(startDate, endDate, totalKm) {
	// Plan configurations
	const plans = {
		"Open": {
			hourlyRate: 13,
			maxDailyRate: 55,
			kmRate1: 0, // first 75km free
			kmRate2: 0.30,
			kmThreshold: 75,
			tripIsEligible: true
		},
		"Open Plus": {
			hourlyRate: 7.5,
			maxDailyRate: 50,
			maxDailyRate2: 35,
			kmRate1: 0.25,
			kmRate2: 0.25, // same rate for all km
			kmThreshold: Infinity, // no threshold change
			tripIsEligible: true
		},
		"Value": {
			hourlyRate: 4.5,
			maxDailyRate: 35,
			kmRate1: 0.47,
			kmRate2: 0.34,
			kmThreshold: 50,
			tripIsEligible: true
		},
		"Value Plus": {
			hourlyRate: 3.9,
			maxDailyRate: 29,
			kmRate1: 0.38,
			kmRate2: 0.30,
			kmThreshold: 50,
			tripIsEligible: true
		},
		"Value Extra": {
			hourlyRate: 3.6,
			maxDailyRate: 25,
			kmRate1: 0.30,
			kmRate2: 0.30, // Same rate for all km
			kmThreshold: Infinity, // No threshold change
			tripIsEligible: true
		},
		longDistanceLow: {
			hourlyRate: 15,
			maxDailyRate: {
				firstDay: 41,
				additionalDay: 32,
				week: 195
			},
			kmRate1: 0.24,
			kmRate2: 0.15,
			kmThreshold: 300,
			tripIsEligible: (startDate, endDate) => {
				const start = new Date(startDate)

				return [0, 1, 2, 3, 4, 10, 11].includes(start.getMonth()) || // any date in January, February, March, April, May, November, December
					(start.getMonth() === 5 && start.getDate() < 15) || // June 1 to 14
					(start.getMonth() === 9 && start.getDate() > 15) // October 16+
			}
		},
		longDistanceHigh: {
			hourlyRate: 15,
			maxDailyRate: {
				firstDay: 55,
				additionalDay: 45,
				week: 240
			},
			kmRate1: 0.24,
			kmRate2: 0.15,
			kmThreshold: 300,
			tripIsEligible: (startDate, endDate) => {
				const start = new Date(startDate)

				return [6, 7, 8].includes(start.getMonth()) || // any date in July, August, September
					(start.getMonth() === 5 && start.getDate() >= 15) || // June 15+
					(start.getMonth() === 9 && start.getDate() <= 15) // October 1 to 15
			}
		},
		workday: {
			hourlyRate: 23,
			maxDailyRate: 23, // 23 flat rate for day
			kmRate1: 0, // first 40km free
			kmRate2: 0.35,
			kmThreshold: 40,
			tripIsEligible: (startDate, endDate) => {
				const start = new Date(startDate)
				const end = new Date(endDate)

				return Math.abs(start - end) / (60 * 60 * 1000) <= 10
			}
		}
	};

	// Weekend surcharge rates
	const weekendHourlySurcharge = 0.35;
	const weekendDailySurcharge = 3.5;

	// Parse dates
	const start = new Date(startDate);
	const end = new Date(endDate);

	// Calculate total hours in 15-minute increments
	const totalMilliseconds = end - start;
	const totalMinutes = totalMilliseconds / (1000 * 60);
	const totalHours = Math.ceil(totalMinutes / 15) * 0.25;

	// Calculate number of calendar days the rental spans
	const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
	const totalDays = Math.ceil((endDay - startDay) / (1000 * 60 * 60 * 24)) + 1;

	// Calculate day-by-day breakdown
	function calculateDayByDayBreakdown(startDate, endDate) {
		const days = [];
		let totalWeekendHours = 0;
		let totalWeekdayHours = 0;
		let totalWeekendDays = 0;
		let totalWeekdayDays = 0;

		// Get the start and end of each calendar day in the rental period
		const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
		const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
		const currentDay = new Date(startDay);

		while (currentDay <= endDay) {
			const dayStart = new Date(currentDay);
			const dayEnd = new Date(currentDay);
			dayEnd.setDate(dayEnd.getDate() + 1); // Start of next day

			// Calculate actual start and end times for this day
			const actualStart = currentDay.getTime() === startDay.getTime() ? startDate : dayStart;
			const actualEnd = currentDay.getTime() === endDay.getTime() ? endDate : dayEnd;

			// Calculate hours for this specific day in 15-minute increments
			const dayMilliseconds = actualEnd - actualStart;
			const dayMinutes = dayMilliseconds / (1000 * 60);
			const dayHours = Math.ceil(dayMinutes / 15) * 0.25;

			const dayOfWeek = currentDay.getDay();
			const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;

			days.push({
				date: new Date(currentDay),
				hours: dayHours,
				isWeekend: isWeekendDay
			});

			if (isWeekendDay) {
				totalWeekendHours += dayHours;
				totalWeekendDays++;
			} else {
				totalWeekdayHours += dayHours;
				totalWeekdayDays++;
			}

			currentDay.setDate(currentDay.getDate() + 1);
		}

		return {
			days,
			weekendHours: Math.round(totalWeekendHours * 4) / 4,
			weekdayHours: Math.round(totalWeekdayHours * 4) / 4,
			weekendDays: totalWeekendDays,
			weekdayDays: totalWeekdayDays,
			hasWeekend: totalWeekendHours > 0
		};
	}

	const timeBreakdown = calculateDayByDayBreakdown(start, end);

	// Calculate kilometer costs
	function calculateKmCost(totalKm, plan) {
		if (plan.kmThreshold === Infinity) {
			return totalKm * plan.kmRate1;
		}

		if (totalKm <= plan.kmThreshold) {
			return totalKm * plan.kmRate1;
		} else {
			return (plan.kmThreshold * plan.kmRate1) +
				((totalKm - plan.kmThreshold) * plan.kmRate2);
		}
	}

	// Calculate cost for each plan
	const results = {};

	for (const [planName, plan] of Object.entries(plans)) {
		let totalTimeCost = 0;
		let totalHourlyCost = 0;
		let totalDailyCost = 0;
		let weekdayHourlyCost = 0;
		let weekendHourlyCost = 0;
		let weekdayDailyCost = 0;
		let weekendDailyCost = 0;

		// bail if this plan doesn't qualify to be calculated
		if (plan.tripIsEligible !== true && plan.tripIsEligible(start, end) !== true) {
			continue;
		}

		// Calculate cost for each day individually
		for (const day of timeBreakdown.days) {
			const baseHourlyRate = plan.hourlyRate;
			let baseDailyRate = plan.maxDailyRate;

			// Switch to secondary daily rate if one exists, and we're beyond the first day
			if (Object.hasOwn(plan, 'maxDailyRate2') && timeBreakdown.days.indexOf(day) > 0) {
				baseDailyRate = plan.maxDailyRate2;
			}

			// Apply weekend surcharge if it's a weekend day
			const hourlyRate = day.isWeekend ? baseHourlyRate + weekendHourlySurcharge : baseHourlyRate;
			const dailyRate = day.isWeekend ? baseDailyRate + weekendDailySurcharge : baseDailyRate;

			// Calculate cost for this day using both methods
			const dayHourlyCost = day.hours * hourlyRate;
			const dayDailyCost = dailyRate; // Full daily rate regardless of hours

			// Use the cheaper option for this day
			const dayTimeCost = Math.min(dayHourlyCost, dayDailyCost);
			totalTimeCost += dayTimeCost;

			// Track totals for breakdown display
			totalHourlyCost += dayHourlyCost;
			totalDailyCost += dayDailyCost;

			if (day.isWeekend) {
				weekendHourlyCost += dayHourlyCost;
				weekendDailyCost += dayDailyCost;
			} else {
				weekdayHourlyCost += dayHourlyCost;
				weekdayDailyCost += dayDailyCost;
			}
		}

		// Calculate kilometer cost
		const kmCost = calculateKmCost(totalKm, plan);

		// Total cost
		const totalCost = totalTimeCost + kmCost;

		results[planName] = {
			timeCost: Math.round(totalTimeCost * 100) / 100,
			kmCost: Math.round(kmCost * 100) / 100,
			totalCost: Math.round(totalCost * 100) / 100,
			weekendHours: timeBreakdown.weekendHours,
			weekdayHours: timeBreakdown.weekdayHours,
			weekendDays: timeBreakdown.weekendDays,
			weekdayDays: timeBreakdown.weekdayDays,
			hasWeekend: timeBreakdown.hasWeekend,
			totalHours: totalHours,
			totalDays: totalDays,
			usedDailyRate: totalDailyCost < totalHourlyCost,
			hourlyBreakdown: {
				weekdayCost: Math.round(weekdayHourlyCost * 100) / 100,
				weekendCost: Math.round(weekendHourlyCost * 100) / 100,
				total: Math.round(totalHourlyCost * 100) / 100
			},
			dailyBreakdown: {
				weekdayCost: Math.round(weekdayDailyCost * 100) / 100,
				weekendCost: Math.round(weekendDailyCost * 100) / 100,
				total: Math.round(totalDailyCost * 100) / 100
			},
			dayByDayBreakdown: timeBreakdown.days.map(day => ({
				date: day.date.toISOString().split('T')[0],
				hours: day.hours,
				isWeekend: day.isWeekend,
				hourlyRate: day.isWeekend ? plan.hourlyRate + weekendHourlySurcharge : plan.hourlyRate,
				dailyRate: day.isWeekend ? plan.maxDailyRate + weekendDailySurcharge : plan.maxDailyRate,
				hourlyCost: Math.round(day.hours * (day.isWeekend ? plan.hourlyRate + weekendHourlySurcharge : plan.hourlyRate) * 100) / 100,
				dailyCost: day.isWeekend ? plan.maxDailyRate + weekendDailySurcharge : plan.maxDailyRate,
				actualCost: Math.round(Math.min(
					day.hours * (day.isWeekend ? plan.hourlyRate + weekendHourlySurcharge : plan.hourlyRate),
					day.isWeekend ? plan.maxDailyRate + weekendDailySurcharge : plan.maxDailyRate
				) * 100) / 100
			}))
		};
	}

	return results;
}

function calculateRentalCost(startDate, endDate, totalKm) {
	const baseCosts = calculateBaseRentalCost(startDate, endDate, totalKm)

	let reconciledCosts = {}

	for (const [planName, plan] of Object.entries(baseCosts)) {
		if (planName === "Open" || planName === "Open Plus") {
			reconciledCosts[planName] = plan
			reconciledCosts[planName].reconciliation = "none"
		} else {
			if (plan.totalCost < baseCosts["Open Plus"].totalCost) {
				reconciledCosts[planName] = plan
				reconciledCosts[planName].reconciliation = "none"
			} else {
				reconciledCosts[planName] = baseCosts["Open Plus"]
				reconciledCosts[planName].reconciliation = "switched to Open Plus"
			}
		}
	}

	return reconciledCosts
}


/**
 * Test runner
 */
const tests = JSON.parse(readFileSync('data/indices/rate-tests.json'))

const testEvals = tests.map(test => {
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
					total: estimatesForScenario[estimate.plan].totalCost
				}
			}))
			.map(estimate => ({
				...estimate,
				differenceEstimatedActual: Math.round((estimate.expected.total - estimate.actual.total) * 100) / 100
			}))
			.map(estimate => ({
				...estimate,
				testResult: Math.abs(estimate.differenceEstimatedActual) < 0.1 // NB! This sets our margin of error—10 cents is fine
			}))
	}

	testResults.evalsResult = testResults.testEvals.every(testEval => testEval.testResult)

	return testResults
})

writeFileSync('data/out/rate-tests-evals.json', JSON.stringify(testEvals, null, 2))

let testEvalSummary = {
	passed: testEvals.filter(testEval => testEval.evalsResult === true).map(testEval => testEval.scenario),
	failed: testEvals.filter(testEval => testEval.evalsResult === false).map(testEval => testEval.scenario),
	total: testEvals.length,
}

testEvalSummary.pass = testEvalSummary.passed.length
testEvalSummary.fail = testEvalSummary.failed.length
testEvalSummary.pass_rate = Math.round(testEvalSummary.pass / testEvalSummary.total * 100) / 100

console.log(testEvalSummary)
