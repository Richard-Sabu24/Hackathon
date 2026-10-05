const config = require('../config');
const { apiResponse } = require('../utils/helpers');

/**
 * Global Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  // Log error details on server
  console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.url}:`, err);

  const statusCode = err.status || err.statusCode || 500;
  const isProd = config.isProduction;

  const errorMessage = isProd
    ? 'Internal Server Error'
    : (err.message || 'Internal Server Error');

  // If API route or expects JSON
  if (req.path.startsWith('/api/') || (req.accepts('json') && !req.accepts('html'))) {
    return res.status(statusCode).json(apiResponse(
      false,
      !isProd && err.stack ? { stack: err.stack } : null,
      errorMessage
    ));
  }

  // Otherwise render styled 500 error page
  res.status(statusCode).render('500', {
    title: '500 - Server Error | MaskLab',
    message: isProd ? 'An unexpected server error occurred. Please try again later.' : err.message,
    statusCode
  });
}

module.exports = errorHandler;
