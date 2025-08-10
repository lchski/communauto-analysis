import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

import { calculateRentalCost } from '../lib/communauto.js'

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

