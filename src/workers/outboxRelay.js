const pool = require("../db/pool");
const producer = require("../kafka/producer");
const env = require("../config/env");

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 5 * 60 * 1000;

function computeNextDelay(retryCount)
{
    const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
    return Math.min(delay, MAX_DELAY_MS);
}

async function fetchPendingEvents()
{
    const result = await pool.query(
        `SELECT * FROM outbox_events
         WHERE status = 'PENDING' AND available_at <= now()
         ORDER BY created_at ASC
         LIMIT 20`
    );
    return result.rows;
}

async function markPublished(id)
{
    await pool.query(
        `UPDATE outbox_events SET status = 'PUBLISHED', published_at = now() WHERE id = $1`,
        [id]
    );
}

async function markRetry(id, retryCount)
{
    const nextDelayMs = computeNextDelay(retryCount);

    await pool.query(
        `UPDATE outbox_events
         SET retry_count = $1, available_at = now() + ($2 || ' milliseconds')::interval
         WHERE id = $3`,
        [retryCount, nextDelayMs, id]
    );
}

async function markFailed(event)
{
    await pool.query(
        `UPDATE outbox_events SET status = 'FAILED' WHERE id = $1`,
        [event.id]
    );

    await producer.publish(`${env.kafkaTopic}.dlq`, event.aggregate_id, event.payload);
}

async function processEvent(event)
{
    try
    {
        await producer.publish(env.kafkaTopic, event.aggregate_id, event.payload);
        await markPublished(event.id);
    }
    catch (error)
    {
        const nextRetryCount = event.retry_count + 1;

        if (nextRetryCount >= MAX_RETRIES)
        {
            await markFailed(event);
        }
        else
        {
            await markRetry(event.id, nextRetryCount);
        }
    }
}

let isRunning = false;

async function runOutboxRelay()
{
    if (isRunning)
    {
        return;
    }

    isRunning = true;

    try
    {
        const events = await fetchPendingEvents();

        for (const event of events)
        {
            await processEvent(event);
        }
    }
    finally
    {
        isRunning = false;
    }
}

module.exports = { runOutboxRelay };