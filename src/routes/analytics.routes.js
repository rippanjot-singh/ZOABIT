const express = require('express');
const router = express.Router();
const { getGlobalAnalytics } = require('../controllers/analytics.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.get('/global', authMiddleware, getGlobalAnalytics);

module.exports = router;
