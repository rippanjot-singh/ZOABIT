const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.get('/dashboard-data', authMiddleware, getDashboardData);

module.exports = router;
