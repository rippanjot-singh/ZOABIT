const express = require('express');
const { createChatBotController, getChatBotsController, getChatBotController, deleteChatBotController, askChatBotController, updateChatBotController, getWidgetConfigController } = require('../controllers/chatBot.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const router = express.Router()

router.post('/create', authMiddleware, createChatBotController)
router.get('/', authMiddleware, getChatBotsController)
router.get('/:chatbotId', authMiddleware, getChatBotController)
router.delete('/:chatbotId', authMiddleware, deleteChatBotController)
router.patch('/:chatbotId', authMiddleware, updateChatBotController)
router.post('/ask/:chatbotId', askChatBotController)
router.get('/config/:chatbotId', getWidgetConfigController)


module.exports = router