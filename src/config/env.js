require("dotenv").config();

const env =
    {
        dbHost: process.env.DB_HOST,
        dbPort: process.env.DB_PORT,
        dbName: process.env.DB_NAME,
        dbUser: process.env.DB_USER,
        dbPassword: process.env.DB_PASSWORD,

        s3Endpoint: process.env.S3_ENDPOINT,
        s3AccessKey: process.env.S3_ACCESS_KEY,
        s3SecretKey: process.env.S3_SECRET_KEY,
        s3Bucket: process.env.S3_BUCKET,
        s3Region: process.env.S3_REGION,

        enforceScanGate: process.env.ENFORCE_SCAN_GATE === "true",

        maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES),
        blockedMimeTypes: (process.env.BLOCKED_MIME_TYPES || "").split(",").filter(Boolean),

        kafkaBrokers: (process.env.KAFKA_BROKERS || "").split(","),
        kafkaTopic: process.env.KAFKA_TOPIC,
        kafkaClientId: process.env.KAFKA_CLIENT_ID,
        outboxPollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS)
    };

module.exports = env;