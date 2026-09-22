require('dotenv').config();

const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use('/health', healthRoutes);

app.use(errorHandler);

module.exports = app;