## Steps

Setup:

0. Log in and open the console
1. Navigate to the [transactions page](https://ontario.client.reservauto.net/account/transactions) and open the “Transactions” tab
2. Find the XHR GET request to `Transaction` and pull the Bearer value from the request `authorization` header (make sure to “Copy value” to get the full string), update the `.env` file setting with that value
3. Navigate to the [trips page](https://ontario.client.reservauto.net/myTrips), select “Past” reservations, and click a trip cost URL
4. Find the XHR GET request to `Get` and pull the cookie value from the request, update the `.env` file setting

Download and extract:

1. `./download-transactions.sh`
2. `./extract-data.sh`
