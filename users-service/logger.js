'use strict';

/*
 * Logger setup using Pino with a custom MongoDB transport.
 * Every log message is written directly to the 'logs' collection
 * in MongoDB, so Process A can retrieve them via GET /api/logs.
 */
const pino = require('pino');
const mongoose = require('mongoose');
const Log = require('./models/log.model');

/*
 * build() - creates and returns the configured Pino logger.
 * Must be called after dotenv has loaded the environment variables.
 */
function build() {
    // Create a writable destination object that Pino will stream logs into
    const destination = {
        write(logLine) {
            try {
                // Parse the JSON log line that Pino produces
                const logData = JSON.parse(logLine);

                // Extract HTTP-specific fields if this is a request log
                const method = logData.req ? logData.req.method : 'SYSTEM';
                const path = logData.req ? logData.req.url : (logData.msg || '');
                const status = logData.res ? logData.res.statusCode : null;

                // Only write to DB when the mongoose connection is ready
                if (mongoose.connection.readyState === 1) {
                    // Determine service name from the module path
                    const service = __dirname.split('\\').slice(-2, -1)[0]
                        || __dirname.split('/').slice(-2, -1)[0]
                        || 'unknown-service';

                    // Save the log entry - fire and forget
                    const entry = new Log({ method, path, status, service });
                    entry.save().catch((err) => {
                        process.stderr.write('Log save error: ' + err.message + '\n');
                    });
                }
            } catch (err) {
                // Never crash the app due to a logging error
                process.stderr.write('Logger error: ' + err.message + '\n');
            }
        }
    };

    // Return a configured Pino logger that writes to our custom destination
    return pino({ level: 'info' }, destination);
}

module.exports = build();
