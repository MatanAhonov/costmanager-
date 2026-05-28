'use strict';

/*
 * About Service - Process D
 * Handles the developers info endpoint:
 *   GET /api/about  - return the list of students who built this project
 */

// Load environment variables from .env before anything else
require('dotenv').config();

// Import required third-party libraries
const express = require('express');
const mongoose = require('mongoose');

// Import our custom Pino logger that writes to MongoDB
const logger = require('./logger');

// Import the Log model for the shared logs collection
const Log = require('./models/log.model');

// Create the Express application instance
const app = express();
// Read the port from .env or fall back to 3004
const PORT = process.env.PORT || 3004;

// Enable JSON body parsing for all incoming requests
app.use(express.json());

// Connect to MongoDB Atlas using the URI from .env
mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info('About service connected to MongoDB'))
    .catch((err) => logger.error('MongoDB connection error: ' + err.message));

/*
 * TEAM_MEMBERS - the developers who built this project.
 * Per project spec, names are NOT stored in the database.
 * They are loaded from .env with hardcoded fallbacks.
 * Property names match the users collection schema.
 */
const TEAM_MEMBERS = [
    {
        // First developer - loaded from .env
        first_name: process.env.DEV1_FIRST || 'Natan-Matan',
        last_name: process.env.DEV1_LAST || 'Ahonov'
    },
    {
        // Second developer
        first_name: process.env.DEV2_FIRST || 'Ron',
        last_name: process.env.DEV2_LAST || 'Atia'
    },
    {
        // Third developer
        first_name: process.env.DEV3_FIRST || 'Or',
        last_name: process.env.DEV3_LAST || 'Mazar'
    }
];

/*
 * saveLog - writes a log document to the logs collection.
 * Records every access to this service's endpoints.
 */
async function saveLog(method, path, status) {
    try {
        // Create and save the log entry with the service name
        const entry = new Log({ method, path, status, service: 'about-service' });
        await entry.save();
    } catch (err) {
        // Never let a log error interrupt the HTTP response
        logger.error('Failed to save log: ' + err.message);
    }
}

/* ─────────────────────────────────────────
   GET /api/about  -  Get development team
   Returns only first_name and last_name
   for each member - no extra data allowed.
───────────────────────────────────────── */
app.get('/api/about', async (req, res) => {
    // Process the next step in the operation
    try {
        // Record the endpoint access in the logs collection
        await saveLog('GET', '/api/about', 200);
        // Return the in-memory team array as JSON
        res.status(200).json(TEAM_MEMBERS);
    } catch (err) {
        // Return a structured error document on unexpected failure
        await saveLog('GET', '/api/about', 500);
        res.status(500).json({ id: 'GET_ABOUT_ERROR', message: err.message });
    }
});

// Bind the server to the configured port and begin listening
app.listen(PORT, () => {
    logger.info('About service running on port ' + PORT);
});
