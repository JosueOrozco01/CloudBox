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
      next(error);
    }
  },

  async getSharedByUser(req, res, next) {
    try {
      // Fetch shares dispatched by the authenticated session owner
      const shares = await ShareService.getSharedByUser(req.user.id);

      return res.status(200).json({
        success: true,
        data: shares
      });
    } catch (error) {
      next(error);
    }
  },

  async getSharedFilesWithUser(req, res, next) {
    try {
      // Fetch active files granted to the authenticated recipient
      const shares = await ShareService.getSharedFilesWithUser(req.user.id);

      return res.status(200).json({
        success: true,
        data: shares
      });
    } catch (error) {
      next(error);
    }
  },

  async getShareById(req, res, next) {
    try {
      // Validate participation of the caller before exposing share detail
      const share = await ShareService.getShareById({
        shareId: req.params.id,
        userId: req.user.id
      });

      return res.status(200).json({
        success: true,
        data: share
      });
    } catch (error) {
      next(error);
    }
  },

  async changePermission(req, res, next) {
    try {
      // Enforce the authenticated caller as the actor attempting the permission modification
      const updatedShare = await ShareService.changePermission({
        shareId: req.params.id,
        actorUserId: req.user.id,
        permissionId: req.body.permissionId
      });

      return res.status(200).json({
        success: true,
        data: updatedShare
      });
    } catch (error) {
      next(error);
    }
  },

  async revokeShare(req, res, next) {
    try {
      // Pass token identity to ensure only the owner can revoke active access
      const revokedShare = await ShareService.revokeShare({
        shareId: req.params.id,
        actorUserId: req.user.id
      });

      return res.status(200).json({
        success: true,
        data: revokedShare
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = shareController;
