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



-- ANALYSIS

--- TODO: add break-even thresholds per plan
--- TODO: add months / pro-rate values
WITH t AS (
	SELECT
		trips.*,
		diff_v_to_vp: round(trips.cost_est_value - trips.cost_est_value_plus, 2),
		diff_v_to_ve: round(trips.cost_est_value - trips.cost_est_value_extra, 2)
	FROM trips
)
SELECT
	year: date_trunc('year', date_start)::DATE,
	n_trips: COUNT(*),
	n_trips_longdistance: COUNTIF(rate_type = 'LSR_LongDistanceRate'),
	distance_km: sum(distance_km),
	rental_cost: round(sum(rental_cost), 2),
	diff_v_to_vp: round(sum(diff_v_to_vp)),
	diff_v_to_ve: round(sum(diff_v_to_ve)),
	FROM t
	WHERE likely_work_trip IS NOT true
	GROUP BY year
	ORDER BY year;
