# rental_id,reservation_id,date_reservation,vehicle_nb,duration_min,duration_min_billed,distance_km,rate_type,package_name,date_transaction,cost_total,cost_duration,cost_distance,cost_fees,fees_dpf,cost_credits,credits_n,tax_hst,purchase_reimbursement

[
    .rentalId,
    .reservationId,
    .reservationStartDate,
    .vehiculeNo,
    .tripTotalDurationInMinutes,
    (.durationInfo[] | select(.durationType == "BilledDuration") | .durationInMinutes),
    .tripTotalDistanceInKm,
    .rateType,
    .packageName,
    .transactionDate,
    .tripTotalCost,
    .durationPrice,
    .distancePrice,
    .totalFees,
    (.fees[] | select(.feeType == "CollisionDamagesWaiverFee") | .amount),
    .totalCredits,
    (.credits[] | length),
    (.taxes[] | select(.name == "HST") | .taxAmount),
    .purchaseReimbursement
]
| @csv