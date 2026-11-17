const pool = require("../db/pool");
const s3Client = require("../services/s3Client");
const scanService = require("../services/scanService");

async function fetchPendingDocuments()
{
    const result = await pool.query(
        `SELECT * FROM documents WHERE scan_status = 'PENDING' ORDER BY created_at ASC LIMIT 20`
    );
    return result.rows;
}

async function markScanResult(documentId, scanStatus)
{
    await pool.query(
        `UPDATE documents SET scan_status = $1 WHERE id = $2`,
        [scanStatus, documentId]
    );
}

async function processDocument(document)
{
    try
    {
        const buffer = await s3Client.downloadBuffer(document.storage_key);
        const scanStatus = await scanService.scanBuffer(buffer);
        await markScanResult(document.id, scanStatus);
    }
    catch (error)
    {
        console.error(`Scan failed for document ${document.id}:`, error.message);
    }
}

let isRunning = false;

async function runScanRelay()
{
    if (isRunning)
    {
        return;
    }

    isRunning = true;

    try
    {
        const documents = await fetchPendingDocuments();

        for (const document of documents)
        {
            await processDocument(document);
        }
    }
    finally
    {
        isRunning = false;
    }
}

module.exports = { runScanRelay };