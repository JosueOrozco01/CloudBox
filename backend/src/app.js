
const express = require('express');
const cors = require('cors');

// Routes
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const emailHookRoutes = require('./routes/emailHook.routes');
const adminRoutes = require('./routes/admin.routes');
const folderRoutes = require('./routes/folder.routes');
const fileRoutes = require('./routes/file.routes');
const shareRoutes = require('./routes/share.routes');
const userRoutes = require('./routes/user.routes');
const favoriteRoutes = require('./routes/favorite.routes');
const activityRoutes = require('./routes/activity.routes');
const notificationRoutes = require('./routes/notification.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

// Middlewares
const notFound = require('./middlewares/not-found.middleware');
const errorHandler = require('./middlewares/error-handler.middleware');

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
app.use('/api/favorites', favoriteRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Handle requests that do not match any route
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
