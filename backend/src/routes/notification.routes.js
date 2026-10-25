const router = require('express').Router();
const controller = require('../controllers/notification.controller');
router.use(require('../middlewares/auth.middleware'));
router.get('/', controller.list);
router.get('/unread', controller.unread);
router.patch('/read-all', controller.readAll);
router.patch('/:id/read', controller.read);
router.delete('/:id', controller.remove);
module.exports = router;
