const express = require('express');
const path = require('path');
const routes = require('./routes/index.routes');
const notFoundHandler = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static assets from public/
app.use(express.static(path.join(__dirname, '../public')));

// Application Routes
app.use('/', routes);

// 404 handler
app.use(notFoundHandler);

// Global Error handler
app.use(errorHandler);

module.exports = app;
