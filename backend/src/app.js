
const express = require('express');
const cors = require('cors');

// Routes
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const emailHookRoutes = require('./routes/emailHook.routes');
const adminRoutes = require('./routes/admin.routes');
const reportRoutes = require('./routes/report.routes');
const folderRoutes = require('./routes/folder.routes');
const fileRoutes = require('./routes/file.routes');
const shareRoutes = require('./routes/share.routes');
const userRoutes = require('./routes/user.routes');
const favoriteRoutes = require('./routes/favorite.routes');
const activityRoutes = require('./routes/activity.routes');
const notificationRoutes = require('./routes/notification.routes');
const paymentRoutes = require('./routes/payment.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const subscriptionRoutes = require('./routes/subscription.routes');

// Rutas Fase 7
const planRoutes = require('./routes/plan.routes');
const storageControlRoutes = require('./routes/storage-control.routes');

// Middlewares
const notFound = require('./middlewares/not-found.middleware');
const errorHandler = require('./middlewares/error-handler.middleware');

const app = express();

// Global middleware
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:5178').split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  callback(Object.assign(new Error('Origen no permitido.'), {status:403,code:'ORIGIN_NOT_ALLOWED'}));
}}));
app.use((req,res,next) => {
  res.set('X-Content-Type-Options','nosniff');
  res.set('Referrer-Policy','strict-origin-when-cross-origin');
  res.set('X-Frame-Options','DENY');
  next();
});

// The email hook must receive the raw request body
app.use('/api/hooks', emailHookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/users', userRoutes);
app.use('/api/support', require('./routes/support.routes'));
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Rutas Fase 7
app.use('/api/plans', planRoutes);
app.use('/api/storage', storageControlRoutes);

// Handle requests that do not match any route
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
