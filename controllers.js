async function getHyperliquidData(req, res) {
  console.log("Getting data...");
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
  });

  const { numOfPerps = 10 } = req.query;

  const data = await response.json();
  const sortedArray = [...data[1]];

  sortedArray.sort((a, b) => {
    const volumeA = a["dayNtlVlm"];
    const volumeB = b["dayNtlVlm"];
    return volumeB - volumeA;
  });

  const minVolume = sortedArray[numOfPerps - 1]["dayNtlVlm"];

  const topPerps = [];

  for (const [index, item] of data[0]["universe"].entries()) {
    if (Number(data[1][index]["dayNtlVlm"]) < Number(minVolume)) {
      continue;
    }

    const response = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "fundingHistory",
        coin: item.name,
        startTime: Date.now() - 365 * 24 * 60 * 60 * 1000, // past year
      }),
    });
    const fundingData = await response.json();

    let totalFunding = 0;
    fundingData.forEach((fundingItem) => {
      totalFunding += Number(fundingItem.fundingRate);
    });
    totalFunding = totalFunding * 100;
    console.log(fundingData.length);
    const avgFundingHrly = totalFunding / fundingData.length;
    const avgFundingYrly = avgFundingHrly * 24 * 365;

    topPerps.push({
      name: item.name,
      fundingHrly: Number(data[1][index]["funding"] * 100).toFixed(4),
      fundingYrly: Number(data[1][index]["funding"] * 100 * 24 * 365).toFixed(
        4
      ),
      fundingAvgMonthly: Number(avgFundingYrly).toFixed(4),
    });
  }

  res.status(200).json(topPerps);
}

module.exports = { getHyperliquidData };
