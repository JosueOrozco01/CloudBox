const FolderService = require('../services/folder.service');
const FileService = require('../services/file.service');
const ActivityService = require('../services/activity.service');
const ShareService = require('../services/share.service');

const folderController = {
  async getTrashFolders(req, res, next) {
    try { res.json({ success: true, data: await FolderService.getTrashFolders(req.user.id) }); }
    catch (error) { next(error); }
  },
  async getUserFolders(req, res) {
    try {
      const userId = parseInt(req.user.id, 10);
      const folders = await FolderService.getUserRootFolders(userId);
      res.status(200).json({ success: true, data: folders });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getFolderById(req, res) {
    try {
      const folderId = parseInt(req.params.id, 10);
      const userId = parseInt(req.user.id, 10);

      if (isNaN(folderId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de carpeta inválido'
        });
      }

      let folder =
        await FolderService.getFolderById(
          folderId,
          userId
        );

      if (!folder) {
        const access =
          await ShareService.validateFolderAccess({
            userId,
            folderId,
            requiredPermission: 2
          });

        if (!access.hasAccess) {
          return res.status(404).json({
            success: false,
            message: 'Carpeta no encontrada'
          });
        }

        folder =
          await FolderService.getActiveFolderById(
            folderId
          );
      }

      if (!folder) {
        return res.status(404).json({
          success: false,
          message: 'Carpeta no encontrada'
        });
      }

      return res.status(200).json({
        success: true,
        data: folder
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }
  },
  async createFolder(req, res) {
    try {
      const userId = parseInt(req.user.id, 10);
      const { nombre, id_padre } = req.body;

      const folder = await FolderService.createFolder({
        nombre,
        id_usuario: userId,
        id_padre: id_padre ? parseInt(id_padre, 10) : null
      });

      await ActivityService.recordActivity({
        userId,
        action: ActivityService.ACTIONS.CREATE_FOLDER,
        description: `Creó la carpeta "${folder.nombre}"`,
        folderId: folder.id
      });

      res.status(201).json({ success: true, data: folder });
    } catch (error) {
      if (error.message.includes('vacío') || error.message.includes('Ya existe')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateFolderName(req, res) {
    try {
      const folderId = parseInt(req.params.id, 10);
      const userId = parseInt(req.user.id, 10);
      const { nombre } = req.body;

      if (isNaN(folderId)) {
        return res.status(400).json({ success: false, message: 'ID de carpeta inválido' });
      }

      const folder = await FolderService.updateFolderName(folderId, userId, nombre);
      res.status(200).json({ success: true, data: folder });
    } catch (error) {
      if (error.message.includes('vacío') || error.message.includes('Ya existe')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error.message.includes('no encontrada') || error.message.includes('sin permisos')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getSubfolders(req, res) {
    try {
      const folderId = parseInt(req.params.id, 10);
      const userId = parseInt(req.user.id, 10);

      if (isNaN(folderId)) {
        return res.status(400).json({ success: false, message: 'ID de carpeta inválido' });
      }

      const isValid = await FolderService.validateFolderOwnership(folderId, userId);
      if (!isValid) {
        return res.status(404).json({ success: false, message: 'Carpeta no encontrada o sin acceso' });
      }

      const subfolders = await FolderService.getSubfolders(folderId, userId);
      res.status(200).json({ success: true, data: subfolders });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getFolderContent(req, res) {
    try {
      const folderIdStr = req.params.id;
      const userId = parseInt(req.user.id, 10);

      const isRoot = folderIdStr === 'root';
      const folderId = isRoot
        ? null
        : parseInt(folderIdStr, 10);

      if (!isRoot && isNaN(folderId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de carpeta inválido'
        });
      }

      let isOwner = true;

      if (!isRoot) {
        const ownedFolder =
          await FolderService.getFolderById(
            folderId,
            userId
          );

        if (!ownedFolder) {
          isOwner = false;

          const access =
            await ShareService.validateFolderAccess({
              userId,
              folderId,
              requiredPermission: 2
            });

          if (!access.hasAccess) {
            return res.status(404).json({
              success: false,
              message:
                'Carpeta no encontrada o sin acceso'
            });
          }
        }
      }

      let subfolders;
      let folderFiles;

      if (isRoot) {
        subfolders =
          await FolderService.getUserRootFolders(
            userId
          );

        folderFiles =
          await FileService.getUserFiles(
            userId,
            null
          );
      } else if (isOwner) {
        subfolders =
          await FolderService.getSubfolders(
            folderId,
            userId
          );

        folderFiles =
          await FileService.getFilesByFolder(
            folderId,
            userId
          );
      } else {
        subfolders =
          await FolderService.getActiveSubfolders(
            folderId
          );

        folderFiles =
          await FileService.getActiveFilesByFolder(
            folderId
          );
      }

      return res.status(200).json({
        success: true,
        data: {
          folders: subfolders,
          files: folderFiles
        }
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }
  },

  async moveFolder(req, res) {
    try {
      const folderId = parseInt(req.params.id, 10);
      const userId = parseInt(req.user.id, 10);
      const { id_padre } = req.body;

      if (isNaN(folderId)) {
        return res.status(400).json({ success: false, message: 'ID de carpeta inválido' });
      }

      const newParentId = id_padre ? parseInt(id_padre, 10) : null;

      const folder = await FolderService.moveFolder(folderId, newParentId, userId);
      res.status(200).json({ success: true, data: folder });
    } catch (error) {
      if (error.message.includes('No puedes mover') || error.message.includes('Ya existe') || error.message.includes('sí misma')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error.message.includes('no encontrada') || error.message.includes('sin permisos')) {
        return res.status(403).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteFolder(req, res) {
    try {
      const folderId = Number(req.params.id);
      const userId = Number(req.user.id);

      if (!Number.isSafeInteger(folderId) || folderId <= 0) {
        return res.status(400).json({ success: false, code: 'INVALID_FOLDER_ID', message: 'ID de carpeta inválido' });
      }

      const result = await FolderService.deleteFolderCascade(folderId, userId);

      await ActivityService.recordActivity({
        userId,
        action: ActivityService.ACTIONS.DELETE_FOLDER,
        description: 'Envió una carpeta a la papelera',
        folderId
      });

      return res.status(200).json(result);
    } catch (error) {
      // The database function validates ownership and states.
      if (error.message.includes('no encontrada') || error.message.includes('sin permisos')) {
        return res.status(404).json({ success: false, code: 'FOLDER_NOT_FOUND', message: 'Carpeta no encontrada o sin acceso' });
      }

      console.error('Folder deletion failed:', error);
      return res.status(500).json({ success: false, code: 'FOLDER_DELETE_FAILED', message: 'No se pudo enviar la carpeta a papelera' });
    }
  },

  async restoreFolder(req, res) {
    try {
      const folderId = Number(req.params.id);
      const userId = Number(req.user.id);

      if (!Number.isSafeInteger(folderId) || folderId <= 0) {
        return res.status(400).json({ success: false, code: 'INVALID_FOLDER_ID', message: 'ID de carpeta inválido' });
      }

      const result = await FolderService.restoreFolderCascade(folderId, userId);
      return res.status(200).json(result);
    } catch (error) {
      if (error.message.includes('No existe una eliminación pendiente')) {
        return res.status(404).json({ success: false, code: 'FOLDER_RESTORE_NOT_FOUND', message: 'No hay una eliminación pendiente para esta carpeta' });
      }

      if (error.message.includes('no están disponibles') ||
        error.message.includes('no está disponible') ||
        error.message.includes('mismo nombre')) {
        return res.status(409).json({ success: false, code: 'FOLDER_RESTORE_CONFLICT', message: 'No se puede restaurar la carpeta por un conflicto de estado o nombre' });
      }

      console.error('Folder restoration failed:', error);
      return res.status(500).json({ success: false, code: 'FOLDER_RESTORE_FAILED', message: 'No se pudo restaurar la carpeta' });
    }
  }

};

module.exports = folderController;