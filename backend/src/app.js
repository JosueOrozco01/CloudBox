require('dotenv').config();

const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health.routes');

const notFound = require('./middlewares/not-found.middleware');
const errorHandler = require('./middlewares/error-handler.middleware');

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRoutes);

// app.use('/api/auth', authRoutes);
// app.use('/api/files', fileRoutes);

// Handle requests that do not match any route.
app.use(notFound);

// Global error handler must always be the last middleware.
app.use(errorHandler);

module.exports = app;