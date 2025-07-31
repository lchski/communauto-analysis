# rental_id,reservation_id,date_start,date_end,vehicle_id,vehicle_nb,station_id,station_nb,rental_cost,rental_owner_customer_id,nb_receipts

[
    .rentalId,
    .rentalNb,
    .startDate,
    .endDate,
    .vehicle.vehicleId,
    .vehicle.vehicleNb,
    .station.stationId,
    .station.stationNb,
    .rentalCost,
    .rentalOwnerCustomerId,
    .nbOfReceipts
]
| @csv