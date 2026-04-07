const express = require('express');
const router = express.Router()
const { makePromptwithWebsiteData, makePromptwithPDFData } = require('../controllers/ai.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const multer = require("multer")
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

router.post('/make-prompt/website/:chatbotId', authMiddleware, makePromptwithWebsiteData);
router.post("/make-prompt/pdf/:id", authMiddleware, upload.single("file"), makePromptwithPDFData)

module.exports = router