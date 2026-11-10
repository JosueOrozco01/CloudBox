const validation = require('../services/input-validation');
module.exports = (req, res, next) => {
  try {
    const body = req.body || {};
    req.body = { firstName: validation.text(body.firstName, 'El nombre'), lastName: validation.text(body.lastName, 'El apellido'), email: validation.email(body.email), password: validation.password(body.password) };
    next();
  } catch (error) { next(error); }
};
