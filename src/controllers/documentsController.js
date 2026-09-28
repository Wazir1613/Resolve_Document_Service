const env = require("../config/env");
const { checkPermission } = require("../services/permissionClient");
const { assertCaseExists } = require("../services/caseClient");
const documentsService = require("../services/documentsService");
const idempotencyService = require("../services/idempotencyService");
const s3Client = require("../services/s3Client");

async function uploadDocument(req, res)
{
    const { tenantId, userId } = req.user;
    const { caseId } = req.params;
    const file = req.file;

    if (!file)
    {
        return res.status(400).json(
            {
                status: 400,
                code: "DOCUMENT_VALIDATION_ERROR",
                message: "Request validation failed",
                path: req.path,
                errors: [{ field: "file", code: "REQUIRED", message: "file is required" }]
            });
    }

    if (file.size > env.maxUploadBytes)
    {
        return res.status(400).json(
            {
                status: 400,
                code: "DOCUMENT_FILE_TOO_LARGE",
                message: "Request validation failed",
                path: req.path,
                errors: [{ field: "file", code: "FILE_TOO_LARGE", message: "file exceeds the maximum upload size" }]
            });
    }

    if (env.blockedMimeTypes.includes(file.mimetype))
    {
        return res.status(400).json(
            {
                status: 400,
                code: "DOCUMENT_BLOCKED_MIME_TYPE",
                message: "Request validation failed",
                path: req.path,
                errors: [{ field: "mimeType", code: "MIME_TYPE_BLOCKED", message: "this file type is not permitted" }]
            });
    }

    const idempotencyKey = req.header("Idempotency-Key");
    if (!idempotencyKey)
    {
        return res.status(400).json(
            {
                status: 400,
                code: "DOCUMENT_VALIDATION_ERROR",
                message: "Request validation failed",
                path: req.path,
                errors: [{ field: "Idempotency-Key", code: "REQUIRED", message: "Idempotency-Key header is required" }]
            });
    }

    const checksum = documentsService.computeChecksum(file.buffer);
    const fingerprint = `${checksum}|${req.body.description || ""}`;

    const existing = await idempotencyService.findRecord(idempotencyKey);
    if (existing)
    {
        if (existing.request_fingerprint !== fingerprint)
        {
            return res.status(409).json(
                {
                    status: 409,
                    code: "IDEMPOTENCY_KEY_REUSED",
                    message: "Idempotency-Key was already used with a different request body",
                    path: req.path
                });
        }
        return res.status(existing.status_code).json(existing.response_body);
    }

    const allowedUpload = await checkPermission(userId, "DOCUMENT_UPLOAD");
    if (!allowedUpload)
    {
        return res.status(403).json(
            {
                status: 403,
                code: "DOCUMENT_FORBIDDEN",
                message: "Caller lacks permission to upload documents to this case",
                path: req.path
            });
    }

    const caseExists = await assertCaseExists(caseId, tenantId);
    if (!caseExists)
    {
        return res.status(404).json(
            {
                status: 404,
                code: "CASE_NOT_FOUND",
                message: "Case not found",
                path: req.path
            });
    }

    const document = await documentsService.uploadDocument({ tenantId, userId, caseId, file, checksum });
    const responseBody = documentsService.toResponse(document);

    await idempotencyService.saveRecord(idempotencyKey, fingerprint, 201, responseBody);

    res.status(201).json(responseBody);
}

async function listDocuments(req, res)
{
    const { tenantId, userId } = req.user;
    const { caseId } = req.params;

    const allowed = await checkPermission(userId, "DOCUMENT_READ");
    if (!allowed)
    {
        return res.status(403).json(
            {
                status: 403,
                code: "DOCUMENT_FORBIDDEN",
                message: "Caller may not view documents for this case",
                path: req.path
            });
    }

    const page = Number(req.query.page) || 0;
    const size = Number(req.query.size) || 20;

    const result = await documentsService.listDocuments({ tenantId, caseId, page, size });

    res.status(200).json(
        {
            content: result.content.map(documentsService.toResponse),
            page: result.page,
            size: result.size,
            totalElements: result.totalElements,
            totalPages: result.totalPages
        });
}

async function getDocument(req, res)
{
    const { tenantId, userId } = req.user;
    const { caseId, documentId } = req.params;

    const allowed = await checkPermission(userId, "DOCUMENT_READ");
    if (!allowed)
    {
        return res.status(403).json(
            {
                status: 403,
                code: "DOCUMENT_FORBIDDEN",
                message: "Caller may not view this document",
                path: req.path
            });
    }

    const document = await documentsService.getDocumentById(tenantId, caseId, documentId);
    if (!document)
    {
        return res.status(404).json(
            {
                status: 404,
                code: "DOCUMENT_NOT_FOUND",
                message: "Document not found",
                path: req.path
            });
    }

    res.status(200).json(documentsService.toResponse(document));
}

async function downloadDocument(req, res)
{
    const { tenantId, userId } = req.user;
    const { caseId, documentId } = req.params;

    const allowed = await checkPermission(userId, "DOCUMENT_READ");
    if (!allowed)
    {
        return res.status(403).json(
            {
                status: 403,
                code: "DOCUMENT_FORBIDDEN",
                message: "Caller may not download this document",
                path: req.path
            });
    }

    const document = await documentsService.getDocumentById(tenantId, caseId, documentId);
    if (!document)
    {
        return res.status(404).json(
            {
                status: 404,
                code: "DOCUMENT_NOT_FOUND",
                message: "Document not found",
                path: req.path
            });
    }

    if (env.enforceScanGate && document.scan_status !== "CLEAN")
    {
        return res.status(403).json(
            {
                status: 403,
                code: "DOCUMENT_NOT_YET_SCANNED",
                message: `Document scan status is ${document.scan_status}, not CLEAN`,
                path: req.path
            });
    }

    const url = await s3Client.getPresignedDownloadUrl(document.storage_key, document.filename);
    res.redirect(302, url);
}

