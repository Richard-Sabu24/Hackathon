const express = require('express');
const router = express.Router();
const indexController = require('../controllers/index.controller');
const apiRoutes = require('./api.routes');

// View Routes
router.get('/', indexController.renderHome);
router.get('/health', indexController.getHealth);

// Mount API routes
router.use('/api', apiRoutes);

module.exports = router;
