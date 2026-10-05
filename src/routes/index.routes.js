const express = require('express');
const router = express.Router();
const indexController = require('../controllers/index.controller');

// View Routes
router.get('/', indexController.renderHome);

// Health Check API
router.get('/health', indexController.getHealth);
router.get('/api/health', indexController.getHealth);

// REST API Endpoints
router.get('/api/projects', indexController.getProjects);
router.post('/api/projects', indexController.createProject);
router.post('/api/auth/login', indexController.handleLogin);

module.exports = router;
