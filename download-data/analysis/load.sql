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
		date_start,
		date_end,
		date_end_billed: date_start + INTERVAL (duration_min_billed) MINUTES,
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


CREATE TABLE plans AS SELECT * FROM 'data/indices/plan-rates.csv';

SELECT
	rental_id,
	reservation_id,
	date_start,
	year: date_trunc('year', date_start)::DATE,
	rate_type,
	package_name,
	likely_work_trip,
	distance_km,
	cost_distance,
	plans.*,
	kms_base: least(distance_km, plans.km_threshold),
	kms_additional: greatest(distance_km - plans.km_threshold, 0),
	cost_kms_base: round(kms_base * plans.km_rate_base, 2),
	cost_kms_additional: round(kms_additional * plans.km_rate_additional, 2),
	cost_kms_total: round(cost_kms_base + cost_kms_additional, 2)
FROM trips
CROSS JOIN plans
ORDER BY rental_id;

SELECT 
	* EXCLUDE(
		km_rate_base,
		km_rate_additional,
		km_threshold,
		kms_base,
		kms_additional,
		cost_kms_base,
		cost_kms_additional
	)
FROM
	(
		SELECT
			rental_id,
			reservation_id,
			date_start,
			year: date_trunc('year', date_start)::DATE,
			rate_type,
			package_name,
			likely_work_trip,
			distance_km,
			cost_distance,
			plans.*,
			kms_base: least(distance_km, plans.km_threshold),
			kms_additional: greatest(distance_km - plans.km_threshold, 0),
			cost_kms_base: round(kms_base * plans.km_rate_base, 2),
			cost_kms_additional: round(kms_additional * plans.km_rate_additional, 2),
			cost_kms_total: round(cost_kms_base + cost_kms_additional, 2)
		FROM trips
		CROSS JOIN plans
		ORDER BY rental_id
	)
WHERE
	plan in ('value', 'value-plus', 'open-plus') AND
	package_name = 'Value' AND
	rate_type != 'LSR_LongDistanceRate' AND
	likely_work_trip is not true;

SELECT
	year,
	plan,
	n_trips: COUNT(*),
	cost_kms_total: round(SUM(cost_kms_total), 2)
FROM (
	SELECT 
		* EXCLUDE(
			package_name,
			rate_type,
			likely_work_trip,
			cost_distance,
			km_rate_base,
			km_rate_additional,
			km_threshold,
			kms_base,
			kms_additional,
			cost_kms_base,
			cost_kms_additional
		)
	FROM
		(
			SELECT
				rental_id,
				reservation_id,
				date_start,
				year: date_trunc('year', date_start)::DATE,
				rate_type,
				package_name,
				likely_work_trip,
				distance_km,
				cost_distance,
				plans.*,
				kms_base: least(distance_km, plans.km_threshold),
				kms_additional: greatest(distance_km - plans.km_threshold, 0),
				cost_kms_base: round(kms_base * plans.km_rate_base, 2),
				cost_kms_additional: round(kms_additional * plans.km_rate_additional, 2),
				cost_kms_total: round(cost_kms_base + cost_kms_additional, 2)
			FROM trips
			CROSS JOIN plans
			ORDER BY rental_id
		)
	WHERE
		plan in ('value', 'value-plus') AND
		package_name = 'Value' AND
		rate_type != 'LSR_LongDistanceRate' AND
		likely_work_trip is not true
)
GROUP BY year, plan
ORDER BY year, plan
;



-- value vs value plus: 12.5 - 5 = 7.5 difference / month (90 difference / year)
