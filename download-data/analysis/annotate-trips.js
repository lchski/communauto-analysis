import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

import { calculateRentalCost, calculateDpf } from '../lib/communauto.js'

const inputPath = path.join('data', 'out', 'trips-to-annotate.csv');
const outputPath = path.join('data', 'out', 'trips-annotated.csv');

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

		newRow['cost_est_' + planName.toLowerCase().replaceAll(' ', '_')] = plan.totalCost
	}

    newRow.fees_dpf_202505_calc = calculateDpf(parseFloat(row.duration_min))

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

