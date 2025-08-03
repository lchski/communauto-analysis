function calculateRentalCost(startDate, endDate, totalKm) {
	// Plan configurations
	const plans = {
		open: {
			hourlyRate: 13,
			maxDailyRate: 55,
			kmRate1: 0, // first 75km free
			kmRate2: 0.30,
			kmThreshold: 75,
			tripIsEligible: true
		},
		openPlus: {
			hourlyRate: 7.5,
			maxDailyRate: 50,
			maxDailyRate2: 35,
			kmRate1: 0.25,
			kmRate2: 0.25, // same rate for all km
			kmThreshold: Infinity, // no threshold change
			tripIsEligible: true
		},
		value: {
			hourlyRate: 4.5,
			maxDailyRate: 35,
			kmRate1: 0.47,
			kmRate2: 0.34,
			kmThreshold: 50,
			tripIsEligible: true
		},
		valuePlus: {
			hourlyRate: 3.9,
			maxDailyRate: 29,
			kmRate1: 0.39,
			kmRate2: 0.30,
			kmThreshold: 50,
			tripIsEligible: true
		},
		valueExtra: {
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
			tripIsEligible: true
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
			tripIsEligible: true
		},
		workday: {
			hourlyRate: 23,
			maxDailyRate: 23, // 23 flat rate for day
			kmRate1: 0, // first 40km free
			kmRate2: 0.35,
			kmThreshold: 40,
			tripIsEligible: (startDate, endDate) => Math.abs(startDate - endDate) / (60 * 60 * 1000)
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

// Example usage:
console.log("=== Example 1: Weekday short trip (2.25 hours) ===");
const trip1 = calculateRentalCost('2024-03-05T10:00:00', '2024-03-05T12:05:00', 30);
console.log(trip1);

console.log("\n=== Example 2: Weekend long trip (33.75 hours) ===");
const trip2 = calculateRentalCost('2024-03-09T09:00:00', '2024-03-10T18:45:00', 120);
console.log(trip2);

console.log("\n=== Example 3: Multi-day trip spanning weekend ===");
const trip3 = calculateRentalCost('2024-03-08T14:30:00', '2024-03-11T10:15:00', 200);
console.log(trip3);

// Helper function to display results in a formatted way
function displayResults(startDate, endDate, totalKm) {
	console.log(`\n=== Trip: ${startDate} to ${endDate}, ${totalKm}km ===`);
	const results = calculateRentalCost(startDate, endDate, totalKm);

	console.log(`Duration: ${results.value.totalHours} hours across ${results.value.totalDays} day(s)`);
	console.log(`Time breakdown: ${results.value.weekdayHours}h weekday, ${results.value.weekendHours}h weekend`);
	console.log(`Day breakdown: ${results.value.weekdayDays} weekday(s), ${results.value.weekendDays} weekend day(s)`);
	console.log('');

	for (const [plan, data] of Object.entries(results)) {
		console.log(`${plan.toUpperCase()}:`);
		if (data.usedDailyRate) {
			console.log(`  Time cost: ${data.timeCost} (daily rate: ${data.dailyBreakdown.weekdayCost} weekday + ${data.dailyBreakdown.weekendCost} weekend)`);
		} else {
			console.log(`  Time cost: ${data.timeCost} (hourly rate: ${data.hourlyBreakdown.weekdayCost} weekday + ${data.hourlyBreakdown.weekendCost} weekend)`);
		}
		console.log(`  KM cost: ${data.kmCost}`);
		console.log(`  TOTAL: ${data.totalCost}`);
		console.log('');
	}
}

// Test with the helper function - showing weekend/weekday breakdown
// displayResults('2024-03-08T22:00:00', '2024-03-11T10:30:00', 75); // Friday night to Monday morning
displayResults('2025-08-07T10:00:00', '2025-08-07T12:15:00', 30);

async function queryCommunautoPrice(startDate, endDate, totalKm) {
	const qry = await fetch(`https://restapifrontoffice.reservauto.net/api/v2/Billing/TripCostEstimate?CityId=103&StartDate=${encodeURIComponent(startDate)}-04%3A00&EndDate=${encodeURIComponent(endDate)}-04%3A00&Distance=${totalKm}&AcceptLanguage=en`, {
		"method": "GET",
	});

	const prices = await qry.json()

	console.log(
		prices.tripPackageCostEstimateList
			.filter(estimate => estimate.serviceType === 'StationBased')
			.map(estimate => ({
				plan: estimate.localizedPlanTypeName,
				rate: estimate.localizedBillingRateName,
				duration: estimate.durationCost,
				distance: estimate.distanceCost,
				total: estimate.totalCost
			}))
	)

	return tripPackageCostEstimateList
		.filter(estimate => estimate.serviceType === 'StationBased')
}

testCases = [
	['2025-08-07T10:00:00', '2025-08-07T12:15:00', 30],
	['']
]

await queryCommunautoPrice('2025-08-07T10:00:00', '2025-08-07T12:15:00', 30)

