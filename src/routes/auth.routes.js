const express = require('express');
const { userRegisterController, userLoginController, userLogoutController, me } = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const router = express.Router()

router.post('/signup', userRegisterController)
router.post('/login', userLoginController)
router.post('/logout', userLogoutController)
router.get('/me', authMiddleware, me)

module.exports = router