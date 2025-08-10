import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

import { calculateDpf } from '../lib/communauto.js';

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
