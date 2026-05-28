/*
 * Cost schema definition.
 * Maps the 'costs' collection in MongoDB.
 * Each document represents one cost item created by a user.
 */
const mongoose = require('mongoose');

// Define all fields that a cost document must/can contain
const costSchema = new mongoose.Schema({
    // Short text describing what the money was spent on
    description: { type: String, required: true },
    // Must be one of the five categories supported by the application
    category: {
        type: String,
        required: true,
        enum: ['food', 'health', 'housing', 'sports', 'education']
    },
    // The numeric id of the user who owns this cost (matches User.id)
    userid: { type: Number, required: true },
    // Amount spent - stored as Decimal128 for full floating-point precision
    sum: { type: mongoose.Schema.Types.Decimal128, required: true },
    // When the cost occurred; defaults to the moment the request arrived
    date: { type: Date, default: Date.now }
});

// Compile and export the model bound to the 'costs' collection
module.exports = mongoose.model('Cost', costSchema);
