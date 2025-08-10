CREATE TABLE rentals AS SELECT * FROM 'data/out/rentals.csv';
CREATE TABLE bills AS SELECT * FROM 'data/out/billing.csv';

CREATE TABLE trips AS
	SELECT r.*, b.* EXCLUDE (rental_id, reservation_id, vehicle_nb)
	FROM rentals r
	LEFT JOIN bills b USING (rental_id, reservation_id);


-- shift trips
COPY (
	SELECT
		rental_id,
		reservation_id,
		likely_work_trip: TRUE
	FROM trips
	WHERE
		distance_km >= 10 AND
		distance_km <= 18 AND
		duration_min <= 90 AND
		(date_part('hour', date_start) IN (6, 7, 18, 19))
) TO 'data/indices/likely-work-trips.csv';

ALTER TABLE trips
ADD likely_work_trip BOOLEAN;

UPDATE trips t
SET likely_work_trip = TRUE
FROM read_csv('data/indices/likely-work-trips.csv') lwt
WHERE t.rental_id = lwt.rental_id AND t.reservation_id = lwt.reservation_id AND lwt.likely_work_trip = TRUE;


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


-- newRow.diff_v_to_vp = Math.round(newRow["cost_est_value"] - newRow["cost_est_value_plus"] * 100) / 100
-- newRow.diff_v_to_ve = Math.round(newRow["cost_est_value"] - newRow["cost_est_value_extra"] * 100) / 100


-- ANALYSIS

SELECT
	year: date_trunc('year', date_start)::DATE,
	n_trips: COUNT(*),
	n_trips_longdistance: COUNTIF(rate_type = 'LSR_LongDistanceRate'),
	distance_km: SUM(distance_km),
	rental_cost: ROUND(SUM(rental_cost)),
	FROM trips
	WHERE likely_work_trip IS NOT true
	GROUP BY year
	ORDER BY year;
