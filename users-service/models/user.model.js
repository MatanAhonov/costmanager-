/*
 * User schema definition.
 * Maps the 'users' collection in MongoDB.
 * Note: 'id' and '_id' are two completely separate fields.
 * '_id' is MongoDB's internal identifier (ObjectId).
 * 'id' is our custom numeric application-level identifier.
 */
const mongoose = require('mongoose');

// Define the shape and types of every field in a user document
const userSchema = new mongoose.Schema({
    // Custom numeric user ID - must be unique across all users
    id: { type: Number, required: true, unique: true },
    // User's first name stored as a plain string
    first_name: { type: String, required: true },
    // User's last name stored as a plain string
    last_name: { type: String, required: true },
    // Birthday stored as a full Date object (not just a string)
    birthday: { type: Date, required: true }
});

// Export a compiled Mongoose model bound to the 'users' collection
module.exports = mongoose.model('User', userSchema);
