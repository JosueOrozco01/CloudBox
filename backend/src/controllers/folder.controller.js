const FolderService = require('../services/folder.service');
const FileService = require('../services/file.service');
const ActivityService = require('../services/activity.service');
const ShareService = require('../services/share.service');

const folderController = {
  async getFolderLocations(req, res, next) {
    try {
      res.json({ success: true, data: await FolderService.getFolderLocations(Number(req.user.id)) });
    } catch (error) { next(error); }
  },
  async getTrashFolders(req, res, next) {
    try { res.json({ success: true, data: await FolderService.getTrashFolders(req.user.id) }); }
    catch (error) { next(error); }
  },
  async getUserFolders(req, res, next) {
    try {
      const userId = parseInt(req.user.id, 10);
      const folders = await FolderService.getUserRootFolders(userId);
      res.status(200).json({ success: true, data: folders });
    } catch (error) {
      return next(error);
    }
  },

  async getFolderById(req, res, next) {
    try {
      const folderId = Number(req.params.id);
      const userId = parseInt(req.user.id, 10);

      if ((!Number.isSafeInteger(folderId) || folderId <= 0)) {
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
      if ((error.status || 500) >= 500) return next(error);
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }
  },
  async createFolder(req, res, next) {
    try {
      const userId = parseInt(req.user.id, 10);
      const { nombre, id_padre } = req.body || {};

      const parentId = id_padre
        ? parseInt(id_padre, 10)
        : null;

      if (
        id_padre &&
        ((!Number.isSafeInteger(parentId) || parentId <= 0) || parentId <= 0)
      ) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_FOLDER_ID',
          message: 'ID de carpeta padre inválido'
        });
      }

      let resourceOwnerId = userId;

      if (parentId !== null) {
        const isOwned =
          await FolderService.validateFolderOwnership(
            parentId,
            userId
          );

        if (!isOwned) {
          const access =
            await ShareService.validateFolderAccess({
              userId,
              folderId: parentId,
              requiredPermission: 1
            });

          if (!access.hasAccess) {
            return res.status(403).json({
              success: false,
              code: 'EDITOR_PERMISSION_REQUIRED',
              message:
                'Necesitas permiso de Editor para crear contenido en esta carpeta'
            });
          }

          const parentFolder =
            await FolderService.getActiveFolderById(
              parentId
            );

          if (!parentFolder) {
            return res.status(404).json({
              success: false,
              code: 'FOLDER_NOT_FOUND',
              message: 'Carpeta no encontrada'
            });
          }

          resourceOwnerId =
            parentFolder.id_usuario;
        }
      }

      const folder =
        await FolderService.createFolder({
          nombre,
          id_usuario: resourceOwnerId,
          id_padre: parentId
        });

      await ActivityService.recordActivity({
        userId,
        action:
          ActivityService.ACTIONS.CREATE_FOLDER,
        description:
          `Creó la carpeta "${folder.nombre}"`,
        folderId: folder.id
      });

      return res.status(201).json({
        success: true,
        data: folder
      });
    } catch (error) {
      if (
        error.message.includes('vacío') ||
        error.message.includes('Ya existe')
      ) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if ((error.status || 500) >= 500) return next(error);
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }
  },
  async updateFolderName(req, res, next) {
    try {
      const folderId =
        Number(req.params.id);
      const userId =
        parseInt(req.user.id, 10);

      const { nombre } = req.body || {};

      if ((!Number.isSafeInteger(folderId) || folderId <= 0)) {
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

      let resourceOwnerId = userId;

      if (!folder) {
        const access =
          await ShareService.validateFolderAccess({
            userId,
            folderId,
            requiredPermission: 1
          });

        if (!access.hasAccess) {
          return res.status(403).json({
            success: false,
            code: 'EDITOR_PERMISSION_REQUIRED',
            message:
              'Necesitas permiso de Editor para renombrar esta carpeta'
          });
        }

        folder =
          await FolderService.getActiveFolderById(
            folderId
          );

        if (!folder) {
          return res.status(404).json({
            success: false,
            message: 'Carpeta no encontrada'
          });
        }

        resourceOwnerId = folder.id_usuario;
      }

      const updatedFolder =
        await FolderService.updateFolderName(
          folderId,
          resourceOwnerId,
          nombre
        );

      return res.status(200).json({
        success: true,
        data: updatedFolder
      });
    } catch (error) {
      if (
        error.message.includes('vacío') ||
        error.message.includes('Ya existe')
      ) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if ((error.status || 500) >= 500) return next(error);
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }
  },

  async getSubfolders(req, res, next) {
    try {
      const folderId =
        Number(req.params.id);
      const userId =
        parseInt(req.user.id, 10);

      if ((!Number.isSafeInteger(folderId) || folderId <= 0)) {
        return res.status(400).json({
          success: false,
          message: 'ID de carpeta inválido'
        });
      }

      const isOwned =
        await FolderService.validateFolderOwnership(
          folderId,
          userId
        );

      let subfolders;

      if (isOwned) {
        subfolders =
          await FolderService.getSubfolders(
            folderId,
            userId
          );
      } else {
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

        subfolders =
          await FolderService.getActiveSubfolders(
            folderId
          );
      }

      return res.status(200).json({
        success: true,
        data: subfolders
      });
    } catch (error) {
      if ((error.status || 500) >= 500) return next(error);
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }
  },
  async getFolderContent(req, res, next) {
    try {
      const folderIdStr = req.params.id;
      const userId = parseInt(req.user.id, 10);

      const isRoot = folderIdStr === 'root';
      const folderId = isRoot
        ? null
        : parseInt(folderIdStr, 10);

      if (!isRoot && (!Number.isSafeInteger(folderId) || folderId <= 0)) {
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
      if ((error.status || 500) >= 500) return next(error);
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }
  },

  async moveFolder(req, res, next) {
    try {
      const folderId =
        Number(req.params.id);

      const userId =
        parseInt(req.user.id, 10);

      const { id_padre } = req.body || {};

      if (
        (!Number.isSafeInteger(folderId) || folderId <= 0) ||
        folderId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'ID de carpeta inválido'
        });
      }

      let newParentId = null;

      if (
        id_padre !== undefined &&
        id_padre !== null &&
        id_padre !== ''
      ) {
        newParentId =
          parseInt(id_padre, 10);

        if (
          (!Number.isSafeInteger(newParentId) || newParentId <= 0) ||
          newParentId <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              'ID de carpeta destino inválido'
          });
        }
      }

      let currentFolder =
        await FolderService.getFolderById(
          folderId,
          userId
        );

      let resourceOwnerId = userId;
      const isOwner = Boolean(currentFolder);

      if (!currentFolder) {
        const sourceAccess =
          await ShareService.validateFolderAccess({
            userId,
            folderId,
            requiredPermission: 1
          });

        if (!sourceAccess.hasAccess) {
          return res.status(403).json({
            success: false,
            code:
              'EDITOR_PERMISSION_REQUIRED',
            message:
              'Necesitas permiso de Editor para mover esta carpeta'
          });
        }

        currentFolder =
          await FolderService.getActiveFolderById(
            folderId
          );

        if (!currentFolder) {
          return res.status(404).json({
            success: false,
            code: 'FOLDER_NOT_FOUND',
            message:
              'Carpeta no encontrada'
          });
        }

        resourceOwnerId =
          currentFolder.id_usuario;
      }

      if (!isOwner) {
        if (newParentId === null) {
          return res.status(403).json({
            success: false,
            code:
              'SHARED_ROOT_MOVE_NOT_ALLOWED',
            message:
              'No puedes mover una carpeta compartida fuera del espacio del propietario'
          });
        }

        const destinationAccess =
          await ShareService.validateFolderAccess({
            userId,
            folderId: newParentId,
            requiredPermission: 1
          });

        if (!destinationAccess.hasAccess) {
          return res.status(403).json({
            success: false,
            code:
              'EDITOR_PERMISSION_REQUIRED',
            message:
              'Necesitas permiso de Editor en la carpeta destino'
          });
        }

        const destinationFolder =
          await FolderService.getActiveFolderById(
            newParentId
          );

        if (!destinationFolder) {
          return res.status(404).json({
            success: false,
            code: 'FOLDER_NOT_FOUND',
            message:
              'Carpeta destino no encontrada'
          });
        }

        if (
          destinationFolder.id_usuario !==
          resourceOwnerId
        ) {
          return res.status(403).json({
            success: false,
            code:
              'CROSS_OWNER_MOVE_NOT_ALLOWED',
            message:
              'No se pueden mover recursos entre espacios de distintos propietarios'
          });
        }
      }

      const folder =
        await FolderService.moveFolder(
          folderId,
          newParentId,
          resourceOwnerId
        );

      return res.status(200).json({
        success: true,
        data: folder
      });
    } catch (error) {
      if (
        error.message.includes('No puedes mover') ||
        error.message.includes('Ya existe') ||
        error.message.includes('sí misma')
      ) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if ((error.status || 500) >= 500) return next(error);
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message
      });
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
