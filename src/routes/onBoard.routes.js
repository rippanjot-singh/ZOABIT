const express = require('express');
const router = express.Router()
const { isOnboarded } = require('../controllers/user.controller');

router.put('/skip/:id', isOnboarded);

module.exports = router;