DATA_INPUT_DIR="data/communauto.com"
DATA_OUTPUT_DIR="data/out"

mkdir -p $DATA_OUTPUT_DIR

echo "rentalId,reservationId,date,amount" > "$DATA_OUTPUT_DIR/dpf-fees.csv"
jq -r '[.rentalId, .reservationId, .reservationStartDate, (.fees[] | select(.feeType == "CollisionDamagesWaiverFee") | .amount)] | @csv' $DATA_INPUT_DIR/billing/*.json >> "$DATA_OUTPUT_DIR/dpf-fees.csv"