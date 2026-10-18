
const express = require('express');

const activity = require('../middlewares/client-activity.middleware');
const requireAuth = require('../middlewares/auth.middleware');

const shareController = require('../controllers/share.controller');
const ShareService = require('../services/share.service');

const router = express.Router();

// Proteger todas las rutas
router.use(requireAuth);

// Resolver el correo del receptor antes de compartir
router.use(async (req, res, next) => {
    if (
        req.method !== 'POST' ||
        !req.body?.receiverEmail
    ) {
        return next();
    }

    try {
        req.body.receiverUserId =
            await ShareService.resolveReceiver(
                req.body.receiverEmail
            );

        return next();
    } catch (error) {
        return next(error);
    }
});

// Manejar respuestas de operaciones del servicio
const handle = (operation, status = 200) => {
    return async (req, res, next) => {
        try {
            const data = await operation(req);

            return res.status(status).json({
                success: true,
                data
            });
        } catch (error) {
            return next(error);
        }
    };
};

// ==========================================
// POST - Compartir recursos
// ==========================================

// Compartir archivo
router.post(
    '/files',
    activity({
        action: 'COMPARTIR_ARCHIVO',
        entity: 'archivo',
        description: 'Archivo compartido correctamente.'
    }),
    shareController.shareFile
);

// Compartir carpeta
router.post(
    '/folders',
    activity({
        action: 'COMPARTIR_CARPETA',
        entity: 'carpeta',
        description: 'Carpeta compartida correctamente.'
    }),
    shareController.shareFolder
);

// ==========================================
// GET - Consultar recursos compartidos
// ==========================================

// Buscar usuarios para compartir
router.get(
    '/recipients',
    handle((req) =>
        ShareService.searchRecipients({
            userId: req.user.id,
            query: req.query.q
        })
    )
);

// Recursos enviados por el usuario
router.get(
    '/sent',
    shareController.getSharedByUser
);

// Archivos recibidos
router.get(
    '/received/files',
    shareController.getSharedFilesWithUser
);

// Carpetas recibidas
router.get(
    '/received/folders',
    shareController.getSharedFoldersWithUser
);

// Consultar contenido de una carpeta compartida
router.get(
    '/folders/:id/content',
    handle((req) =>
        ShareService.getSharedFolderContent({
            userId: req.user.id,
            folderId: req.params.id
        })
    )
);

// Obtener URL temporal para descargar archivo compartido
router.get(
    '/files/:id/download-url',
    activity({
        action: 'DESCARGAR_ARCHIVO',
        entity: 'archivo',
        description:
            'Acceso de descarga a archivo compartido autorizado mediante URL temporal.'
    }),
    handle((req) =>
        ShareService.getSharedDownload({
            userId: req.user.id,
            fileId: req.params.id
        })
    )
);

// Obtener un recurso compartido por ID
router.get(
    '/:id',
    shareController.getShareById
);

// ==========================================
// PATCH - Administrar recursos compartidos
// ==========================================

// Cambiar permisos
router.patch(
    '/:id/permission',
    shareController.changePermission
);

// Revocar acceso
router.patch(
    '/:id/revoke',
    shareController.revokeShare
);

module.exports = router;
