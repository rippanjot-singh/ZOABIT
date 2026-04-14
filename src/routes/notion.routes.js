const express = require('express');
const router = express.Router();
const { searchNotionController, authNotionController, notionCallbackController } = require('../controllers/notion.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// OAuth Flow
router.get('/auth', authNotionController);
router.get('/callback', notionCallbackController);

// Resource Search
router.get('/search', authMiddleware, searchNotionController);

module.exports = router;
