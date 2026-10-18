const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const PERMISSIONS = {
  EDITOR: 1,
  VIEWER: 2
};

const SHARE_STATUS = {
  ACTIVE: 1,
  REVOKED: 2
};

const FILE_STATUS = {
  ACTIVE: 1,
  TRASH: 2,
  DELETED: 3
};

const FOLDER_STATUS = {
  ACTIVE: 1,
  TRASH: 2,
  DELETED: 3
};

const USER_STATUS = {
  ACTIVE: 1,
  INACTIVE: 2,
  SUSPENDED: 3
};

function createServiceError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function satisfiesPermission(grantedPermissionId, requiredPermission) {
  if (!requiredPermission) {
    return true;
  }
  const parsedRequired = parseInt(requiredPermission, 10);
  const parsedGranted = parseInt(grantedPermissionId, 10);

  // Editor satisfies both Editor and Viewer requirements
  if (parsedGranted === PERMISSIONS.EDITOR) {
    return true;
  }

  // Viewer only satisfies Viewer requirement
  if (parsedGranted === PERMISSIONS.VIEWER && parsedRequired === PERMISSIONS.VIEWER) {
    return true;
  }

  return false;
}

function getPermissionName(permissionId) {
  if (permissionId === PERMISSIONS.EDITOR) return 'Editor';
  if (permissionId === PERMISSIONS.VIEWER) return 'Visualizador';
  return null;
}

async function resolveFolderInheritedAccess(userId, startFolderId, requiredPermission) {
  if (!startFolderId) {
    return null;
  }

  const visited = new Set();
  const ancestorIds = [];
  let currentFolderId = parseInt(startFolderId, 10);
  const MAX_DEPTH = 25;
  let depth = 0;

  // Traverse upward to gather valid parent folder IDs while guarding against circular graphs
  while (currentFolderId && depth < MAX_DEPTH) {
    if (visited.has(currentFolderId)) {
      break;
    }
    visited.add(currentFolderId);
    ancestorIds.push(currentFolderId);
    depth++;

    const { data: folder, error } = await supabaseAdmin
      .from('carpeta')
      .select('id, id_padre, id_usuario, id_estado')
      .eq('id', currentFolderId)
      .single();

    if (error || !folder || folder.id_estado !== FOLDER_STATUS.ACTIVE) {
      // Abort upward inheritance if any containing ancestor folder is missing or trashed
      return null;
    }

    // If user owns an ancestor folder, grant owner privileges through folder ownership
    if (folder.id_usuario === userId) {
      return {
        hasAccess: true,
        isOwner: true,
        permissionId: null,
        permissionName: 'Propietario',
        source: 'owner',
        shareId: null
      };
    }

    currentFolderId = folder.id_padre ? parseInt(folder.id_padre, 10) : null;
  }

  if (ancestorIds.length === 0) {
    return null;
  }

  const nowIso = new Date().toISOString();

  // Query active unexpired shares across all gathered ancestor folders in a single batch
  const { data: shares, error: shareError } = await supabaseAdmin
    .from('compartir')
    .select('id, id_carpeta, id_permiso, fecha_expiracion')
    .eq('id_usuario_receptor', userId)
    .in('id_carpeta', ancestorIds)
    .eq('id_estado', SHARE_STATUS.ACTIVE)
    .or(`fecha_expiracion.is.null,fecha_expiracion.gt.${nowIso}`);

  if (shareError || !shares || shares.length === 0) {
    return null;
  }

  // Prioritize the highest privilege when multiple ancestor folders are shared
  const bestShare = shares.reduce((prev, current) => {
    return current.id_permiso < prev.id_permiso ? current : prev;
  });

  const hasRequiredAccess = satisfiesPermission(bestShare.id_permiso, requiredPermission);

  return {
    hasAccess: hasRequiredAccess,
    isOwner: false,
    permissionId: bestShare.id_permiso,
    permissionName: getPermissionName(bestShare.id_permiso),
    source: 'inherited',
    shareId: bestShare.id,
    ...(hasRequiredAccess ? {} : { reason: 'INSUFFICIENT_PERMISSION' })
  };
}

