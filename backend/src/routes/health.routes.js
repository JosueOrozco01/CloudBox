const router = require('express').Router();
// Public liveness checks never change authentication or send messages.
router.get('/', (req, res) => res.json({ success: true, timestamp: new Date().toISOString() }));
module.exports = router;