async function uploadVersion(req, res)
{
    const { tenantId, userId } = req.user;
    const { caseId, documentId } = req.params;
    const file = req.file;

    if (!file)
    {
        return res.status(400).json(
            {
                status: 400,
                code: "DOCUMENT_VALIDATION_ERROR",
                message: "Request validation failed",
                path: req.path,
                errors: [{ field: "file", code: "REQUIRED", message: "file is required" }]
            });
    }

    if (file.size > env.maxUploadBytes)
    {
        return res.status(400).json(
            {
                status: 400,
                code: "DOCUMENT_FILE_TOO_LARGE",
                message: "Request validation failed",
                path: req.path,
                errors: [{ field: "file", code: "FILE_TOO_LARGE", message: "file exceeds the maximum upload size" }]
            });
    }

    if (env.blockedMimeTypes.includes(file.mimetype))
    {
        return res.status(400).json(
            {
                status: 400,
                code: "DOCUMENT_BLOCKED_MIME_TYPE",
                message: "Request validation failed",
                path: req.path,
                errors: [{ field: "mimeType", code: "MIME_TYPE_BLOCKED", message: "this file type is not permitted" }]
            });
    }

    const idempotencyKey = req.header("Idempotency-Key");
    if (!idempotencyKey)
    {
        return res.status(400).json(
            {
                status: 400,
                code: "DOCUMENT_VALIDATION_ERROR",
                message: "Request validation failed",
                path: req.path,
                errors: [{ field: "Idempotency-Key", code: "REQUIRED", message: "Idempotency-Key header is required" }]
            });
    }

    const checksum = documentsService.computeChecksum(file.buffer);
    const fingerprint = `${documentId}|${checksum}`;

    const existing = await idempotencyService.findRecord(idempotencyKey);
    if (existing)
    {
        if (existing.request_fingerprint !== fingerprint)
        {
            return res.status(409).json(
                {
                    status: 409,
                    code: "IDEMPOTENCY_KEY_REUSED",
                    message: "Idempotency-Key was already used with a different request body",
                    path: req.path
                });
        }
        return res.status(existing.status_code).json(existing.response_body);
    }

    const allowed = await checkPermission(userId, "DOCUMENT_MANAGE");
    if (!allowed)
    {
        return res.status(403).json(
            {
                status: 403,
                code: "DOCUMENT_FORBIDDEN",
                message: "Caller lacks permission to add a new version to this document",
                path: req.path
            });
    }

    const existingDocument = await documentsService.getDocumentById(tenantId, caseId, documentId);
    if (!existingDocument)
    {
        return res.status(404).json(
            {
                status: 404,
                code: "DOCUMENT_NOT_FOUND",
                message: "Document not found",
                path: req.path
            });
    }

    const updatedDocument = await documentsService.uploadNewVersion({ tenantId, caseId, userId, documentId, file, checksum });
    const responseBody = documentsService.toResponse(updatedDocument);

    await idempotencyService.saveRecord(idempotencyKey, fingerprint, 201, responseBody);

    res.status(201).json(responseBody);
}

async function listVersions(req, res)
{
    const { tenantId, userId } = req.user;
    const { caseId, documentId } = req.params;

    const allowed = await checkPermission(userId, "DOCUMENT_READ");
    if (!allowed)
    {
        return res.status(403).json(
            {
                status: 403,
                code: "DOCUMENT_FORBIDDEN",
                message: "Caller may not view versions for this document",
                path: req.path
            });
    }

    const document = await documentsService.getDocumentById(tenantId, caseId, documentId);
    if (!document)
    {
        return res.status(404).json(
            {
                status: 404,
                code: "DOCUMENT_NOT_FOUND",
                message: "Document not found",
                path: req.path
            });
    }

    const versions = await documentsService.listVersions(documentId);

    res.status(200).json({ content: versions.map(documentsService.toVersionResponse) });
}

async function downloadVersion(req, res)
{
    const { tenantId, userId } = req.user;
    const { caseId, documentId, versionNumber } = req.params;

    const allowed = await checkPermission(userId, "DOCUMENT_READ");
    if (!allowed)
    {
        return res.status(403).json(
            {
                status: 403,
                code: "DOCUMENT_FORBIDDEN",
                message: "Caller may not download this document version",
                path: req.path
            });
    }

    const document = await documentsService.getDocumentById(tenantId, caseId, documentId);
    if (!document)
    {
        return res.status(404).json(
            {
                status: 404,
                code: "DOCUMENT_NOT_FOUND",
                message: "Document not found",
                path: req.path
            });
    }

    if (env.enforceScanGate && document.scan_status !== "CLEAN")
    {
        return res.status(403).json(
            {
                status: 403,
                code: "DOCUMENT_NOT_YET_SCANNED",
                message: `Document scan status is ${document.scan_status}, not CLEAN`,
                path: req.path
            });
    }

    const version = await documentsService.getVersionByNumber(documentId, Number(versionNumber));
    if (!version)
    {
        return res.status(404).json(
            {
                status: 404,
                code: "DOCUMENT_VERSION_NOT_FOUND",
                message: "Document version not found",
                path: req.path
            });
    }

    const url = await s3Client.getPresignedDownloadUrl(version.storage_key, document.filename);
    res.redirect(302, url);
}

module.exports =
    {
        uploadDocument,
        listDocuments,
        getDocument,
        downloadDocument,
        uploadVersion,
        listVersions,
        downloadVersion
    };