const ShareService = {
  async shareFile({ senderUserId, receiverUserId, fileId, permissionId, expiresAt }) {
    const parsedSenderId = parseInt(senderUserId, 10);
    const parsedReceiverId = parseInt(receiverUserId, 10);
    const parsedFileId = parseInt(fileId, 10);
    const parsedPermissionId = parseInt(permissionId, 10);

    if (!parsedSenderId || isNaN(parsedSenderId)) {
      throw createServiceError('El usuario emisor no es válido', 404, 'SENDER_NOT_FOUND');
    }

    if (!parsedReceiverId || isNaN(parsedReceiverId)) {
      throw createServiceError('El usuario receptor no es válido', 404, 'RECEIVER_NOT_FOUND');
    }

    // Prevent users from granting permissions to their own account
    if (parsedSenderId === parsedReceiverId) {
      throw createServiceError('No puedes compartir un archivo contigo mismo', 400, 'CANNOT_SHARE_WITH_SELF');
    }

    if (!parsedFileId || isNaN(parsedFileId)) {
      throw createServiceError('El archivo especificado no es válido', 404, 'FILE_NOT_FOUND');
    }

    if (![PERMISSIONS.EDITOR, PERMISSIONS.VIEWER].includes(parsedPermissionId)) {
      throw createServiceError('El permiso especificado no es válido', 400, 'INVALID_PERMISSION');
    }

    let normalizedExpiresAt = null;
    if (expiresAt !== undefined && expiresAt !== null) {
      const expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        throw createServiceError('La fecha de expiración no es válida', 400, 'INVALID_EXPIRATION_DATE');
      }

      // Reject expired timestamps to avoid creating unusable shares
      if (expirationDate <= new Date()) {
        throw createServiceError('La fecha de expiración debe ser una fecha futura', 400, 'INVALID_EXPIRATION_DATE');
      }
      normalizedExpiresAt = expirationDate.toISOString();
    }

    const { data: sender, error: senderError } = await supabaseAdmin
      .from('usuario')
      .select('id, id_estado')
      .eq('id', parsedSenderId)
      .single();

    if (senderError || !sender || sender.id_estado !== USER_STATUS.ACTIVE) {
      throw createServiceError('El usuario emisor no existe o no se encuentra activo', 404, 'SENDER_NOT_FOUND');
    }

    const { data: receiver, error: receiverError } = await supabaseAdmin
      .from('usuario')
      .select('id, id_estado')
      .eq('id', parsedReceiverId)
      .single();

    if (receiverError || !receiver || receiver.id_estado !== USER_STATUS.ACTIVE) {
      throw createServiceError('El usuario receptor no existe o no se encuentra activo', 404, 'RECEIVER_NOT_FOUND');
    }

    const { data: file, error: fileError } = await supabaseAdmin
      .from('archivo')
      .select('id, id_usuario, id_estado')
      .eq('id', parsedFileId)
      .single();

    if (fileError || !file) {
      throw createServiceError('El archivo no existe', 404, 'FILE_NOT_FOUND');
    }

    // Block sharing files that are currently placed in trash or deleted
    if (file.id_estado !== FILE_STATUS.ACTIVE) {
      throw createServiceError('El archivo no está disponible para compartir', 400, 'FILE_NOT_FOUND');
    }

    // Verify ownership to prevent unauthorized sharing of third-party resources
    if (file.id_usuario !== parsedSenderId) {
      throw createServiceError('No tienes permisos de propietario sobre este archivo', 403, 'NOT_RESOURCE_OWNER');
    }

    const { data: existingShares, error: shareQueryError } = await supabaseAdmin
      .from('compartir')
      .select('id, id_estado')
      .eq('id_archivo', parsedFileId)
      .eq('id_usuario_emisor', parsedSenderId)
      .eq('id_usuario_receptor', parsedReceiverId);

    if (shareQueryError) {
      throw createServiceError(`Error al verificar compartidos previos: ${shareQueryError.message}`, 500, 'INTERNAL_SERVER_ERROR');
    }

    const activeShare = existingShares?.find((share) => share.id_estado === SHARE_STATUS.ACTIVE);
    if (activeShare) {
      throw createServiceError('El archivo ya ha sido compartido con este usuario', 409, 'SHARE_ALREADY_EXISTS');
    }

    const revokedShare = existingShares?.find((share) => share.id_estado === SHARE_STATUS.REVOKED);

    // Reuse revoked rows to avoid duplicate state pairs in the share table
    if (revokedShare) {
      const { data: reactivatedShare, error: reactivateError } = await supabaseAdmin
        .from('compartir')
        .update({
          id_permiso: parsedPermissionId,
          id_estado: SHARE_STATUS.ACTIVE,
          fecha_compartido: new Date().toISOString(),
          fecha_expiracion: normalizedExpiresAt
        })
        .eq('id', revokedShare.id)
        .select()
        .single();

      if (reactivateError) {
        throw createServiceError(`Error al reactivar el compartido: ${reactivateError.message}`, 500, 'INTERNAL_SERVER_ERROR');
      }

      return reactivatedShare;
    }

    const { data: createdShare, error: insertError } = await supabaseAdmin
      .from('compartir')
      .insert({
        id_archivo: parsedFileId,
        id_carpeta: null,
        id_usuario_emisor: parsedSenderId,
        id_usuario_receptor: parsedReceiverId,
        id_permiso: parsedPermissionId,
        id_estado: SHARE_STATUS.ACTIVE,
        fecha_compartido: new Date().toISOString(),
        fecha_expiracion: normalizedExpiresAt
      })
      .select()
      .single();

    if (insertError) {
      throw createServiceError(`Error al compartir el archivo: ${insertError.message}`, 500, 'INTERNAL_SERVER_ERROR');
    }

    return createdShare;
  },

  async getSharedByUser(userId) {
    const parsedUserId = parseInt(userId, 10);
    if (!parsedUserId || isNaN(parsedUserId)) {
      throw createServiceError('El usuario no es válido', 400, 'INVALID_USER_ID');
    }

    // Retrieve active outgoing shares initiated by the authenticated user
    const { data: shares, error } = await supabaseAdmin
      .from('compartir')
      .select(`
        id,
        id_archivo,
        id_carpeta,
        id_usuario_emisor,
        id_usuario_receptor,
        id_permiso,
        id_estado,
        fecha_compartido,
        fecha_expiracion,
        archivo:id_archivo(id, nombre, tamano_bytes, id_estado, fecha_subida),
        receptor:id_usuario_receptor(id, nombre, apellido, correo),
        permiso:id_permiso(id, nombre)
      `)
      .eq('id_usuario_emisor', parsedUserId)
      .eq('id_estado', SHARE_STATUS.ACTIVE)
      .order('fecha_compartido', { ascending: false });

    if (error) {
      throw createServiceError(`Error al consultar recursos compartidos: ${error.message}`, 500, 'INTERNAL_SERVER_ERROR');
    }

    return shares || [];
  },

  async getSharedFilesWithUser(userId) {
    const parsedUserId = parseInt(userId, 10);
    if (!parsedUserId || isNaN(parsedUserId)) {
      throw createServiceError('El usuario no es válido', 400, 'INVALID_USER_ID');
    }

    const nowIso = new Date().toISOString();

    // Query active non-expired shares granted to the recipient
    const { data: shares, error } = await supabaseAdmin
      .from('compartir')
      .select(`
        id,
        id_archivo,
        id_carpeta,
        id_usuario_emisor,
        id_usuario_receptor,
        id_permiso,
        id_estado,
        fecha_compartido,
        fecha_expiracion,
        archivo:id_archivo(id, nombre, tamano_bytes, id_estado, fecha_subida),
        emisor:id_usuario_emisor(id, nombre, apellido, correo),
        permiso:id_permiso(id, nombre)
      `)
      .eq('id_usuario_receptor', parsedUserId)
      .not('id_archivo', 'is', null)
      .eq('id_estado', SHARE_STATUS.ACTIVE)
      .or(`fecha_expiracion.is.null,fecha_expiracion.gt.${nowIso}`)
      .order('fecha_compartido', { ascending: false });

    if (error) {
      throw createServiceError(`Error al consultar archivos compartidos: ${error.message}`, 500, 'INTERNAL_SERVER_ERROR');
    }

    // Exclude shares where the underlying file is in trash or deleted
    return (shares || []).filter(
      (share) => share.archivo && share.archivo.id_estado === FILE_STATUS.ACTIVE
    );
  },

  async getShareById({ shareId, userId }) {
    const parsedShareId = parseInt(shareId, 10);
    const parsedUserId = parseInt(userId, 10);

    if (!parsedShareId || isNaN(parsedShareId)) {
      throw createServiceError('El recurso compartido no es válido', 404, 'SHARE_NOT_FOUND');
    }

    const { data: share, error } = await supabaseAdmin
      .from('compartir')
      .select(`
        id,
        id_archivo,
        id_carpeta,
        id_usuario_emisor,
        id_usuario_receptor,
        id_permiso,
        id_estado,
        fecha_compartido,
        fecha_expiracion,
        archivo:id_archivo(id, nombre, tamano_bytes, id_estado, fecha_subida),
        emisor:id_usuario_emisor(id, nombre, apellido, correo),
        receptor:id_usuario_receptor(id, nombre, apellido, correo),
        permiso:id_permiso(id, nombre)
      `)
      .eq('id', parsedShareId)
      .single();

    if (error || !share) {
      throw createServiceError('El recurso compartido no existe', 404, 'SHARE_NOT_FOUND');
    }

    // Restrict access exclusively to the sender or recipient involved
    if (share.id_usuario_emisor !== parsedUserId && share.id_usuario_receptor !== parsedUserId) {
      throw createServiceError('No tienes acceso para consultar este recurso compartido', 403, 'ACCESS_DENIED');
    }

    return share;
  },

  async changePermission({ shareId, actorUserId, permissionId }) {
    const parsedShareId = parseInt(shareId, 10);
    const parsedActorId = parseInt(actorUserId, 10);
    const parsedPermissionId = parseInt(permissionId, 10);

    if (!parsedShareId || isNaN(parsedShareId)) {
      throw createServiceError('El recurso compartido no es válido', 404, 'SHARE_NOT_FOUND');
    }

    if (![PERMISSIONS.EDITOR, PERMISSIONS.VIEWER].includes(parsedPermissionId)) {
      throw createServiceError('El permiso especificado no es válido', 400, 'INVALID_PERMISSION');
    }

    const { data: share, error } = await supabaseAdmin
      .from('compartir')
      .select('id, id_usuario_emisor, id_permiso, id_estado')
      .eq('id', parsedShareId)
      .single();

    if (error || !share) {
      throw createServiceError('El recurso compartido no existe', 404, 'SHARE_NOT_FOUND');
    }

    // Only the resource owner who created the share may alter granted permissions
    if (share.id_usuario_emisor !== parsedActorId) {
      throw createServiceError('Solo el propietario puede modificar los permisos del compartido', 403, 'NOT_RESOURCE_OWNER');
    }

    // Prevent modifying permissions on shares that have already been revoked
    if (share.id_estado === SHARE_STATUS.REVOKED) {
      throw createServiceError('No se pueden modificar permisos de un compartido revocado', 400, 'SHARE_REVOKED');
    }

    const { data: updatedShare, error: updateError } = await supabaseAdmin
      .from('compartir')
      .update({ id_permiso: parsedPermissionId })
      .eq('id', parsedShareId)
      .select(`
        id,
        id_archivo,
        id_carpeta,
        id_usuario_emisor,
        id_usuario_receptor,
        id_permiso,
        id_estado,
        fecha_compartido,
        fecha_expiracion
      `)
      .single();

    if (updateError) {
      throw createServiceError(`Error al actualizar el permiso: ${updateError.message}`, 500, 'INTERNAL_SERVER_ERROR');
    }

    return updatedShare;
  },

  async revokeShare({ shareId, actorUserId }) {
    const parsedShareId = parseInt(shareId, 10);
    const parsedActorId = parseInt(actorUserId, 10);

    if (!parsedShareId || isNaN(parsedShareId)) {
      throw createServiceError('El recurso compartido no es válido', 404, 'SHARE_NOT_FOUND');
    }

    const { data: share, error } = await supabaseAdmin
      .from('compartir')
      .select('id, id_usuario_emisor, id_estado')
      .eq('id', parsedShareId)
      .single();

    if (error || !share) {
      throw createServiceError('El recurso compartido no existe', 404, 'SHARE_NOT_FOUND');
    }

    // Enforce ownership so only the sharer can revoke access
    if (share.id_usuario_emisor !== parsedActorId) {
      throw createServiceError('Solo el propietario puede revocar el compartido', 403, 'NOT_RESOURCE_OWNER');
    }

    // Mark share status as revoked instead of deleting the database record
    const { data: revokedShare, error: updateError } = await supabaseAdmin
      .from('compartir')
      .update({ id_estado: SHARE_STATUS.REVOKED })
      .eq('id', parsedShareId)
      .select(`
        id,
        id_archivo,
        id_carpeta,
        id_usuario_emisor,
        id_usuario_receptor,
        id_permiso,
        id_estado,
        fecha_compartido,
        fecha_expiracion
      `)
      .single();

    if (updateError) {
      throw createServiceError(`Error al revocar el compartido: ${updateError.message}`, 500, 'INTERNAL_SERVER_ERROR');
    }

    return revokedShare;
  },

  async shareFolder({ senderUserId, receiverUserId, folderId, permissionId, expiresAt }) {
    throw createServiceError('Not implemented yet', 501, 'NOT_IMPLEMENTED');
  },

  async getSharedFoldersWithUser(userId) {
    throw createServiceError('Not implemented yet', 501, 'NOT_IMPLEMENTED');
  },

  async validateFileAccess({ userId, fileId, requiredPermission = null }) {
    const parsedUserId = parseInt(userId, 10);
    const parsedFileId = parseInt(fileId, 10);

    if (!parsedUserId || isNaN(parsedUserId) || !parsedFileId || isNaN(parsedFileId)) {
      return {
        hasAccess: false,
        isOwner: false,
        permissionId: null,
        permissionName: null,
        source: null,
        shareId: null,
        reason: 'FILE_NOT_FOUND'
      };
    }

    // Step 1: Check file existence, active state, and owner identity
    const { data: file, error: fileError } = await supabaseAdmin
      .from('archivo')
      .select('id, id_usuario, id_carpeta, id_estado')
      .eq('id', parsedFileId)
      .single();

    if (fileError || !file || file.id_estado !== FILE_STATUS.ACTIVE) {
      return {
        hasAccess: false,
        isOwner: false,
        permissionId: null,
        permissionName: null,
        source: null,
        shareId: null,
        reason: 'FILE_NOT_FOUND'
      };
    }

    if (file.id_usuario === parsedUserId) {
      return {
        hasAccess: true,
        isOwner: true,
        permissionId: null,
        permissionName: 'Propietario',
        source: 'owner',
        shareId: null
      };
    }

    // Step 2: Check direct active share for this file
    const nowIso = new Date().toISOString();
    const { data: directShare, error: shareError } = await supabaseAdmin
      .from('compartir')
      .select('id, id_permiso, fecha_expiracion')
      .eq('id_archivo', parsedFileId)
      .eq('id_usuario_receptor', parsedUserId)
      .eq('id_estado', SHARE_STATUS.ACTIVE)
      .or(`fecha_expiracion.is.null,fecha_expiracion.gt.${nowIso}`)
      .maybeSingle();

    let directShareResult = null;
    if (!shareError && directShare) {
      const hasAccess = satisfiesPermission(directShare.id_permiso, requiredPermission);
      directShareResult = {
        hasAccess,
        isOwner: false,
        permissionId: directShare.id_permiso,
        permissionName: getPermissionName(directShare.id_permiso),
        source: 'direct',
        shareId: directShare.id,
        ...(hasAccess ? {} : { reason: 'INSUFFICIENT_PERMISSION' })
      };

      if (directShare.id_permiso === PERMISSIONS.EDITOR || (hasAccess && !file.id_carpeta)) {
        return directShareResult;
      }
    }

    // Step 3: Check folder hierarchy inheritance if contained in a folder
    if (file.id_carpeta) {
      const inheritedResult = await resolveFolderInheritedAccess(
        parsedUserId,
        file.id_carpeta,
        requiredPermission
      );

      if (inheritedResult) {
        if (inheritedResult.isOwner || inheritedResult.permissionId === PERMISSIONS.EDITOR) {
          return inheritedResult;
        }
        if (!directShareResult) {
          return inheritedResult;
        }
      }
    }

    if (directShareResult) {
      return directShareResult;
    }

    // Step 4: Access denied
    return {
      hasAccess: false,
      isOwner: false,
      permissionId: null,
      permissionName: null,
      source: null,
      shareId: null,
      reason: 'ACCESS_DENIED'
    };
  },

  async validateFolderAccess({ userId, folderId, requiredPermission = null }) {
    const parsedUserId = parseInt(userId, 10);
    const parsedFolderId = parseInt(folderId, 10);

    if (!parsedUserId || isNaN(parsedUserId) || !parsedFolderId || isNaN(parsedFolderId)) {
      return {
        hasAccess: false,
        isOwner: false,
        permissionId: null,
        permissionName: null,
        source: null,
        shareId: null,
        reason: 'FOLDER_NOT_FOUND'
      };
    }

    // Step 1: Check target folder existence, active state, and owner identity
    const { data: folder, error: folderError } = await supabaseAdmin
      .from('carpeta')
      .select('id, id_padre, id_usuario, id_estado')
      .eq('id', parsedFolderId)
      .single();

    if (folderError || !folder || folder.id_estado !== FOLDER_STATUS.ACTIVE) {
      return {
        hasAccess: false,
        isOwner: false,
        permissionId: null,
        permissionName: null,
        source: null,
        shareId: null,
        reason: 'FOLDER_NOT_FOUND'
      };
    }

    if (folder.id_usuario === parsedUserId) {
      return {
        hasAccess: true,
        isOwner: true,
        permissionId: null,
        permissionName: 'Propietario',
        source: 'owner',
        shareId: null
      };
    }

    // Step 2: Check direct active share for this folder
    const nowIso = new Date().toISOString();
    const { data: directShare, error: shareError } = await supabaseAdmin
      .from('compartir')
      .select('id, id_permiso, fecha_expiracion')
      .eq('id_carpeta', parsedFolderId)
      .eq('id_usuario_receptor', parsedUserId)
      .eq('id_estado', SHARE_STATUS.ACTIVE)
      .or(`fecha_expiracion.is.null,fecha_expiracion.gt.${nowIso}`)
      .maybeSingle();

    let directShareResult = null;
    if (!shareError && directShare) {
      const hasAccess = satisfiesPermission(directShare.id_permiso, requiredPermission);
      directShareResult = {
        hasAccess,
        isOwner: false,
        permissionId: directShare.id_permiso,
        permissionName: getPermissionName(directShare.id_permiso),
        source: 'direct',
        shareId: directShare.id,
        ...(hasAccess ? {} : { reason: 'INSUFFICIENT_PERMISSION' })
      };

      if (directShare.id_permiso === PERMISSIONS.EDITOR || (hasAccess && !folder.id_padre)) {
        return directShareResult;
      }
    }

    // Step 3: Check hierarchical ancestor inheritance if folder has a parent
    if (folder.id_padre) {
      const inheritedResult = await resolveFolderInheritedAccess(
        parsedUserId,
        folder.id_padre,
        requiredPermission
      );

      if (inheritedResult) {
        if (inheritedResult.isOwner || inheritedResult.permissionId === PERMISSIONS.EDITOR) {
          return inheritedResult;
        }
        if (!directShareResult) {
          return inheritedResult;
        }
      }
    }

    if (directShareResult) {
      return directShareResult;
    }

    // Step 4: Access denied
    return {
      hasAccess: false,
      isOwner: false,
      permissionId: null,
      permissionName: null,
      source: null,
      shareId: null,
      reason: 'ACCESS_DENIED'
    };
  }
};

module.exports = ShareService;
