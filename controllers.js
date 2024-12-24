const fs = require("fs");
const { getYearlyAvgFundingRate } = require("./data/fundingFeesCache");
const {
  getPortfolioInfo,
  updatePosition,
  closePosition,
} = require("./db/helpers");
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
  const { assetIndexes } = req.query;
  const assetIndexesArray = assetIndexes.split(",").map(Number);
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
  });
  const data = await response.json();

  const perpPrices = {};
  assetIndexesArray.forEach((assetIndex) => {
    const targetPerp = data[1][assetIndex];
    if (!targetPerp) {
      perpPrices[assetIndex] = 0;
    } else {
      perpPrices[assetIndex] = targetPerp.midPx;
    }
  });

  res.status(200).json(perpPrices);
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
    const avgFundingHrly = getYearlyAvgFundingRate(item.name);
    const avgFundingYrly = avgFundingHrly * 24 * 365;

    perpsInfo.push({
      name: item.name,
      assetIndex: index,
      decimals: item.szDecimals,
      fundingHrly: Number(data[1][index]["funding"] * 100).toFixed(4),
      fundingYrly: Number(data[1][index]["funding"] * 100 * 24 * 365).toFixed(
        4
      ),
      fundingAvgMonthly: Number(avgFundingYrly * 100).toFixed(4),
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

async function get1inchSwapQuote(req, res) {
  const { endpoint, ...params } = req.query;

  try {
    const baseURL = `https://api.1inch.dev/swap/v6.0/42161/${endpoint}`;
    const url = new URL(baseURL);
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value.toString());
    });

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${process.env.ONE_INCH_API_KEY}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching 1inch swap quote:", error);
    res.status(500).json({ error: "Failed to fetch swap quote from 1inch" });
  }
}

async function get1inchQuote(req, res) {
  const { endpoint, src, dst, amount, account } = req.query;

  try {
    if (!src || !dst || !amount) {
      return res
        .status(400)
        .json({ error: "Missing required query params: src, dst, amount" });
    }

    // Construct the POST body for DefiSaver
    const requestBody = {
      fromAsset: src,
      fromAssetDecimals: 18, // If needed, adjust or remove decimals if not required
      fromAssetSymbol: "UNKNOWN", // Adjust if your code does not rely on these
      toAsset: dst,
      toAssetDecimals: 6, // Adjust if needed
      toAssetSymbol: "UNKNOWN",
      sources: ["1inch"],
      chainId: 42161, // Arbitrum chainId
      amount: amount,
      excludedSources: [],
      infoOnly: false,
      account: account || "0x0000000000000000000000000000000000000000",
    };

    // Fetch from the new provider (DefiSaver)
    const response = await fetch(process.env.QUOTE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching best price:", errorText);
      return res
        .status(response.status)
        .json({ error: "Failed to fetch quote" });
    }

    const defisaverData = await response.json();
    const bestQuote = defisaverData[0];

    if (!bestQuote) {
      return res.status(500).json({ error: "No quote returned from provider" });
    }

    // Minimal changes: return fields needed. The code that uses this function references `data.dstAmount`.
    // We include `dstAmount` and any other fields you might need from the original structure.
    // Add or remove fields as needed to match your original 1inch response.
    const transformedData = {
      dstAmount: bestQuote.dstAmount,
      fromTokenAmount: requestBody.amount,
      toTokenAmount: bestQuote.dstAmount, // If you originally used toTokenAmount, map it here
      protocols: bestQuote.protocols || [],
      fromToken: {
        symbol: requestBody.fromAssetSymbol,
        name: "Placeholder", // Adjust if your code requires these fields
        address: requestBody.fromAsset,
        decimals: requestBody.fromAssetDecimals,
        logoURI: "",
      },
      toToken: {
        symbol: requestBody.toAssetSymbol,
        name: "Placeholder",
        address: requestBody.toAsset,
        decimals: requestBody.toAssetDecimals,
        logoURI: "",
      },
      estimatedGas: "0", // 1inch provided this, DefiSaver might not. Set a fallback.
    };

    return res.status(200).json(transformedData);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Failed to fetch quote" });
  }
}

async function getPortfolio(req, res) {
  try {
    console.log("here");
    const user_address = req.params.user_address;
    const portfolio = await getPortfolioInfo(user_address);
    return res.json({ ok: true, portfolio });
  } catch (error) {
    console.error("Error in getPositions:", error);
    return res
      .status(500)
      .json({ ok: false, message: "Internal Server Error" });
  }
}

async function storePosition(req, res) {
  try {
    const { user_address, asset, spot_amount, perp_size, leverage, amount } =
      req.body;

    if (
      !user_address ||
      !asset ||
      !spot_amount ||
      !perp_size ||
      !leverage ||
      !amount
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "Missing required fields (user_address, asset, spot_amount, perp_size, leverage, amount)",
      });
    }

    const result = await updatePosition({
      user_address,
      asset,
      spot_amount,
      perp_size,
      leverage,
      amount,
    });
    return res.json(result);
  } catch (error) {
    console.error("Error in storePosition:", error);
    return res
      .status(500)
      .json({ ok: false, message: "Internal Server Error" });
  }
}

async function deletePosition(req, res) {
  try {
    const { user_address, asset } = req.body;

    if (!user_address || !asset) {
      return res.status(400).json({
        ok: false,
        message: "Missing required fields (user_address, asset)",
      });
    }

    const result = await closePosition({ user_address, asset });
    return res.json(result);
  } catch (error) {
    console.error("Error in deletePosition:", error);
    return res
      .status(500)
      .json({ ok: false, message: "Internal Server Error" });
  }
}

module.exports = {
  getTopVolumePerps,
  getCurrentMidPrice,
  getPerpsInfo,
  storeTradeInfo,
  get1inchSwapQuote,
  get1inchQuote,
  getPortfolio,
  storePosition,
  deletePosition,
};
