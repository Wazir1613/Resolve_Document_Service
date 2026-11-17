const app = require("./app");
const env = require("./config/env");
const { runOutboxRelay } = require("./workers/outboxRelay");
const { runScanRelay } = require("./workers/scanRelay");

const PORT = 3000;

app.listen(PORT, () =>
{
    console.log(`document-service listening on port ${PORT}`);

    setInterval(() =>
    {
        runOutboxRelay().catch((error) =>
        {
            console.error("Outbox relay error:", error);
        });
    }, env.outboxPollIntervalMs);

    setInterval(() =>
    {
        runScanRelay().catch((error) =>
        {
            console.error("Scan relay error:", error);
        });
    }, env.scanPollIntervalMs);
});