/*
 * ComputedReport schema definition.
 * Maps the 'computedreports' collection in MongoDB.
 *
 * This implements the Computed Design Pattern:
 * When a monthly report is requested for a month that has fully passed,
 * the server calculates the grouped result once and saves it here.
 * On every subsequent request for the same user/year/month combination,
 * the pre-saved result is returned directly from this collection,
 * eliminating the need to re-aggregate the costs collection each time.
 * This reduces CPU workload and improves response speed for past reports.
 */
const mongoose = require('mongoose');

// Schema for a stored (pre-calculated) monthly report
const computedReportSchema = new mongoose.Schema({
    // The user this cached report belongs to
    userid: { type: Number, required: true },
    // The year of the report (e.g. 2025)
    year: { type: Number, required: true },
    // The month of the report (1-12)
    month: { type: Number, required: true },
    // The pre-built costs array, stored as Mixed to allow any JSON structure
    costs: { type: mongoose.Schema.Types.Mixed, required: true }
});

// Export the model bound to the 'computedreports' collection
module.exports = mongoose.model('ComputedReport', computedReportSchema);
