'use strict';

/*
 * Costs Service - Process C
 * Handles all cost-related endpoints:
 *   POST /api/add                  - add a new cost item
 *   GET  /api/report               - monthly report (Computed Pattern)
 *   GET  /api/costs/total/:userid  - internal: sum of costs for a user
 */

// Load environment variables from .env before anything else
require('dotenv').config();

// Import required third-party libraries
const express = require('express');
const mongoose = require('mongoose');
// node-fetch lets us call the users-service to verify user existence
const fetch = require('node-fetch');

// Import our custom Pino logger that writes to MongoDB
const logger = require('./logger');

// Import Mongoose models from the models/ folder
const Cost = require('./models/cost.model');
const ComputedReport = require('./models/computed.report.model');
const Log = require('./models/log.model');

// Create the Express application instance
const app = express();
// Read the port from .env or fall back to 3003
const PORT = process.env.PORT || 3003;

// Enable JSON body parsing for all incoming requests
app.use(express.json());

// Connect to MongoDB Atlas using the URI from .env
mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info('Costs service connected to MongoDB'))
    .catch((err) => logger.error('MongoDB connection error: ' + err.message));

// All valid category names - must match the cost schema enum exactly
const CATEGORIES = ['food', 'health', 'housing', 'sports', 'education'];

/*
 * saveLog - persists a log entry to the shared logs collection.
 * Called at the end of every endpoint to record access.
 */
async function saveLog(method, path, status) {
    try {
        // Build and save the log document with the service identifier
        const entry = new Log({ method, path, status, service: 'costs-service' });
        await entry.save();
    } catch (err) {
        // A logging error must never interrupt the HTTP response
        logger.error('Failed to save log: ' + err.message);
    }
}

/*
 * userExists - queries the users-service to confirm a userid is valid.
 * Returns true if the user exists, false otherwise.
 */
async function userExists(userid) {
    try {
        // Call the internal check endpoint in the users-service
        const url = process.env.USERS_SERVICE_URL + '/api/users/exists/' + userid;
        const response = await fetch(url);
        // Treat any non-OK response as user not found
        if (!response.ok) return false;
        const data = await response.json();
        // Return the boolean from the users-service response
        return data.exists === true;
    } catch (err) {
        // If users-service is unreachable, allow the cost to proceed
        logger.warn('Could not verify user: ' + err.message);
        return true;
    }
}

/*
 * buildCostsArray - groups cost documents by category.
 * All five categories always appear, even if they have no costs.
 */
function buildCostsArray(costDocs) {
    // Seed an empty array for every supported category
    const grouped = {};
    CATEGORIES.forEach((cat) => { grouped[cat] = []; });

    // Assign each cost document to its category bucket
    costDocs.forEach((cost) => {
        const cat = cost.category;
        // Only add costs whose category is in the supported list
        if (grouped[cat] !== undefined) {
            grouped[cat].push({
                // Convert Decimal128 to a plain JS number for JSON output
                sum: parseFloat(cost.sum.toString()),
                description: cost.description,
                // Extract only the day-of-month from the full date
                day: new Date(cost.date).getDate()
            });
        }
    });

    // Transform to the required [{category:[...]}] array format
    return CATEGORIES.map((cat) => ({ [cat]: grouped[cat] }));
}

/* -----------------------------------------
   POST /api/add  -  Add a new cost item
   Required: userid, description, category, sum
   Optional: date (defaults to request time)
----------------------------------------- */
app.post('/api/add', async (req, res) => {
    try {
        // Pull all expected fields from the parsed JSON body
        const { userid, description, category, sum, date } = req.body;

        // Validate each required field separately with a specific message
        if (userid === undefined || userid === null) {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({ id: 'MISSING_USERID', message: 'userid is required' });
        }

        // userid must be a number to match the schema definition
        if (typeof userid !== 'number') {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({ id: 'INVALID_USERID', message: 'userid must be a number' });
        }

        if (!description) {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({ id: 'MISSING_DESCRIPTION', message: 'description is required' });
        }

        if (!category) {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({ id: 'MISSING_CATEGORY', message: 'category is required' });
        }

        // Reject any category not in the supported list
        if (!CATEGORIES.includes(category)) {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({
                id: 'INVALID_CATEGORY',
                message: 'category must be one of: ' + CATEGORIES.join(', ')
            });
        }

        if (sum === undefined || sum === null) {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({ id: 'MISSING_SUM', message: 'sum is required' });
        }

        // Reject negative sum values
        if (sum < 0) {
            await saveLog('POST', '/api/add', 400);
            return res.status(400).json({ id: 'INVALID_SUM', message: 'cost cannot be negative number' });
        }

        // Verify the user exists in the database before adding the cost
        const exists = await userExists(userid);
        if (!exists) {
            await saveLog('POST', '/api/add', 404);
            return res.status(404).json({ id: 'USER_NOT_FOUND', message: 'No user found with this userid' });
        }

        // Use the provided date or fall back to the current server time
        const costDate = date ? new Date(date) : new Date();
        // Create the cost document and persist it to the costs collection
        const newCost = new Cost({ userid, description, category, sum, date: costDate });
        const savedCost = await newCost.save();

        // Respond using the same field names as the schema
        await saveLog('POST', '/api/add', 201);
        res.status(201).json({
            description: savedCost.description,
            category: savedCost.category,
            userid: savedCost.userid,
            // Convert Decimal128 to a regular number for JSON serialisation
            sum: parseFloat(savedCost.sum.toString()),
            date: savedCost.date
        });
    } catch (err) {
        await saveLog('POST', '/api/add', 500);
        res.status(500).json({ id: 'ADD_COST_ERROR', message: err.message });
    }
});

