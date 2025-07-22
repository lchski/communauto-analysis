source .env

if [[ -z "$BEARER_TOKEN" ]]; then
    echo "BEARER_TOKEN not set"
    exit 1
fi
if [[ -z "$N_TRANSACTIONS" ]]; then
    echo "N_TRANSACTIONS not set"
    exit 1
fi

OUT_DIR="data/communauto.com"
TIMESTAMP_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo

if [[ -z "$TRANSACTIONS_FILENAME" ]]; then
    TRANSACTIONS_FILE="$OUT_DIR/transactions/$TIMESTAMP_START.json"

    echo "no TRANSACTIONS_FILENAME specified, downloading transaction list to:\n\t$TRANSACTIONS_FILE\n"

    curl "https://restapifrontoffice.reservauto.net/api/v2/Billing/Transaction?CurrentPage=1&NbItemsPerPage=$N_TRANSACTIONS&" \
        --compressed \
        -H "authorization: Bearer $BEARER_TOKEN" | jq > $TRANSACTIONS_FILE
else
    TRANSACTIONS_FILE="$OUT_DIR/transactions/$TRANSACTIONS_FILENAME.json"

    echo "TRANSACTIONS_FILENAME specified, using that for transaction list:\n\t$TRANSACTIONS_FILE\n"
fi

###
# Downloading per-trip details
###

if [[ -z "$WCF_COOKIE" ]]; then
    echo "WCF_COOKIE not set"
    exit 1
fi

for rental_id in $(jq -r '.transactions[] | select(.type == "StationBasedRental") | .rentalId' $TRANSACTIONS_FILE); do
    RENTAL_FILE="$OUT_DIR/rentals/$rental_id.json"

    echo "\nProcessing rental ID: $rental_id"

    if [ ! -f $RENTAL_FILE ]; then
        echo "rental file not found, downloading"
        curl "https://restapifrontoffice.reservauto.net/api/v2/Rental/$rental_id/StationBased" \
            -s \
            --compressed \
            -H "authorization: Bearer $BEARER_TOKEN" | jq > $RENTAL_FILE
        sleep 3
    else
        echo "rental file found, moving ahead"
    fi
    
    # curl "https://www.reservauto.net/WCF/Core/CoreService.svc/Get?&apiUrl=%2Fapi%2FBilling%2FReservation%2F$rental_id" \
    #     --compressed \
    #     -H "Cookie: $WCF_COOKIE"
done
