'use strict';

/*
 * Users Service - Process B
 * Handles all user-related endpoints:
 *   GET  /api/users        - list all users
 *   GET  /api/users/:id    - get specific user with total costs
 *   POST /api/add          - add a new user
 */

// Load environment variables from .env before anything else
require('dotenv').config();

// Import required third-party libraries
const express = require('express');
const mongoose = require('mongoose');
// node-fetch lets us call other microservices via HTTP
const fetch = require('node-fetch');

// Import our custom Pino logger that writes to MongoDB
const logger = require('./logger');

// Import Mongoose models from the models/ folder
const User = require('./models/user.model');
const Log = require('./models/log.model');

// Create the Express application instance
const app = express();
// Read the port from .env or fall back to 3002
const PORT = process.env.PORT || 3002;

// Enable JSON body parsing for all incoming requests
app.use(express.json());

// Connect to MongoDB Atlas using the URI from .env
mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info('Users service connected to MongoDB'))
    .catch((err) => logger.error('MongoDB connection error: ' + err.message));

/*
 * saveLog - writes a log document to the logs collection.
 * Called at the end of every endpoint to record access.
 */
async function saveLog(method, path, status) {
    try {
        // Build and save the log entry with the service identifier
        const entry = new Log({ method, path, status, service: 'users-service' });
        await entry.save();
    } catch (err) {
        // A logging error must never crash the main response
        logger.error('Failed to save log: ' + err.message);
    }
}

/* -----------------------------------------
   GET /api/users  -  List all users
----------------------------------------- */
app.get('/api/users', async (req, res) => {
    try {
        // Retrieve every document from the users collection
        const users = await User.find({});
        // Record this access before responding
        await saveLog('GET', '/api/users', 200);
        res.status(200).json(users);
    } catch (err) {
        // Return a structured error with id and message fields
        await saveLog('GET', '/api/users', 500);
        res.status(500).json({ id: 'GET_USERS_ERROR', message: err.message });
    }
});

/* -----------------------------------------
   GET /api/users/exists/:id
   Internal endpoint used by costs-service
   to verify a user exists before adding a cost.
----------------------------------------- */
app.get('/api/users/exists/:id', async (req, res) => {
    try {
        // Convert the id parameter to a number for the query
        const userId = Number(req.params.id);
        // Look up the user by numeric id field
        const user = await User.findOne({ id: userId });
        // Return a simple boolean result
        res.status(200).json({ exists: !!user });
    } catch (err) {
        res.status(500).json({ id: 'CHECK_USER_ERROR', message: err.message });
    }
});

/* -----------------------------------------
   GET /api/users/:id  -  Get one user
   Returns: { id, first_name, last_name, total }
----------------------------------------- */
app.get('/api/users/:id', async (req, res) => {
    try {
        // Convert the URL parameter string to a number
        const userId = Number(req.params.id);
        // Reject if the value is not a valid number
        if (isNaN(userId)) {
            await saveLog('GET', '/api/users/' + req.params.id, 400);
            return res.status(400).json({ id: 'INVALID_ID', message: 'User id must be a number' });
        }

        // Search by custom numeric id field, not MongoDB _id
        const user = await User.findOne({ id: userId });
        // Return 404 if no matching document was found
        if (!user) {
            await saveLog('GET', '/api/users/' + userId, 404);
            return res.status(404).json({ id: 'USER_NOT_FOUND', message: 'User not found' });
        }

        // Ask the costs-service for the total spending of this user
        let total = 0;
        try {
            // Build the URL for the internal costs endpoint
            const costsUrl = process.env.COSTS_SERVICE_URL + '/api/costs/total/' + userId;
            const costsResponse = await fetch(costsUrl);
            // Only update total if the costs-service replied with success
            if (costsResponse.ok) {
                const costsData = await costsResponse.json();
                total = costsData.total || 0;
            }
        } catch (fetchErr) {
            // If costs-service is unreachable, return 0 rather than failing
            logger.warn('Could not fetch total costs: ' + fetchErr.message);
        }

        // Respond with the four required fields
        await saveLog('GET', '/api/users/' + userId, 200);
        res.status(200).json({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            total
        });
    } catch (err) {
        await saveLog('GET', '/api/users/' + req.params.id, 500);
        res.status(500).json({ id: 'GET_USER_ERROR', message: err.message });
    }
});

/* -----------------------------------------
   POST /api/add  -  Add a new user
   Body: { id, first_name, last_name, birthday }
----------------------------------------- */
app.post('/api/add', async (req, res) => {
    try {
        // Destructure the expected fields from the JSON body
        const { id, first_name, last_name, birthday } = req.body;

        // Validate each required field separately with a specific message
        if (id === undefined || id === null) {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({ id: 'MISSING_ID', message: 'id is required' });
        }

        // The id must be a Number as defined in the schema
        if (typeof id !== 'number') {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({ id: 'INVALID_ID', message: 'id must be a number' });
        }

        if (!first_name) {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({ id: 'MISSING_FIRST_NAME', message: 'first_name is required' });
        }

        if (!last_name) {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({ id: 'MISSING_LAST_NAME', message: 'last_name is required' });
        }

        if (!birthday) {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({ id: 'MISSING_BIRTHDAY', message: 'birthday is required' });
        }

        // Create the User document and write it to the database
        const newUser = new User({ id, first_name, last_name, birthday });
        const savedUser = await newUser.save();
        // Return the full saved document on success
        await saveLog('POST', '/api/add', 201);
        res.status(201).json(savedUser);
    } catch (err) {
        // Error code 11000 means a duplicate unique key - user already exists
        if (err.code === 11000) {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({
                id: 'USER_EXISTS',
                message: 'A user with this id already exists'
            });
        }
        await saveLog('POST', '/api/add', 500);
        res.status(500).json({ id: 'ADD_USER_ERROR', message: err.message });
    }
});

// Start listening on the configured port
app.listen(PORT, () => {
    logger.info('Users service running on port ' + PORT);
});
