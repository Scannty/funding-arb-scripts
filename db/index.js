const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/funding', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const tokenSchema = new mongoose.Schema({
    ticker: { type: String, required: true },
    fundingHistory: { type: Array, default: [] },
});

tokenSchema.index({ ticker: 1 }, { unique: true });

const positionSchema = new mongoose.Schema({
    user_address: { type: String, required: true },
    asset: { type: String, required: true },
    spot_amount: { type: String, required: true },
    perp_size: { type: String, required: true }, 
    leverage: { type: String, required: true },
    amount:  { type: String, required: true }
})

positionSchema.index({ user_address: 1 }, { unique: false });
positionSchema.index({ user_address: 1, asset: 1 }, { unique: true });

const Token = mongoose.model('Token', tokenSchema);
const Position = mongoose.model('Position', positionSchema);

async function ensureIndexes() {
    try {
        await Token.syncIndexes();
        console.log('Indexes ensured successfully.');
    } catch (error) {
        if (error.code === 86) {
            console.log('Index conflict detected. Skipping redundant index creation.');
        } else {
            console.error('Error ensuring indexes:', error);
        }
    }
}

ensureIndexes();

module.exports = { Token, Position };
