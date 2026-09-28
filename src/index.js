const app = require("./app");
const env = require("./config/env");
const { runOutboxRelay } = require("./workers/outboxRelay");

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
});