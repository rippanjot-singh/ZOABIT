const express = require('express');
const { authGoogleController, googleCallbackController } = require('../controllers/google.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/auth', authGoogleController); 
router.get('/callback', googleCallbackController);

module.exports = router;