/* -----------------------------------------
   GET /api/report  -  Monthly cost report
   Query params: id (userid), year, month
----------------------------------------- */
app.get('/api/report', async (req, res) => {
    try {
        // Read the three required query parameters
        const { id, year, month } = req.query;

        // Validate each parameter separately with a specific message
        if (!id) {
            await saveLog('GET', '/api/report', 400);
            return res.status(400).json({ id: 'MISSING_ID', message: 'id is required' });
        }

        if (!year) {
            await saveLog('GET', '/api/report', 400);
            return res.status(400).json({ id: 'MISSING_YEAR', message: 'year is required' });
        }

        if (!month) {
            await saveLog('GET', '/api/report', 400);
            return res.status(400).json({ id: 'MISSING_MONTH', message: 'month is required' });
        }

        // Convert the string query parameters to numbers
        const userid = Number(id);
        const yearNum = Number(year);
        const monthNum = Number(month);

        // Reject if any parameter is not a valid number
        if (isNaN(userid)) {
            await saveLog('GET', '/api/report', 400);
            return res.status(400).json({ id: 'INVALID_ID', message: 'id must be a number' });
        }

        if (isNaN(yearNum)) {
            await saveLog('GET', '/api/report', 400);
            return res.status(400).json({ id: 'INVALID_YEAR', message: 'year must be a number' });
        }

        if (isNaN(monthNum)) {
            await saveLog('GET', '/api/report', 400);
            return res.status(400).json({ id: 'INVALID_MONTH', message: 'month must be a number' });
        }

        // Validate the month is within the calendar range 1-12
        if (monthNum < 1 || monthNum > 12) {
            await saveLog('GET', '/api/report', 400);
            return res.status(400).json({ id: 'INVALID_MONTH', message: 'month must be between 1 and 12' });
        }

        /*
         * Computed Design Pattern Implementation:
         * When a report is requested for a past month, we first check
         * the computedreports collection for a cached result.
         * If found, we return it immediately without querying costs.
         * If not found, we calculate, cache, and return the result.
         */
        const now = new Date();
        // JS months are 0-indexed, so subtract 1 from monthNum
        const requestedDate = new Date(yearNum, monthNum - 1);
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth());
        // A month is "past" if it started before the current month
        const isPastMonth = requestedDate < currentMonthStart;

        if (isPastMonth) {
            // Look for a pre-calculated report in the database
            const cached = await ComputedReport.findOne({ userid, year: yearNum, month: monthNum });
            if (cached) {
                // Cache hit - return the stored result immediately
                logger.info('Returning cached report for user ' + userid);
                await saveLog('GET', '/api/report', 200);
                return res.status(200).json({
                    userid, year: yearNum, month: monthNum, costs: cached.costs
                });
            }
        }

        // Define the exact time boundaries for the requested month
        const startDate = new Date(yearNum, monthNum - 1, 1);
        // Day 1 of the next month gives a clean upper boundary
        const endDate = new Date(yearNum, monthNum, 1);

        // Fetch all costs for this user within the requested month
        const costDocs = await Cost.find({
            userid,
            date: { $gte: startDate, $lt: endDate }
        });

        // Group the costs into the required array structure
        const costsArray = buildCostsArray(costDocs);

        // For past months, save the result for future requests
        if (isPastMonth) {
            const report = new ComputedReport({ userid, year: yearNum, month: monthNum, costs: costsArray });
            // Persist the computed report to avoid recalculating next time
            await report.save();
            logger.info('Saved computed report for ' + userid);
        }

        // Return the calculated report to the client
        await saveLog('GET', '/api/report', 200);
        res.status(200).json({ userid, year: yearNum, month: monthNum, costs: costsArray });
    } catch (err) {
        await saveLog('GET', '/api/report', 500);
        res.status(500).json({ id: 'GET_REPORT_ERROR', message: err.message });
    }
});

/* -----------------------------------------
   GET /api/costs/total/:userid
   Internal endpoint used by users-service.
----------------------------------------- */
app.get('/api/costs/total/:userid', async (req, res) => {
    try {
        // Convert the userid parameter to a number
        const userid = Number(req.params.userid);
        // Use MongoDB aggregation to sum all costs for this user
        const result = await Cost.aggregate([
            // Stage 1: filter by userid
            { $match: { userid } },
            // Stage 2: sum the 'sum' field across all matched documents
            { $group: { _id: null, total: { $sum: { $toDouble: '$sum' } } } }
        ]);
        // If no costs exist the aggregation returns an empty array
        const total = result.length > 0 ? result[0].total : 0;
        res.status(200).json({ total });
    } catch (err) {
        res.status(500).json({ id: 'GET_TOTAL_ERROR', message: err.message });
    }
});

// Start the server and bind to the configured port
app.listen(PORT, () => {
    logger.info('Costs service running on port ' + PORT);
});
