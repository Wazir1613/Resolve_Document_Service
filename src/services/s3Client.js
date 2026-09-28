const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const env = require("../config/env");

process.env.AWS_REGION = env.s3Region;
process.env.AWS_ACCESS_KEY_ID = env.s3AccessKey;
process.env.AWS_SECRET_ACCESS_KEY = env.s3SecretKey;

const s3 = new S3Client(
    {
        endpoint: env.s3Endpoint,
        region: env.s3Region,
        forcePathStyle: true,
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        credentials:
            {
                accessKeyId: env.s3AccessKey,
                secretAccessKey: env.s3SecretKey
            }
    });

async function uploadBuffer(storageKey, buffer, mimeType)
{
    const command = new PutObjectCommand(
        {
            Bucket: env.s3Bucket,
            Key: storageKey,
            Body: buffer,
            ContentType: mimeType
        });

    await s3.send(command);
}

async function getPresignedDownloadUrl(storageKey, filename)
{
    const command = new GetObjectCommand(
        {
            Bucket: env.s3Bucket,
            Key: storageKey,
            ResponseContentDisposition: `attachment; filename="${filename}"`
        });

    return await getSignedUrl(s3, command, { expiresIn: 60 });
}

module.exports = { uploadBuffer, getPresignedDownloadUrl };