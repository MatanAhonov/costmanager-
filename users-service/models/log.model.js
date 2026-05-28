/*
 * Log schema definition.
 * Maps the 'logs' collection in MongoDB.
 * Every HTTP request received by any service is recorded here.
 */
const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    // The HTTP method used (GET, POST, etc.)
    method: { type: String, required: true },
    // The URL path that was accessed
    path: { type: String, required: true },
    // The HTTP status code returned
    status: { type: Number },
    // The name of the service that received the request
    service: { type: String, required: true },
    // The date and time the request was received
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', logSchema);
