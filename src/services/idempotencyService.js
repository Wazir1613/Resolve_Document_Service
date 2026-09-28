const pool = require("../db/pool");

async function findRecord(key)
{
    const result = await pool.query(
        "SELECT * FROM idempotency_keys WHERE key = $1",
        [key]
    );
    return result.rows[0] || null;
}

async function saveRecord(key, fingerprint, statusCode, responseBody)
{
    await pool.query(
        `INSERT INTO idempotency_keys (key, request_fingerprint, status_code, response_body)
     VALUES ($1, $2, $3, $4)`,
        [key, fingerprint, statusCode, responseBody]
    );
}

module.exports = { findRecord, saveRecord };