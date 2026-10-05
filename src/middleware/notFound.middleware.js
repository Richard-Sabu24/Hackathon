const { apiResponse } = require('../utils/helpers');

/**
 * 404 Not Found Middleware
 */
function notFoundHandler(req, res, next) {
  // If request is for an API route or expects JSON
  if (req.path.startsWith('/api/') || (req.accepts('json') && !req.accepts('html'))) {
    return res.status(404).json(apiResponse(false, null, `Resource not found: ${req.originalUrl}`));
  }

  // Otherwise render styled 404 page
  res.status(404).render('404', {
    title: '404 - Page Not Found | MaskLab',
    path: req.originalUrl
  });
}

module.exports = notFoundHandler;
