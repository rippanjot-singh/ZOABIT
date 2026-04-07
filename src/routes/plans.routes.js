const express = require('express');
const { createPlan } = require('../controllers/plans.controller');
const router = express.Router();

router.post('/create', createPlan);

module.exports = router;