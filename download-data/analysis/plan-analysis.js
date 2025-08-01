function calculateRentalCost(startDate, endDate, totalKm) {
	// Plan configurations
	const plans = {
		value: {
			hourlyRate: 4.5,
			maxDailyRate: 35,
			kmRate1: 0.47,
			kmRate2: 0.34,
			kmThreshold: 50
		},
		valuePlus: {
			hourlyRate: 3.9,
			maxDailyRate: 29,
			kmRate1: 0.39,
			kmRate2: 0.30,
			kmThreshold: 50
		},
		valueExtra: {
			hourlyRate: 3.6,
			maxDailyRate: 25,
			kmRate1: 0.30,
			kmRate2: 0.30, // Same rate for all km
			kmThreshold: Infinity // No threshold change
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

	// Calculate weekend vs weekday time breakdown
	function calculateWeekendBreakdown(startDate, endDate) {
		let weekendHours = 0;
		let weekdayHours = 0;
		let weekendDays = 0;
		let weekdayDays = 0;

		// Calculate hourly breakdown
		const current = new Date(startDate);
		const end = new Date(endDate);

		while (current < end) {
			const nextHour = new Date(current);
			nextHour.setTime(current.getTime() + (15 * 60 * 1000)); // 15-minute increments

			const endTime = nextHour > end ? end : nextHour;
			const incrementHours = (endTime - current) / (1000 * 60 * 60);

			const dayOfWeek = current.getDay();
			if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday = 0, Saturday = 6
				weekendHours += incrementHours;
			} else {
				weekdayHours += incrementHours;
			}

			current.setTime(nextHour.getTime());
		}

		// Calculate daily breakdown
		const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
		const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
		const currentDay = new Date(startDay);

		while (currentDay <= endDay) {
			const dayOfWeek = currentDay.getDay();
			if (dayOfWeek === 0 || dayOfWeek === 6) {
				weekendDays++;
			} else {
				weekdayDays++;
			}
			currentDay.setDate(currentDay.getDate() + 1);
		}

		return {
			weekendHours: Math.round(weekendHours * 4) / 4, // Round to nearest 0.25
			weekdayHours: Math.round(weekdayHours * 4) / 4,
			weekendDays,
			weekdayDays,
			hasWeekend: weekendHours > 0
		};
	}

	const timeBreakdown = calculateWeekendBreakdown(start, end);

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
		// Calculate time-based cost
		const baseHourlyRate = plan.hourlyRate + (isWeekend ? weekendHourlySurcharge : 0);
		const baseDailyRate = plan.maxDailyRate + (isWeekend ? weekendDailySurcharge : 0);

		const hourlyCost = totalHours * baseHourlyRate;
		const dailyCost = totalDays * baseDailyRate;

		// Use the cheaper of hourly vs daily rate
		const timeCost = Math.min(hourlyCost, dailyCost);

		// Calculate kilometer cost
		const kmCost = calculateKmCost(totalKm, plan);

		// Total cost
		const totalCost = timeCost + kmCost;

		results[planName] = {
			timeCost: Math.round(timeCost * 100) / 100,
			kmCost: Math.round(kmCost * 100) / 100,
			totalCost: Math.round(totalCost * 100) / 100,
			isWeekend: isWeekend,
			totalHours: totalHours,
			totalDays: totalDays,
			usedDailyRate: dailyCost < hourlyCost
		};
	}

	return results;
}
