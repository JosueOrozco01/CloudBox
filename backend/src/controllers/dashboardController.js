/*
 * CloudBox - Controlador del Dashboard
 *
 * Este controlador proporciona al frontend la información
 * necesaria para construir el resumen del usuario.
 *
 * Puede proporcionar:
 *
 * - Cantidad de archivos.
 * - Espacio utilizado.
 * - Espacio disponible.
 * - Archivos recientes.
 * - Compartidos recientes.
 * - Información de pagos.
 *
 * Debe devolver únicamente la información necesaria
 * para el Dashboard.
 */
const QuotaService = require('../services/quota.service');
const dashboardDb = require('../config/dashboard-supabase');

exports.getSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const db = dashboardDb;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    let filesQuery = db.from('archivo')
      .select('id, nombre, tamano_bytes, fecha_subida, fecha_modificacion', { count: 'exact' })
      .eq('id_usuario', userId).eq('id_estado', 1);
    if (search) filesQuery = filesQuery.ilike('nombre', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
    const [files, fileCount, folders, storage] = await Promise.all([
      filesQuery.order('fecha_subida', { ascending: false }).limit(5),
      db.from('archivo').select('id', { count: 'exact', head: true }).eq('id_usuario', userId).eq('id_estado', 1),
      db.from('carpeta').select('id', { count: 'exact', head: true }).eq('id_usuario', userId).eq('id_estado', 1),
      req.query.includeStorage === 'false' ? Promise.resolve(null) : QuotaService.getStorageMetrics(userId).catch(error => {
        if (error.code === 'NO_ACTIVE_SUBSCRIPTION') return null;
        throw error;
      }),
    ]);
    for (const result of [files, fileCount, folders]) {
      if (result.error) throw result.error;
    }
    res.json({ success: true, data: {
      fileCount: fileCount.count, folderCount: folders.count,
      recentFiles: files.data, searchCount: files.count, storage,
    } });
  } catch (error) { next(error); }
};
