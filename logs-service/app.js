'use strict';

/*
 * Logs Service - Process A
 * Handles the admin logs endpoint:
 *   GET /api/logs  - retrieve all log entries from the database
 */

// Load environment variables from .env before anything else
require('dotenv').config();

// Import required third-party libraries
const express = require('express');
const mongoose = require('mongoose');

// Import our custom Pino logger that writes to MongoDB
const logger = require('./logger');

// Import the Log model that maps to the logs collection
const Log = require('./models/log.model');

// Create the Express application instance
const app = express();
// Read the port from .env or fall back to 3001
const PORT = process.env.PORT || 3001;

// Enable JSON body parsing for all incoming requests
app.use(express.json());

// Connect to MongoDB Atlas using the URI from .env
mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info('Logs service connected to MongoDB'))
    .catch((err) => logger.error('MongoDB connection error: ' + err.message));

/*
 * saveLog - persists a log entry to the logs collection.
 * Records this service's own endpoint access.
 */
async function saveLog(method, path, status) {
    try {
        // Build and save the log document
        const entry = new Log({ method, path, status, service: 'logs-service' });
        await entry.save();
    } catch (err) {
        // Never let a logging error crash the HTTP response
        logger.error('Failed to save log: ' + err.message);
    }
}

/* ─────────────────────────────────────────
   GET /api/logs  -  List all log entries
   Returns all documents sorted newest first.
───────────────────────────────────────── */
app.get('/api/logs', async (req, res) => {
    try {
        // Query every log document sorted by timestamp descending
        const logs = await Log.find({}).sort({ timestamp: -1 });
        // Record this access to the logs endpoint itself
        await saveLog('GET', '/api/logs', 200);
        res.status(200).json(logs);
    } catch (err) {
        // Return a structured error with id and message on failure
        await saveLog('GET', '/api/logs', 500);
        res.status(500).json({ id: 'GET_LOGS_ERROR', message: err.message });
    }
});

// Start the server on the configured port
app.listen(PORT, () => {
    logger.info('Logs service running on port ' + PORT);
});
