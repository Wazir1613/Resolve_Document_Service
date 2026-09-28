const crypto = require("crypto");
const { v4: uuid } = require("uuid");
const pool = require("../db/pool");
const s3Client = require("./s3Client");

function computeChecksum(buffer)
{
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function buildStorageKey(tenantId, caseId, documentId, filename)
{
    return `documents/${tenantId}/${caseId}/${documentId}/${filename}`;
}

function buildVersionedStorageKey(tenantId, caseId, documentId, versionNumber, filename)
{
    return `documents/${tenantId}/${caseId}/${documentId}/v${versionNumber}/${filename}`;
}

async function uploadDocument({ tenantId, userId, caseId, file, checksum })
{
    const documentId = uuid();
    const storageKey = buildStorageKey(tenantId, caseId, documentId, file.originalname);

    await s3Client.uploadBuffer(storageKey, file.buffer, file.mimetype);

    const client = await pool.connect();

    try
    {
        await client.query("BEGIN");

        const documentResult = await client.query(
            `INSERT INTO documents
        (id, organization_id, case_id, uploaded_by, filename, mime_type,
         size_bytes, checksum, storage_key, scan_status, current_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', 1)
       RETURNING *`,
            [documentId, tenantId, caseId, userId, file.originalname,
                file.mimetype, file.size, checksum, storageKey]
        );

        const document = documentResult.rows[0];

        await client.query(
            `INSERT INTO document_versions
        (id, document_id, version_number, storage_key, checksum, size_bytes, uploaded_by, filename)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7)`,
            [uuid(), documentId, storageKey, checksum, file.size, userId, file.originalname]
        );

        const eventPayload =
            {
                eventId: uuid(),
                eventType: "DocumentUploaded",
                eventVersion: 1,
                tenantId: tenantId,
                actorId: userId,
                resourceType: "DOCUMENT",
                resourceId: documentId,
                timestamp: new Date().toISOString(),
                metadata: { documentId, caseId, storageKey }
            };

        await client.query(
            `INSERT INTO outbox_events
        (id, organization_id, aggregate_type, aggregate_id, event_type, payload)
       VALUES ($1, $2, 'DOCUMENT', $3, 'DocumentUploaded', $4)`,
            [uuid(), tenantId, documentId, eventPayload]
        );

        await client.query("COMMIT");

        return document;
    }
    catch (error)
    {
        await client.query("ROLLBACK");
        throw error;
    }
    finally
    {
        client.release();
    }
}

async function listDocuments({ tenantId, caseId, page, size })
{
    const offset = page * size;

    const totalResult = await pool.query(
        `SELECT COUNT(*) FROM documents WHERE organization_id = $1 AND case_id = $2`,
        [tenantId, caseId]
    );
    const totalElements = Number(totalResult.rows[0].count);

    const result = await pool.query(
        `SELECT * FROM documents WHERE organization_id = $1 AND case_id = $2
         ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        [tenantId, caseId, size, offset]
    );

    return {
        content: result.rows,
        page,
        size,
        totalElements,
        totalPages: Math.ceil(totalElements / size)
    };
}

async function getDocumentById(tenantId, caseId, documentId)
{
    const result = await pool.query(
        `SELECT * FROM documents WHERE id = $1 AND organization_id = $2 AND case_id = $3`,
        [documentId, tenantId, caseId]
    );
    return result.rows[0] || null;
}

async function uploadNewVersion({ tenantId, caseId, userId, documentId, file, checksum })
{
    const existingResult = await pool.query(
        `SELECT * FROM documents WHERE id = $1 AND organization_id = $2 AND case_id = $3`,
        [documentId, tenantId, caseId]
    );

    const existingDocument = existingResult.rows[0];
    if (!existingDocument)
    {
        return null;
    }

    const newVersionNumber = existingDocument.current_version + 1;
    const storageKey = buildVersionedStorageKey(tenantId, caseId, documentId, newVersionNumber, file.originalname);

    await s3Client.uploadBuffer(storageKey, file.buffer, file.mimetype);

    const client = await pool.connect();

    try
    {
        await client.query("BEGIN");

        await client.query(
            `INSERT INTO document_versions
        (id, document_id, version_number, storage_key, checksum, size_bytes, uploaded_by, filename)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [uuid(), documentId, newVersionNumber, storageKey, checksum, file.size, userId, file.originalname]
        );

        const updatedResult = await client.query(
            `UPDATE documents
             SET current_version = $1, filename = $2, mime_type = $3,
                 size_bytes = $4, checksum = $5, storage_key = $6
             WHERE id = $7
             RETURNING *`,
            [newVersionNumber, file.originalname, file.mimetype, file.size, checksum, storageKey, documentId]
        );

        await client.query("COMMIT");

        return updatedResult.rows[0];
    }
    catch (error)
    {
        await client.query("ROLLBACK");
        throw error;
    }
    finally
    {
        client.release();
    }
}

async function listVersions(documentId)
{
    const result = await pool.query(
        `SELECT * FROM document_versions WHERE document_id = $1 ORDER BY version_number ASC`,
        [documentId]
    );
    return result.rows;
}

async function getVersionByNumber(documentId, versionNumber)
{
    const result = await pool.query(
        `SELECT * FROM document_versions WHERE document_id = $1 AND version_number = $2`,
        [documentId, versionNumber]
    );
    return result.rows[0] || null;
}

function toResponse(document)
{
    return {
        id: document.id,
        caseId: document.case_id,
        organizationId: document.organization_id,
        filename: document.filename,
        mimeType: document.mime_type,
        sizeBytes: document.size_bytes,
        checksum: document.checksum,
        scanStatus: document.scan_status,
        currentVersion: document.current_version,
        uploadedBy: document.uploaded_by,
        createdAt: document.created_at
    };
}

function toVersionResponse(version)
{
    return {
        versionNumber: version.version_number,
        filename: version.filename,
        sizeBytes: version.size_bytes,
        checksum: version.checksum,
        uploadedBy: version.uploaded_by,
        createdAt: version.created_at
    };
}

module.exports =
    {
        uploadDocument,
        computeChecksum,
        listDocuments,
        getDocumentById,
        toResponse,
        uploadNewVersion,
        listVersions,
        getVersionByNumber,
        toVersionResponse
    };