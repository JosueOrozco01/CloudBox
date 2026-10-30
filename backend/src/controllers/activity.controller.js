const ActivityService =
    require('../services/activity.service');

const activityController = {
    async getUserActivity(req, res, next) {
        try {
            const userId = parseInt(req.user.id, 10);

            const activities =
                await ActivityService.getUserActivity(
                    userId,
                    {
                        limit: req.query.limit,
                        offset: req.query.offset,
                        from: req.query.from,
                        to: req.query.to,
                        action: req.query.action
                    }
                );

            return res.status(200).json({
                success: true,
                data: activities
            });
        } catch (error) {
            return next(error);
        }
    }
};

module.exports = activityController;