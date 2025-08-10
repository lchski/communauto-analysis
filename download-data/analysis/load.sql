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


-- data to run through the DPF algorithm
COPY (SELECT rental_id, reservation_id, date_start, trip_note, likely_work_trip, duration_min, fees_dpf FROM trips) TO 'data/out/dpf-fees-to-calc.csv';

-- data to run through the pricing algorithm
COPY (
	SELECT
		rental_id,
		reservation_id,
		year: date_trunc('year', date_start)::DATE,
		date_start,
		date_end,
		date_end_billed: date_start + INTERVAL (duration_min_billed) MINUTES,
		trip_note,
		rate_type,
		likely_work_trip,
		duration_min,
		duration_min_billed,
		distance_km,
		cost_total_from_plan: cost_duration + cost_distance
	FROM trips
) TO 'data/out/trips-to-calc.csv';


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
