const express = require('express');
const router = express.Router();
const { generateUserSig } = require('../controllers/authController');

router.post('/generate-user-sig', generateUserSig);

module.exports = router;
