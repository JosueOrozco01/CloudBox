require('dotenv').config();
require('./src/config/environment').validateEnvironment();

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1),10000).unref();
});
