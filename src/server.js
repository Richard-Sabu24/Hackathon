const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`  ${config.appName} Studio Server`);
  console.log(`  Local:   http://localhost:${config.port}`);
  console.log(`  Network: http://127.0.0.1:${config.port}`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`=========================================`);
});

// Handle graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force close after 5 seconds if still open
  setTimeout(() => {
    console.error('Forcing shutdown after timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = server;
