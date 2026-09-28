const express = require("express");
const fakeAuth = require("./middleware/auth");
const documentsRouter = require("./routes/documents");

const app = express();
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

const swaggerDocument = YAML.load(path.join(__dirname, "..", "openapi.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(express.json());
app.use(fakeAuth);

app.get("/health", (req, res) =>
{
    res.status(200).json({ status: "ok" });
});

app.use("/api/v1/cases/:caseId/documents", documentsRouter);

module.exports = app;