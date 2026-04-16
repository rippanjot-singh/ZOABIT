const express = require('express');
const { createChatBotController, getChatBotsController, getChatBotController, deleteChatBotController, askChatBotController, updateChatBotController, getWidgetConfigController, toggleChatBotStatusController, getPublicChatBotController, findSlugController } = require('../controllers/chatBot.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { chatLimiter } = require('../middlewares/rateLimit.middleware');
const router = express.Router()

router.post('/create', authMiddleware, createChatBotController)
router.get('/', authMiddleware, getChatBotsController)
router.get('/public/:slug', getPublicChatBotController)
router.get('/:chatbotId', authMiddleware, getChatBotController)
router.delete('/:chatbotId', authMiddleware, deleteChatBotController)
router.patch('/:chatbotId', authMiddleware, updateChatBotController)
router.patch('/:chatbotId/toggle-status', authMiddleware, toggleChatBotStatusController)
router.post('/ask/:chatbotId', chatLimiter, askChatBotController)
router.get('/config/:chatbotId', getWidgetConfigController)
router.get('/find-slug/:slug', findSlugController)

module.exports = router