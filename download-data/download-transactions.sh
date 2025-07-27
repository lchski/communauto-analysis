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

    transactions_response=$(curl "https://restapifrontoffice.reservauto.net/api/v2/Billing/Transaction?CurrentPage=1&NbItemsPerPage=$N_TRANSACTIONS&" \
        --compressed \
        -w "%{http_code}" \
        -H "authorization: Bearer $BEARER_TOKEN")

    transactions_http_code="${transactions_response: -3}"
    transactions_response_body="${transactions_response%???}"

    if [ "$transactions_http_code" -eq 200 ]; then
        # Double-check that it's valid JSON
        if echo "$transactions_response_body" | jq empty 2>/dev/null; then
            echo "$transactions_response_body" | jq > $TRANSACTIONS_FILE
            echo "successfully transaction list"
        else
            echo "Error: Received HTTP 200 but invalid JSON for transactions list"
            exit 1
        fi
    elif [ "$transactions_http_code" -eq 401 ]; then
        echo "Error: Authentication failed (401) for transactions list"
        echo "You may need to refresh your bearer token"
        exit 1
    else
        echo "Error: HTTP $transactions_http_code response for transactions list"
        exit 1
    fi
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

        response=$(curl "https://restapifrontoffice.reservauto.net/api/v2/Rental/$rental_id/StationBased" \
            -s \
            --compressed \
            -w "%{http_code}" \
            -H "authorization: Bearer $BEARER_TOKEN")

        http_code="${response: -3}"
        response_body="${response%???}"

        if [ "$http_code" -eq 200 ]; then
            # Double-check that it's valid JSON
            if echo "$response_body" | jq empty 2>/dev/null; then
                echo "$response_body" | jq > "$RENTAL_FILE"
                echo "Successfully downloaded rental data"
            else
                echo "Error: Received HTTP 200 but invalid JSON for rental ID $rental_id"
                continue
            fi
        elif [ "$http_code" -eq 401 ]; then
            echo "Error: Authentication failed (401) for rental ID $rental_id"
            echo "You may need to refresh your bearer token"

            # NB: we don't exit entirely, because transactions from family members on the account will error out with a 401
            continue
        else
            echo "Error: HTTP $http_code response for rental ID $rental_id"
            continue
        fi

        sleep 3
    else
        echo "rental file found, moving ahead"
    fi

    # curl "https://www.reservauto.net/WCF/Core/CoreService.svc/Get?&apiUrl=%2Fapi%2FBilling%2FReservation%2F$rental_id" \
    #     --compressed \
    #     -H "Cookie: $WCF_COOKIE"
done

for rental_file in $OUT_DIR/rentals/*.json; do
    # Extract the rental number from the file
    rental_nb=$(jq -r '.rentalNb' "$rental_file")

    if [ "$rental_nb" = "null" ] || [ -z "$rental_nb" ]; then
        echo "Skipping $rental_file - no rentalNb found"
        continue
    fi

    echo "\nProcessing rental number: $rental_nb"

    # Create billing directory if it doesn't exist
    mkdir -p "$OUT_DIR/billing"
    billing_file="$OUT_DIR/billing/${rental_nb}.json"

    if [ ! -f "$billing_file" ]; then
        echo "Billing file not found, downloading"

        # Use temporary file to avoid needing to echo
        temp_response=$(mktemp)

        http_code=$(curl "https://www.reservauto.net/WCF/Core/CoreService.svc/Get?&apiUrl=%2Fapi%2FBilling%2FReservation%2F$rental_nb" \
            -s \
            --compressed \
            -w "%{http_code}" \
            -o "$temp_response" \
            -H "Cookie: $WCF_COOKIE")

        if [ "$http_code" -eq 200 ]; then
            # Extract the `d` property and parse its content as JSON
            parsed_data=$(jq -r '.d' "$temp_response" | jq .)

            if [ $? -eq 0 ] && [ "$parsed_data" != "null" ]; then
                echo "$parsed_data" > "$billing_file"
                echo "Successfully saved billing data to $billing_file"
            else
                echo "Error: Failed to parse response data for rental $rental_nb"
                echo "Response was: $response_body"
            fi
        else
            echo "Error: HTTP $http_code response for rental number $rental_nb"
        fi

        # Clean up temp file
        rm "$temp_response"

        sleep 3
    else
        echo "Billing file already exists: $billing_file"
    fi
done
