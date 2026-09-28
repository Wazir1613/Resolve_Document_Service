ALTER TABLE document_versions ADD COLUMN filename VARCHAR(255);

UPDATE document_versions dv
SET filename = d.filename
    FROM documents d
WHERE dv.document_id = d.id AND dv.filename IS NULL;

ALTER TABLE document_versions ALTER COLUMN filename SET NOT NULL;