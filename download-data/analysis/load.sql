CREATE TABLE rentals AS SELECT * FROM 'data/out/rentals.csv';
CREATE TABLE bills AS SELECT * FROM 'data/out/billing.csv';

CREATE TABLE trips AS
	SELECT r.*, b.* EXCLUDE (rental_id, reservation_id, vehicle_nb)
	FROM rentals r
	LEFT JOIN bills b USING (rental_id, reservation_id);