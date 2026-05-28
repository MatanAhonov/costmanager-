/*
 * Log schema definition.
 * Maps the 'logs' collection in MongoDB.
 * Every HTTP request received by any service is recorded here.
 */
const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    method: { type: String, required: true },
    path: { type: String, required: true },
    status: { type: Number },
    service: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', logSchema);
