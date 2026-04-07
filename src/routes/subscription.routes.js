// routes/subscriptions.js
const express = require('express');
const { createSubscription, getSubscription, cancelSubscription } = require('../controllers/subscription.controller');
const router = express.Router();

// POST /api/subscriptions/create
router.post('/create', createSubscription);

// GET /api/subscriptions/:userId
router.get('/:userId', getSubscription);

// POST /api/subscriptions/cancel
router.post('/cancel', cancelSubscription);

module.exports = router;