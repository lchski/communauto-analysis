import { writeFileSync } from 'fs'

async function queryCommunautoPrice(startDate, endDate, totalKm) {
	const qry = await fetch(`https://restapifrontoffice.reservauto.net/api/v2/Billing/TripCostEstimate?CityId=103&StartDate=${encodeURIComponent(startDate)}-04%3A00&EndDate=${encodeURIComponent(endDate)}-04%3A00&Distance=${totalKm}&AcceptLanguage=en`, {
		"method": "GET",
	});

	const prices = await qry.json()

	// console.log(
	// 	prices.tripPackageCostEstimateList
	// 		.filter(estimate => estimate.serviceType === 'StationBased')
	// 		.map(estimate => ({
	// 			plan: estimate.localizedPlanTypeName,
	// 			rate: estimate.localizedBillingRateName,
	// 			duration: estimate.durationCost,
	// 			distance: estimate.distanceCost,
	// 			total: estimate.totalCost
	// 		}))
	// )

	return prices.tripPackageCostEstimateList
		.filter(estimate => estimate.serviceType === 'StationBased')
}

const testCases = [
	['1.00h weekday, 60km', '2025-08-07T10:00:00', '2025-08-07T11:00:00', 60],
	['2.25h weekday, 30km', '2025-08-07T10:00:00', '2025-08-07T12:15:00', 30],
	['5.00h weekday, 10km', '2025-08-07T10:00:00', '2025-08-07T15:00:00', 10],
	['8.00h weekday, 70km', '2025-08-07T10:00:00', '2025-08-07T18:00:00', 70],
]

async function buildTestCase(testCase) {
	let caseDetails = {
		scenario: testCase[0],
		startDate: testCase[1],
		endDate: testCase[2],
		distance: testCase[3]
	}

	const communautoEstimates = await queryCommunautoPrice(caseDetails.startDate, caseDetails.endDate, caseDetails.distance)

	caseDetails.communautoEstimates = communautoEstimates

	const estimateTests = communautoEstimates
		.map(estimate => ({
			plan: estimate.localizedPlanTypeName,
			rate: estimate.localizedBillingRateName,
			duration: estimate.durationCost,
			distance: estimate.distanceCost,
			total: estimate.totalCost
		}))

	caseDetails.estimateTests = estimateTests

	return caseDetails
}

Promise.all(testCases.map(buildTestCase)).then(testData => writeFileSync('data/indices/rate-tests.json', JSON.stringify(testData, null, 2)))