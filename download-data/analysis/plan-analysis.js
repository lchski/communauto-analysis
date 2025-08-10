import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

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

			// bail if Sunday or Saturday
			if ([0, 6].includes(start.getDay())) {
				return false
			}

			return Math.abs(start - end) / (60 * 60 * 1000) <= 10
		}
	}
};

function calculateBaseRentalCost(startDate, endDate, totalKm) {
	// Weekend surcharge rates
	const weekendHourlySurcharge = 0.35;
	const weekendDailySurcharge = 3.5;

	// Parse dates
	const start = new Date(startDate);
	const end = new Date(endDate);

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

	// Helper function to get the daily rate, accounting for long distance plans
	function getDailyRate(plan, dayIndex, isWeekend) {
		let baseDailyRate = plan.maxDailyRate;

		// Handle complex maxDailyRate structure (long distance plans)
		if (typeof plan.maxDailyRate === 'object') {
			if (dayIndex === 0) {
				// First day
				baseDailyRate = plan.maxDailyRate.firstDay;
			} else {
				// Additional days - use additionalDay rate
				baseDailyRate = plan.maxDailyRate.additionalDay;
			}
		}
		// Handle non-long distance plans with maxDailyRate2
		else if (Object.hasOwn(plan, 'maxDailyRate2') && dayIndex > 0) {
			baseDailyRate = plan.maxDailyRate2;
		}

		// Apply weekend surcharge
		return isWeekend ? baseDailyRate + weekendDailySurcharge : baseDailyRate;
	}

	// Helper function to calculate time cost for long distance plans with weekly caps
	function calculateLongDistanceTimeCost(plan, days) {
		const weeklyRate = plan.maxDailyRate.week;
		let totalCost = 0;
		let weeklyAccumulator = 0;

		for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
			const day = days[dayIndex];

			// Check if we've completed a week (7 days)
			if (dayIndex > 0 && dayIndex % 7 === 0) {
				// Apply weekly cap to the previous week
				const weekCost = Math.min(weeklyAccumulator, weeklyRate);
				totalCost += weekCost;

				// Reset for new week
				weeklyAccumulator = 0;
			}

			// Calculate cost for this day
			const hourlyRate = day.isWeekend ? plan.hourlyRate + weekendHourlySurcharge : plan.hourlyRate;
			const dailyRate = getDailyRate(plan, dayIndex, day.isWeekend);

			const dayHourlyCost = day.hours * hourlyRate;
			const dayTimeCost = Math.min(dayHourlyCost, dailyRate);

			weeklyAccumulator += dayTimeCost;
		}

		// Handle the final partial or complete week
		if (weeklyAccumulator > 0) {
			const finalWeekCost = Math.min(weeklyAccumulator, weeklyRate);
			totalCost += finalWeekCost;
		}

		return totalCost;
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

		// Check if this is a long distance plan with weekly caps
		const isLongDistancePlan = typeof plan.maxDailyRate === 'object' && plan.maxDailyRate.week;

		if (isLongDistancePlan) {
			// Use special calculation for long distance plans
			totalTimeCost = calculateLongDistanceTimeCost(plan, timeBreakdown.days);
		} else {
			// Normal calculation for simple plans
			for (const day of timeBreakdown.days) {
				const dayIndex = timeBreakdown.days.indexOf(day);
				const hourlyRate = day.isWeekend ? plan.hourlyRate + weekendHourlySurcharge : plan.hourlyRate;
				const dailyRate = getDailyRate(plan, dayIndex, day.isWeekend);

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
		}

		// Calculate kilometer cost
		const kmCost = calculateKmCost(totalKm, plan);

		// Total cost
		const totalCost = totalTimeCost + kmCost;

		results[planName] = {
			timeCost: Math.round(totalTimeCost * 100) / 100,
			kmCost: Math.round(kmCost * 100) / 100,
			totalCost: Math.round(totalCost * 100) / 100,
			dayByDayBreakdown: timeBreakdown.days.map((day, dayIndex) => {
				const hourlyRate = day.isWeekend ? plan.hourlyRate + weekendHourlySurcharge : plan.hourlyRate;
				const dailyRate = getDailyRate(plan, dayIndex, day.isWeekend);
				const hourlyCost = day.hours * hourlyRate;
				const actualCost = Math.min(hourlyCost, dailyRate);

				return {
					date: day.date.toISOString().split('T')[0],
					hours: day.hours,
					isWeekend: day.isWeekend,
					hourlyRate: hourlyRate,
					dailyRate: dailyRate,
					hourlyCost: Math.round(hourlyCost * 100) / 100,
					dailyCost: dailyRate,
					actualCost: Math.round(actualCost * 100) / 100
				};
			})
		};
	}

	return results;
}

