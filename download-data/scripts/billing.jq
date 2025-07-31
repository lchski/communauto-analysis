[
    .rentalId,
    .reservationId,
    .reservationStartDate,
    (.fees[] | select(.feeType == "CollisionDamagesWaiverFee") | .amount)
]
| @csv