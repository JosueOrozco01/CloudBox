const ActivityService =
    require('../services/activity.service');

const activityController = {
    async getUserActivity(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);

            const activities =
                await ActivityService.getUserActivity(
                    userId,
                    {
                        limit: req.query.limit,
                        offset: req.query.offset
                    }
                );

            return res.status(200).json({
                success: true,
                data: activities
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }
    }
};

module.exports = activityController;