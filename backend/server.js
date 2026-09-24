require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('Puerto configurado:', PORT);
    console.log(
        `CloudBox Backend ejecutándose en http://localhost:${PORT}`
    );
});