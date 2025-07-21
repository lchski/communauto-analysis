Swagger: https://restapifrontoffice.reservauto.net/ReservautoFrontOffice/index.html

(or: https://web.archive.org/web/*/http://restapifrontoffice.reservauto.net/* includes JSON schema for Billing, Branch, GeneralAPI, and Vehicle)

## List trips

- Load <https://ontario.client.reservauto.net/account/transactions>
- XHR call to https://restapifrontoffice.reservauto.net/api/v2/Billing/Transaction?CurrentPage=1&NbItemsPerPage=20& will get the list of reservations
    - can bump `NbItemsPerPage` as high as you like
    - only required parameter is the `Bearer` header: `-H 'authorization: Bearer …`
    ```
curl 'https://restapifrontoffice.reservauto.net/api/v2/Billing/Transaction?CurrentPage=1&NbItemsPerPage=500&' \
    --compressed \
    -H 'authorization: Bearer …'
    ```
- XHR call to https://restapifrontoffice.reservauto.net/api/v2/Rental/${id}$/StationBased will get details for a specific trip, including the `rentalNb` property which is used by the old API for trip details


## Get trip details

To get granular per-trip data:
- load the old-school “my trips” page: https://ontario.client.reservauto.net/myTrips
- click an entry in the “Trip Cost” column
- use that XHR request as the template
- remove, at minimum, the `AntiForgeryToken` and `User-Agent` headers, at maximum, all headers
- run it

Or, more succinctly, for a given `reservation_id`:
```js
await fetch(`https://www.reservauto.net/WCF/Core/CoreService.svc/Get?apiUrl=%2Fapi%2FBilling%2FReservation%2F${reservation_id}`, {
    "credentials": "include"
});
```

As a function:
```js
get_trip_details = async (reservation_id) => await fetch(`https://www.reservauto.net/WCF/Core/CoreService.svc/Get?apiUrl=%2Fapi%2FBilling%2FReservation%2F${reservation_id}`, {
    "credentials": "include"
}); 
```
