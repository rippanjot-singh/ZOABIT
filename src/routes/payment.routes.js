const express = require('express');
const router = express.Router();
const { createBYOKOrder } = require('../controllers/payment.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/create-byok-order', authMiddleware, createBYOKOrder);

module.exports = router;
