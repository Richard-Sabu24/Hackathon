const projectService = require('../services/project.service');
const config = require('../config');
const { apiResponse } = require('../utils/helpers');

/**
 * Render main application page
 */
function renderHome(req, res) {
  res.render('index', {
    title: 'MaskLab | Media Studio',
    appName: config.appName,
    env: config.nodeEnv
  });
}

/**
 * Health check endpoint
 */
function getHealth(req, res) {
  res.status(200).json(apiResponse(true, {
    status: 'healthy',
    app: config.appName,
    version: config.appVersion,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  }));
}

/**
 * Get all projects
 */
function getProjects(req, res) {
  const projects = projectService.getAll();
  res.status(200).json(projects);
}

/**
 * Create a new project
 */
function createProject(req, res, next) {
  try {
    const { type, name, id, date } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json(apiResponse(false, null, 'Project name is required'));
    }

    const project = projectService.add({ type, name, id, date });
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle demo authentication / session
 */
function handleLogin(req, res) {
  const { email, type } = req.body;
  const username = (email && typeof email === 'string') ? email.split('@')[0] : 'Guest';

  res.status(200).json(apiResponse(true, {
    username,
    type: type || 'guest',
    authenticated: true
  }, 'Session initialized'));
}

module.exports = {
  renderHome,
  getHealth,
  getProjects,
  createProject,
  handleLogin
};
