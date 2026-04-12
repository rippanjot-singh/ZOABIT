const express = require('express');
const router = express.Router();
const { validateCoupon } = require('../controllers/coupon.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/validate', authMiddleware, validateCoupon);

module.exports = router;
