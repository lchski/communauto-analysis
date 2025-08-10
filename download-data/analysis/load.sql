-- Load the raw data
CREATE OR REPLACE TABLE rentals AS SELECT * FROM 'data/out/rentals.csv';
CREATE OR REPLACE TABLE bills AS SELECT * FROM 'data/out/billing.csv';

CREATE OR REPLACE TABLE trips AS
	SELECT r.*, b.* EXCLUDE (rental_id, reservation_id, vehicle_nb)
	FROM rentals r
	LEFT JOIN bills b USING (rental_id, reservation_id);


-- Annotate data with the plan and DPF algorithms
COPY (
	SELECT
		rental_id,
		reservation_id,
		date_start,
		date_end_billed: date_start + INTERVAL (duration_min_billed) MINUTES,
		duration_min,
		distance_km
	FROM trips
) TO 'data/out/trips-to-annotate.csv';

--- Call out to node!
.shell node analysis/annotate-trips.js

ALTER TABLE trips
ADD COLUMN cost_est_open DOUBLE;

ALTER TABLE trips
ADD COLUMN cost_est_open_plus DOUBLE;

ALTER TABLE trips
ADD COLUMN cost_est_value DOUBLE;

ALTER TABLE trips
ADD COLUMN cost_est_value_plus DOUBLE;

ALTER TABLE trips
ADD COLUMN cost_est_value_extra DOUBLE;

ALTER TABLE trips
ADD COLUMN fees_dpf_202505_calc DOUBLE;

UPDATE trips
SET 
	cost_est_open = trips_annotated.cost_est_open,
	cost_est_open_plus = trips_annotated.cost_est_open_plus,
	cost_est_value = trips_annotated.cost_est_value,
	cost_est_value_plus = trips_annotated.cost_est_value_plus,
	cost_est_value_extra = trips_annotated.cost_est_value_extra,
	fees_dpf_202505_calc = trips_annotated.fees_dpf_202505_calc
FROM read_csv('data/out/trips-annotated.csv') trips_annotated
WHERE
	trips.rental_id = trips_annotated.rental_id AND
	trips.reservation_id = trips_annotated.reservation_id;