function calculateRentalCost(startDate, endDate, totalKm) {
	const baseCosts = calculateBaseRentalCost(startDate, endDate, totalKm)

	let reconciledCosts = {}

	// check Value plans against Open Plus
	for (const [planName, plan] of Object.entries(baseCosts)) {
		// Open and Open Plus don't get rate changes, so just keep as-is
		if (planName === "Open" || planName === "Open Plus") {
			reconciledCosts[planName] = plan
			reconciledCosts[planName].reconciliation = "none"

			continue
		}

		if (plan.totalCost < baseCosts["Open Plus"].totalCost) {
			reconciledCosts[planName] = plan
			reconciledCosts[planName].reconciliation = "none"

			continue
		}

		reconciledCosts[planName] = baseCosts["Open Plus"]
		reconciledCosts[planName].reconciliation = "switched to Open Plus"
	}

	// check Value plans for long distance
	for (const [planName, plan] of Object.entries(reconciledCosts)) {
		// Open and Open Plus don't get rate changes, so just keep as-is
		if (planName === "Open" || planName === "Open Plus") {
			continue
		}

		if (Object.hasOwn(baseCosts, "longDistanceLow") && plan.totalCost > baseCosts["longDistanceLow"].totalCost) {
			reconciledCosts[planName] = baseCosts["longDistanceLow"]
			reconciledCosts[planName].reconciliation = "switched to Long Distance (low season)"

			continue
		}

		if (Object.hasOwn(baseCosts, "longDistanceHigh") && plan.totalCost > baseCosts["longDistanceHigh"].totalCost) {
			reconciledCosts[planName] = baseCosts["longDistanceHigh"]
			reconciledCosts[planName].reconciliation = "switched to Long Distance (high season)"

			continue
		}
	}

	// check Value Extra plan for workday
	for (const [planName, plan] of Object.entries(reconciledCosts)) {
		// check if a workday rate has been calculated
		if (!Object.hasOwn(baseCosts, "workday")) {
			continue
		}

		// only Value Extra gets the workday rate
		if (planName !== "Value Extra") {
			continue
		}

		if (plan.totalCost > baseCosts["workday"].totalCost) {
			reconciledCosts[planName] = baseCosts["workday"]
			reconciledCosts[planName].reconciliation = "switched to Workday"

			continue
		}
	}

	return reconciledCosts
}


/**
 * Test runner
 */
const tests = JSON.parse(fs.readFileSync('data/indices/rate-tests.json'))

const testsOverride = JSON.parse(fs.readFileSync('data/indices/rate-tests-override.json', {encoding: "utf-8"}).replaceAll(`'`, `"`))

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

let testEvalSummary = {
	passed: testEvals.filter(testEval => testEval.evalsResult === true).map(testEval => testEval.scenario),
	failed: testEvals.filter(testEval => testEval.evalsResult === false).map(testEval => testEval.scenario),
	total: testEvals.length,
}

testEvalSummary.pass = testEvalSummary.passed.length
testEvalSummary.fail = testEvalSummary.failed.length
testEvalSummary.pass_rate = Math.round(testEvalSummary.pass / testEvalSummary.total * 100) / 100

// console.log(testEvalSummary)



/**
 * Compute on historical data
 */
const inputPath = path.join('data', 'out', 'trips-to-calc.csv');
const outputPath = path.join('data', 'out', 'trips-calculated.csv');

// Read and parse CSV
const input = fs.readFileSync(inputPath, 'utf8');
const records = parse(input, { columns: true });

// Calculate and add column
const updated = records.map(row => {
	let newRow = row;

	const estimatesForRow = calculateRentalCost(row.date_start, row.date_end_billed, row.distance_km)

	for (const [planName, plan] of Object.entries(estimatesForRow)) {
		// skip extra plans used just for calculation
		if (! ["Open", "Open Plus", "Value", "Value Plus", "Value Extra"].includes(planName)) {
			continue
		}

		newRow[planName] = plan.totalCost
	}

	newRow.diff_v_to_vp = newRow["Value"] - newRow["Value Plus"]
	newRow.diff_v_to_ve = newRow["Value"] - newRow["Value Extra"]

	return newRow
});

// Stringify and write to file
const output = stringify(updated, {
  header: true,
  columns: Object.keys(updated[0])
});

// Ensure directory exists
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

// Write to output file
fs.writeFileSync(outputPath, output);
console.log(`✅ Wrote ${updated.length} rows to ${outputPath}`);

