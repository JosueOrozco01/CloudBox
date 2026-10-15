const ShareService = require('../services/share.service');

const shareController = {
  async shareFile(req, res, next) {
    try {
      // Prevent sender spoofing by enforcing token identity over request payload
      const senderUserId = req.user.id;
      const { receiverUserId, fileId, permissionId, expiresAt } = req.body;

      const createdShare = await ShareService.shareFile({
        senderUserId,
        receiverUserId,
        fileId,
        permissionId,
        expiresAt
      });

      return res.status(201).json({
        success: true,
        data: createdShare
      });
    } catch (error) {
      // Delegate handled and unhandled failures to the global error middleware
      next(error);
    }
  }
};

module.exports = shareController;
