<<<<<<< HEAD
﻿# Document Service — Resolve

Task 8 of the Resolve project. Handles document upload, versioning,
metadata, and download for cases, with binary storage in an S3-compatible
object store and async event publishing via Kafka.

## Stack

- Node.js + Express
- PostgreSQL (via `pg`)
- S3-compatible object storage: **SeaweedFS** in local dev (MinIO stopped
  shipping free Docker images in late 2025, so it was swapped for this)
- Kafka-compatible messaging: **Redpanda** in local dev
- `multer` (upload parsing), `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
  (S3-compatible client), `kafkajs` (Kafka producer)
- Swagger UI (`swagger-ui-express`) for interactive API docs

## Owned data

| Table | Purpose |
|---|---|
| `documents` | Document metadata: filename, MIME type, size, checksum, storage key, scan status, current version |
| `document_versions` | Full version history. Each version keeps its own filename, storage key, and checksum |
| `outbox_events` | Transactional outbox for reliable Kafka publishing |
| `idempotency_keys` | Idempotency-Key tracking for both upload endpoints |

## Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/cases/{caseId}/documents` | Upload a document (`Idempotency-Key` required) |
| `GET` | `/api/v1/cases/{caseId}/documents` | List documents, paginated |
| `GET` | `/api/v1/cases/{caseId}/documents/{documentId}` | Get metadata |
| `GET` | `/api/v1/cases/{caseId}/documents/{documentId}/download` | Presigned redirect to latest version |
| `POST` | `/api/v1/cases/{caseId}/documents/{documentId}/versions` | Upload a new version (`Idempotency-Key` required) |
| `GET` | `/api/v1/cases/{caseId}/documents/{documentId}/versions` | List version history |
| `GET` | `/api/v1/cases/{caseId}/documents/{documentId}/versions/{versionNumber}/download` | Download a specific version |

Full contract, including error codes and the Kafka event envelope, lives in
`Contracts/Document_Service.md` in the Resolve_Documentation repo.

## Kafka

Produces `resolve.document.uploaded` (`DocumentUploaded`) via a
transactional outbox. The event row is written in the same DB transaction
as the document, and a background relay (`src/workers/outboxRelay.js`)
publishes it separately. On repeated failure, the row is retried with
exponential backoff (1s base, x2, capped at 5 min, 5 attempts) before
routing to `resolve.document.uploaded.dlq`.

## Local setup

1. `docker-compose up -d` brings up Postgres (port `5433`), SeaweedFS
   (port `8333`), and Redpanda (port `9092`).
2. Run the migrations in `migrations/`, in order (`001` to `004`), against
   the `documentdb` database.
3. `npm install`
4. Copy `.env.example` to `.env` and fill in real values.
5. `node src/index.js`
6. Swagger UI: `http://localhost:3000/api-docs`

## Standalone development status

This service is built and testable on its own, without Authentication,
RBAC, Case Management, or Organization Service running. Every external
dependency sits behind a small stub module:

| Real dependency | Stub file | Current behavior |
|---|---|---|
| Authentication (JWT) | `src/middleware/auth.js` | Always injects one fake `{ tenantId, userId }` |
| RBAC | `src/services/permissionClient.js` | Always returns `true` |
| Case Management | `src/services/caseClient.js` | Always confirms the case exists |
| Organization (suspended-tenant check) | not yet stubbed | No check performed |

Swap each stub's internals for a real network call once its owning
service ships. Nothing else in the codebase needs to change.

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Upload, guardrails, checksum, S3, idempotency | Done, tested |
| 2 | List, metadata, download, tenant/case isolation | Done, tested |
| 3 | Versioning (upload/list/download by version) | Done, tested |
| 4 | Outbox relay to Kafka, retry/backoff, DLQ | Built; outage/DLQ retest pending |

## Known gaps

- Real Authentication, RBAC, Case Management, Organization integration
- Virus scanning worker + `resolve.document.scanned` event
- Soft-delete endpoint (designed in the contract, not implemented)
- `idempotency_keys` has no TTL/cleanup job
- Checksum re-verification on download

## Testing

Manual testing via Swagger UI (`/api-docs`) and `curl`/PowerShell for the
redirect-based download endpoints (Swagger's "Try it out" can't follow
those due to CORS). No automated test suite yet.
=======
# Resolve_Document_Service
>>>>>>> 85a1220ddaaaebaa4086140d255e5828168a52ad
