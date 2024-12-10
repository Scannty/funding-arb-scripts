const fs = require("fs");
require("dotenv").config();

async function getTopVolumePerps(req, res) {
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
        startTime: Date.now() - 20 * 24 * 3600 * 1000, // past year
      }),
    });
    const fundingData = await response.json();

    let totalFunding = 0;
    fundingData.forEach((fundingItem) => {
      totalFunding += Number(fundingItem.fundingRate);
    });
    totalFunding = totalFunding * 100;
    const avgFundingHrly = totalFunding / fundingData.length;
    const avgFundingYrly = avgFundingHrly * 24 * 365;

    topPerps.push({
      name: item.name,
      assetIndex: index,
      decimals: item.szDecimals,
      fundingHrly: Number(data[1][index]["funding"] * 100).toFixed(4),
      fundingYrly: Number(data[1][index]["funding"] * 100 * 24 * 365).toFixed(
        4
      ),
      fundingAvgMonthly: Number(avgFundingYrly).toFixed(4),
    });
  }

  res.status(200).json(topPerps);
}

async function getCurrentMidPrice(req, res) {
  const { assetIndex } = req.query;
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
  });
  const data = await response.json();

  const targetPerp = data[1][assetIndex];
  res.status(200).json({
    midPrice: targetPerp.midPx,
  });
}

async function getPerpsInfo(req, res) {
  const perps = req.query.perps ? req.query.perps.split(",") : [];

  console.log("Getting data...");
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
  });

  const data = await response.json();
  const perpsInfo = [];

  for (const [index, item] of data[0]["universe"].entries()) {
    if (!perps.includes(item.name)) {
      continue;
    }
    if (perps.length === perpsInfo.length) {
      break;
    }

    const response = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "fundingHistory",
        coin: item.name,
        startTime: Date.now() - 20 * 24 * 3600 * 1000, // past 20 days, currently max
      }),
    });
    const fundingData = await response.json();

    let totalFunding = 0;
    fundingData.forEach((fundingItem) => {
      totalFunding += Number(fundingItem.fundingRate);
    });
    totalFunding = totalFunding * 100;
    const avgFundingHrly = totalFunding / fundingData.length;
    const avgFundingYrly = avgFundingHrly * 24 * 365;

    perpsInfo.push({
      name: item.name,
      assetIndex: index,
      decimals: item.szDecimals,
      fundingHrly: Number(data[1][index]["funding"] * 100).toFixed(4),
      fundingYrly: Number(data[1][index]["funding"] * 100 * 24 * 365).toFixed(
        4
      ),
      fundingAvgMonthly: Number(avgFundingYrly).toFixed(4),
    });
  }

  res.status(200).json(perpsInfo);
}

function storeTradeInfo(req, res) {
  const { userAddress, tradeInfo } = req.body;
  console.log(tradeInfo);

  if (!fs.existsSync("tradeInfo.json")) {
    fs.writeFileSync(
      "tradeInfo.json",
      JSON.stringify([
        {
          userAddress,
          tradeInfo,
        },
      ])
    );
  } else {
    const tradeInfoArray = JSON.parse(fs.readFileSync("tradeInfo.json"));
    tradeInfoArray.push(tradeInfo);
    fs.writeFileSync("tradeInfo.json", JSON.stringify(tradeInfoArray));
  }

  res.status(200).json({ message: "Trade info stored successfully!" });
}

module.exports = {
  getTopVolumePerps,
  getCurrentMidPrice,
  getPerpsInfo,
  storeTradeInfo,
};
