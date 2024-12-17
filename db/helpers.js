const { Position } = require('.');

async function getPortfolioInfo(user_address) {
    const positions = await Position.find({ user_address });
    const portfolio = {};

    for (const position of positions) {
        portfolio[position.asset] = position;
    }

    return portfolio;
}

async function updatePosition({ user_address, asset, spot_amount, perp_size, leverage }) {
    let existingPosition = await Position.findOne({ user_address, asset });

    if (existingPosition) {
        if (existingPosition.leverage != leverage) {
            return {
                ok: false,
                message: "You already opened a position on that asset with different leverage. Use that leverage."
            };
        }

        const newSpotAmount = (BigInt(existingPosition.spot_amount) + BigInt(spot_amount)).toString();
        const newPerpSize = (BigInt(existingPosition.perp_size) + BigInt(perp_size)).toString();

        existingPosition.spot_amount = newSpotAmount;
        existingPosition.perp_size = newPerpSize;
        await existingPosition.save();

        return { ok: true, message: "Position updated successfully", position: existingPosition };
    } else {
        const newPosition = new Position({
            user_address,
            asset,
            spot_amount: BigInt(spot_amount).toString(),
            perp_size: BigInt(perp_size).toString(),
            leverage
        });
        await newPosition.save();

        return { ok: true, message: "Position created successfully", position: newPosition };
    }
}

async function closePosition({ user_address, asset }) {
    const existingPosition = await Position.findOne({ user_address, asset });

    if (!existingPosition) {
        return {
            ok: false,
            message: "No position found to close for this user and asset."
        };
    }

    await Position.deleteOne({ user_address, asset });

    return { ok: true, message: "Position closed successfully." };
}


module.exports = { getPortfolioInfo, updatePosition, closePosition };
