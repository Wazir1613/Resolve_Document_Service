CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE documents (
                           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                           organization_id UUID NOT NULL,
                           case_id UUID,
                           comment_id UUID,
                           uploaded_by UUID NOT NULL,
                           filename VARCHAR(255) NOT NULL,
                           mime_type VARCHAR(100) NOT NULL,
                           size_bytes BIGINT NOT NULL,
                           checksum VARCHAR(128) NOT NULL,
                           storage_key VARCHAR(500) NOT NULL,
                           scan_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                               CHECK (scan_status IN ('PENDING','CLEAN','INFECTED','FAILED')),
                           current_version INTEGER NOT NULL DEFAULT 1,
                           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                           CHECK (case_id IS NOT NULL OR comment_id IS NOT NULL)
);

CREATE TABLE document_versions (
                                   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                   document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                                   version_number INTEGER NOT NULL,
                                   storage_key VARCHAR(500) NOT NULL,
                                   checksum VARCHAR(128) NOT NULL,
                                   size_bytes BIGINT NOT NULL,
                                   uploaded_by UUID NOT NULL,
                                   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                   UNIQUE (document_id, version_number)
);

CREATE TABLE outbox_events (
                               id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                               organization_id UUID NOT NULL,
                               aggregate_type VARCHAR(50) NOT NULL,
                               aggregate_id UUID NOT NULL,
                               event_type VARCHAR(100) NOT NULL,
                               event_version INTEGER NOT NULL DEFAULT 1,
                               payload JSONB NOT NULL,
                               status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PUBLISHED','FAILED')),
                               retry_count INTEGER NOT NULL DEFAULT 0,
                               available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                               created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                               published_at TIMESTAMPTZ
);