const express = require('express');
const router = express.Router();
const { getInquiriesController, deleteInquiryController } = require('../controllers/inquiry.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.get('/', authMiddleware, getInquiriesController);
router.delete('/:id', authMiddleware, deleteInquiryController);

module.exports = router;
