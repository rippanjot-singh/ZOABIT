const express = require('express');
const router = express.Router();
const { createBYOKOrder, createChatAddonOrder } = require('../controllers/payment.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/create-byok-order', authMiddleware, createBYOKOrder);
router.post('/create-chat-addon-order', authMiddleware, createChatAddonOrder);

module.exports = router;
