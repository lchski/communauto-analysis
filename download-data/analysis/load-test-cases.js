import { writeFileSync } from 'fs'

async function queryCommunautoPrice(startDate, endDate, totalKm) {
	const qry = await fetch(`https://restapifrontoffice.reservauto.net/api/v2/Billing/TripCostEstimate?CityId=103&StartDate=${encodeURIComponent(startDate)}-04%3A00&EndDate=${encodeURIComponent(endDate)}-04%3A00&Distance=${totalKm}&AcceptLanguage=en`, {
		"method": "GET",
	});

	const prices = await qry.json()

	return prices.tripPackageCostEstimateList
		.filter(estimate => estimate.serviceType === 'StationBased')
}

const testCases = [
	['1.00h weekday, 60km', '2025-08-07T10:00:00', '2025-08-07T11:00:00', 60],
	['2.25h weekday, 30km', '2025-08-07T10:00:00', '2025-08-07T12:15:00', 30],
	['5.00h weekday, 10km', '2025-08-07T10:00:00', '2025-08-07T15:00:00', 10],
	['8.00h weekday, 70km', '2025-08-07T10:00:00', '2025-08-07T18:00:00', 70],
	['2d weekday, 50km', '2025-08-07T08:00:00', '2025-08-08T16:00:00', 50],
	['1.00h weekend, 60km', '2025-08-09T10:00:00', '2025-08-09T11:00:00', 60],
	['2.25h weekend, 30km', '2025-08-09T10:00:00', '2025-08-09T12:15:00', 30],
	['5.00h weekend, 10km', '2025-08-09T10:00:00', '2025-08-09T15:00:00', 10],
	['8.00h weekend, 70km', '2025-08-09T10:00:00', '2025-08-09T18:00:00', 70],
	['3 days, 750km (high szn)', '2025-08-07T10:00:00', '2025-08-09T16:00:00', 750],
	['4 days, 750km (high szn)', '2025-08-07T10:00:00', '2025-08-10T16:00:00', 750],
	['6 days, 750km (high szn)', '2025-08-07T10:00:00', '2025-08-12T16:00:00', 750],
	['6 days, 800km (high szn)', '2025-08-07T10:00:00', '2025-08-12T16:00:00', 800],
	['7 days, 750km (high szn)', '2025-08-07T10:00:00', '2025-08-13T16:00:00', 750],
	['9 days, 750km (high szn)', '2025-08-07T10:00:00', '2025-08-15T16:00:00', 750],
	['14 days, 2500km (high szn)', '2025-08-07T10:00:00', '2025-08-20T16:00:00', 2500],
	['3 days, 750km (low szn)', '2025-11-07T10:00:00', '2025-11-09T16:00:00', 750],
	['4 days, 750km (low szn)', '2025-11-07T10:00:00', '2025-11-10T16:00:00', 750],
	['6 days, 750km (low szn)', '2025-11-07T10:00:00', '2025-11-12T16:00:00', 750],
	['6 days, 800km (low szn)', '2025-11-07T10:00:00', '2025-11-12T16:00:00', 800],
	['7 days, 750km (low szn)', '2025-11-07T10:00:00', '2025-11-13T16:00:00', 750],
	['9 days, 750km (low szn)', '2025-11-07T10:00:00', '2025-11-15T16:00:00', 750],
	['14 days, 2500km (low szn)', '2025-11-07T10:00:00', '2025-11-20T16:00:00', 2500],
	['1.00h weekday, 8km (e.g., BCH)', '2025-08-08T17:30:00', '2025-08-08T18:30:00', 8],
	['5.00h weekday, 66km (e.g., CCAH)', '2025-08-08T10:00:00', '2025-08-08T15:00:00', 66]
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