const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/funding', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const tokenSchema = new mongoose.Schema({
    ticker: { type: String, required: true, unique: true }, 
    fundingHistory: { type: Array, default: [] },
});

tokenSchema.index({ ticker: 1 }, { unique: true });

const Token = mongoose.model('Token', tokenSchema);

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

module.exports = { Token };
