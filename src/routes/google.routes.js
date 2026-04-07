// src/routes/google.routes.js
const express = require('express');
const { authGoogleController, googleCallbackController, importGoogleDataController, listGoogleFilesController } = require('../controllers/google.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/auth', authGoogleController); // Add authMiddleware if user must be logged in
router.get('/callback', googleCallbackController);
router.post('/import', importGoogleDataController); // Add authMiddleware typically
router.get('/files', authMiddleware, listGoogleFilesController);

module.exports = router;
