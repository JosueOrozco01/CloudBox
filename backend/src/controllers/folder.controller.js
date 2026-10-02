const FolderService = require('../services/folder.service');
const { mockFiles } = require('../fixtures/mock-cloudbox');

const folderController = {
  async getUserFolders(req, res) {
    try {
      const userId = req.user.id;
      const folders = await FolderService.getUserRootFolders(userId);
      res.status(200).json({ success: true, data: folders });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getFolderById(req, res) {
    try {
      const folderId = parseInt(req.params.id, 10);
      const userId = req.user.id;

      if (isNaN(folderId)) {
        return res.status(400).json({ success: false, message: 'ID de carpeta inválido' });
      }

      const folder = await FolderService.getFolderById(folderId, userId);
      if (!folder) {
        return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
      }

      res.status(200).json({ success: true, data: folder });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createFolder(req, res) {
    try {
      const userId = req.user.id;
      const { nombre, id_padre } = req.body;

      const folder = await FolderService.createFolder({ 
        nombre, 
        id_usuario: userId, 
        id_padre: id_padre ? parseInt(id_padre, 10) : null 
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
      const userId = req.user.id;
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
      const userId = req.user.id;

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
      const userId = req.user.id;

      const isRoot = folderIdStr === 'root';
      const folderId = isRoot ? null : parseInt(folderIdStr, 10);

      if (!isRoot && isNaN(folderId)) {
        return res.status(400).json({ success: false, message: 'ID de carpeta inválido' });
      }

      if (!isRoot) {
        const isValid = await FolderService.validateFolderOwnership(folderId, userId);
        if (!isValid) {
          return res.status(404).json({ success: false, message: 'Carpeta no encontrada o sin acceso' });
        }
      }

      let subfolders;
      if (isRoot) {
        subfolders = await FolderService.getUserRootFolders(userId);
      } else {
        subfolders = await FolderService.getSubfolders(folderId, userId);
      }

      const folderFiles = mockFiles.filter(f => f.id_carpeta === folderId && f.id_usuario === userId);

      res.status(200).json({
        success: true,
        data: {
          folders: subfolders,
          files: folderFiles
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = folderController;
