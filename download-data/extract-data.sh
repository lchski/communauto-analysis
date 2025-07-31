DATA_INPUT_DIR="data/communauto.com"
DATA_OUTPUT_DIR="data/out"

mkdir -p $DATA_OUTPUT_DIR

echo "rental_id,reservation_id,date_start,date_end,vehicle_id,vehicle_nb,station_id,station_nb,rental_cost,rental_owner_customer_id,nb_receipts" > "$DATA_OUTPUT_DIR/rentals.csv"
jq -r -f scripts/rentals.jq $DATA_INPUT_DIR/rentals/*.json >> "$DATA_OUTPUT_DIR/rentals.csv"


echo "rental_id,reservation_id,date_reservation,vehicle_nb,duration_min,duration_min_billed,distance_km,rate_type,package_name,date_transaction,cost_total,cost_duration,cost_distance,cost_fees,fees_dpf,cost_credits,credits_n,tax_hst,purchase_reimbursement" > "$DATA_OUTPUT_DIR/billing.csv"
jq -r -f scripts/billing.jq $DATA_INPUT_DIR/billing/*.json >> "$DATA_OUTPUT_DIR/billing.csv"



# stations!
