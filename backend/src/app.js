const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const emailHookRoutes = require('./routes/emailHook.routes');
const adminRoutes = require('./routes/admin.routes');
const folderRoutes = require('./routes/folder.routes');
const fileRoutes = require('./routes/file.routes');
const shareRoutes = require('./routes/share.routes');

const notFound = require('./middlewares/not-found.middleware');
const errorHandler = require('./middlewares/error-handler.middleware');
const userRoutes = require('./routes/user.routes');

const app = express();

// Global middleware
app.use(cors());

// The email hook must receive the raw request body
app.use('/api/hooks', emailHookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', require('./routes/dashboard.routes'));

// Handle requests that do not match any route
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
