const express = require("express");
const multer = require("multer");
const controller = require("../controllers/documentsController");

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router({ mergeParams: true });

router.post("/", upload.single("file"), controller.uploadDocument);
router.get("/", controller.listDocuments);
router.get("/:documentId", controller.getDocument);
router.get("/:documentId/download", controller.downloadDocument);

router.post("/:documentId/versions", upload.single("file"), controller.uploadVersion);
router.get("/:documentId/versions", controller.listVersions);
router.get("/:documentId/versions/:versionNumber/download", controller.downloadVersion);

module.exports = router;