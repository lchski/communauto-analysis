source .env

if [[ -z "$BEARER_TOKEN" ]]; then
    echo "BEARER_TOKEN not set"
    exit 1
fi
if [[ -z "$N_TRANSACTIONS" ]]; then
    echo "N_TRANSACTIONS not set"
    exit 1
fi

OUT_DIR="data/communauto.com/transactions"
TIMESTAMP_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo

if [[ -z "$TRANSACTIONS_FILENAME" ]]; then
    TRANSACTIONS_FILE="$OUT_DIR/$TIMESTAMP_START.json"

    echo "no TRANSACTIONS_FILENAME specified, downloading transaction list to:\n\t$TRANSACTIONS_FILE\n"

    curl "https://restapifrontoffice.reservauto.net/api/v2/Billing/Transaction?CurrentPage=1&NbItemsPerPage=$N_TRANSACTIONS&" \
        --compressed \
        -H "authorization: Bearer $BEARER_TOKEN" | jq > $TRANSACTIONS_FILE
else
    TRANSACTIONS_FILE="$OUT_DIR/$TRANSACTIONS_FILENAME.json"

    echo "TRANSACTIONS_FILENAME specified, using that for transaction list:\n\t$TRANSACTIONS_FILE\n"
fi


