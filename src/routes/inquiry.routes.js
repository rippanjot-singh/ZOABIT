const express = require('express');
const router = express.Router();
const { getInquiriesController, createInquiryFromWidget, deleteInquiryController } = require('../controllers/inquiry.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.get('/', authMiddleware, getInquiriesController);
router.post('/create-from-widget', createInquiryFromWidget); // Public route
router.delete('/:id', authMiddleware, deleteInquiryController);

module.exports = router;
