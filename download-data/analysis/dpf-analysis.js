const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// improved by Claude after I jankily attempted to implement this surprisingly nuanced algorithm
const calculateDpf = (billedMinutes) => {
	const DAILY_CAP = 10;
	const WEEKLY_CAP = 25;
	const START_FEE = 1.25;
	const PER_MINUTE_RATE = 1 / 60; // $1 per hour = 1/60 per minute
	const MINUTES_PER_DAY = 24 * 60;
	const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

	if (billedMinutes <= 0) return 0;

	let totalCost = 0;
	let remainingMinutes = billedMinutes;

	// Process complete weeks first
	const completeWeeks = Math.floor(billedMinutes / MINUTES_PER_WEEK);
	totalCost += completeWeeks * WEEKLY_CAP;
	remainingMinutes -= completeWeeks * MINUTES_PER_WEEK;

	if (remainingMinutes <= 0) return totalCost;

	// For the incomplete week
	let incompleteWeekCost = 0;

	// If this is the very first week of the trip (no complete weeks), apply start fee
	if (completeWeeks === 0) {
		// First day (or partial first day) gets the start fee
		const firstDayMinutes = Math.min(remainingMinutes, MINUTES_PER_DAY);
		const firstDayCost = START_FEE + (firstDayMinutes * PER_MINUTE_RATE);
		incompleteWeekCost += Math.min(firstDayCost, DAILY_CAP);
		remainingMinutes -= firstDayMinutes;

		// Subsequent complete days in the incomplete week
		const subsequentCompleteDays = Math.floor(remainingMinutes / MINUTES_PER_DAY);
		incompleteWeekCost += subsequentCompleteDays * DAILY_CAP;
		remainingMinutes -= subsequentCompleteDays * MINUTES_PER_DAY;

		// Final partial day (if any) - no start fee, just per-minute rate
		if (remainingMinutes > 0) {
			const finalPartialDayCost = remainingMinutes * PER_MINUTE_RATE;
			incompleteWeekCost += Math.min(finalPartialDayCost, DAILY_CAP);
		}
	} else {
		// This is an incomplete week after complete weeks - no start fee needed
		// All days/partial days just use per-minute rate
		const completeDays = Math.floor(remainingMinutes / MINUTES_PER_DAY);
		incompleteWeekCost += completeDays * DAILY_CAP;
		remainingMinutes -= completeDays * MINUTES_PER_DAY;

		// Final partial day (if any)
		if (remainingMinutes > 0) {
			const partialDayCost = remainingMinutes * PER_MINUTE_RATE;
			incompleteWeekCost += Math.min(partialDayCost, DAILY_CAP);
		}
	}

	// Apply weekly cap to the incomplete week
	totalCost += Math.min(incompleteWeekCost, WEEKLY_CAP);

	return Math.round(totalCost * 100) / 100; // Round to 2 decimal places
}

const inputPath = path.join('data', 'out', 'dpf-fees-to-calc.csv');
const outputPath = path.join('data', 'indices', 'dpf-fees-calculated.csv');

// Read and parse CSV
const input = fs.readFileSync(inputPath, 'utf8');
const records = parse(input, { columns: true });

// Calculate and add column
const updated = records.map(row => ({
  ...row,
  fees_dpf_202505_calc: calculateDpf(parseFloat(row.duration_min))
}));

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
