const tokens = ['ETH', 'BTC', 'LINK', 'ARB', 'HYPE', 'PURR'];
const fees = {};

const updateTicker = async (ticker) => {
    const fs = require('fs').promises;

    try {
        await fs.writeFile(`./data/${ticker}.json`, JSON.stringify(fees[ticker], null, 2));
    } catch (error) {
        console.error(`Error saving ${ticker} fees: ${error}`);
    }
}

const loadTicker = async (ticker) => {
    const fs = require('fs').promises;

    try {
        const data = await fs.readFile(`./data/${ticker}.json`, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

const update = async (init) => {
    for (const ticker of tokens) {
        if (init)
            fees[ticker] = await loadTicker(ticker);
        let last_timestamp = fees[ticker][fees[ticker].length - 1]?.time || 1702392469448;
        const now = Date.now();
        const step = 10 * 24 * 3600 * 1000;// 10 days

        while (last_timestamp < now - 3600000) {
            await new Promise(e => setTimeout(e, 5000));
            try {

                const fetchResult = await fetch("https://api.hyperliquid.xyz/info", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "fundingHistory",
                        coin: ticker,
                        startTime: last_timestamp,
                        endTime: last_timestamp + step
                    })
                })

                const dataArray = await fetchResult.json();
                let added = false;
                for (const entry of dataArray) {
                    const { coin, fundingRate, premium, time } = entry;
                    if (coin != ticker || time <= last_timestamp)
                        continue;

                    fees[ticker].push({
                        fundingRate, time
                    })

                    last_timestamp = time;
                    added = true;
                }
                if (dataArray.length == 0) {
                    last_timestamp += step;
                }


                const maxElements = 365 * 24;
                if (fees[ticker].length > maxElements) {
                    fees[ticker] = fees[ticker].slice(-maxElements);
                }

                if (added)
                    getYearlyAvgFundingRate(ticker, true);

                updateTicker(ticker);
            }
            catch (e) {
                console.log("An error happened - update cycle stopped");
                console.error(e);
                return;
            }

        }
    }

    setTimeout(update, 3600 * 1000);
}

update(true);

const cachedFundingRates = {};

const getYearlyAvgFundingRate = (ticker, forceNoCache) => {
    if (!forceNoCache && cachedFundingRates[ticker])
        return cachedFundingRates[ticker];

    const feesArray = fees[ticker];

    if (!feesArray || feesArray.length === 0) {
        return 0;
    }

    const totalFundingRate = feesArray.reduce((sum, fee) => sum + parseFloat(fee.fundingRate), 0);
    const averageFundingRate = totalFundingRate / feesArray.length;

    cachedFundingRates[ticker] = averageFundingRate;

    return averageFundingRate;
}


module.exports = { getYearlyAvgFundingRate }