CREATE TABLE idempotency_keys (
                                  key TEXT PRIMARY KEY,
                                  request_fingerprint TEXT NOT NULL,
                                  status_code INTEGER NOT NULL,
                                  response_body JSONB NOT NULL,
                                  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);