
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

const PERMISSIONS = { EDITOR: 1, VIEWER: 2 };
const SHARE_STATUS = { ACTIVE: 1, REVOKED: 2 };
const FILE_STATUS = { ACTIVE: 1, TRASH: 2, DELETED: 3 };
const FOLDER_STATUS = { ACTIVE: 1, TRASH: 2, DELETED: 3 };
const USER_STATUS = { ACTIVE: 1, INACTIVE: 2, SUSPENDED: 3 };

function createServiceError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function satisfiesPermission(grantedPermissionId, requiredPermission) {
  if (!requiredPermission) return true;

  const granted = Number(grantedPermissionId);
  const required = Number(requiredPermission);

  return granted === PERMISSIONS.EDITOR ||
    (granted === PERMISSIONS.VIEWER && required === PERMISSIONS.VIEWER);
}

function getPermissionName(permissionId) {
  if (Number(permissionId) === PERMISSIONS.EDITOR) return 'Editor';
  if (Number(permissionId) === PERMISSIONS.VIEWER) return 'Visualizador';
  return null;
}

function accessDenied(reason = 'ACCESS_DENIED') {
  return {
    hasAccess: false,
    isOwner: false,
    permissionId: null,
    permissionName: null,
    source: null,
    shareId: null,
    reason
  };
}

function ownerAccess() {
  return {
    hasAccess: true,
    isOwner: true,
    permissionId: null,
    permissionName: 'Propietario',
    source: 'owner',
    shareId: null
  };
}

function shareAccess(share, requiredPermission, source) {
  const hasAccess = satisfiesPermission(
    share.id_permiso,
    requiredPermission
  );

  return {
    hasAccess,
    isOwner: false,
    permissionId: share.id_permiso,
    permissionName: getPermissionName(share.id_permiso),
    source,
    shareId: share.id,
    ...(!hasAccess ? { reason: 'INSUFFICIENT_PERMISSION' } : {})
  };
}

async function resolveFolderInheritedAccess(
  userId,
  startFolderId,
  requiredPermission
) {
  const parsedUserId = parseId(userId);
  let currentFolderId = parseId(startFolderId);

  if (!parsedUserId || !currentFolderId) return null;

  const visited = new Set();
  const ancestorIds = [];
  const MAX_DEPTH = 25;

  while (currentFolderId && ancestorIds.length < MAX_DEPTH) {
    if (visited.has(currentFolderId)) return null;

    visited.add(currentFolderId);

    const { data: folder, error } = await supabaseAdmin
      .from('carpeta')
      .select('id, id_padre, id_usuario, id_estado')
      .eq('id', currentFolderId)
      .maybeSingle();

    if (error) {
      throw createServiceError(
        `Error al validar la jerarquía: ${error.message}`,
        500,
        'FOLDER_QUERY_FAILED'
      );
    }

    if (!folder || folder.id_estado !== FOLDER_STATUS.ACTIVE) {
      return null;
    }

    ancestorIds.push(currentFolderId);

    if (folder.id_usuario === parsedUserId) {
      return ownerAccess();
    }

    currentFolderId = folder.id_padre
      ? parseId(folder.id_padre)
      : null;
  }

  if (currentFolderId) return null;
  if (!ancestorIds.length) return null;

  const nowIso = new Date().toISOString();

  const { data: shares, error } = await supabaseAdmin
    .from('compartir')
    .select('id, id_carpeta, id_permiso, fecha_expiracion')
    .eq('id_usuario_receptor', parsedUserId)
    .in('id_carpeta', ancestorIds)
    .eq('id_estado', SHARE_STATUS.ACTIVE)
    .or(`fecha_expiracion.is.null,fecha_expiracion.gt.${nowIso}`);

  if (error) {
    throw createServiceError(
      `Error al validar permisos heredados: ${error.message}`,
      500,
      'SHARES_QUERY_FAILED'
    );
  }

  if (!shares?.length) return null;

  const bestShare = shares.reduce((best, current) =>
    Number(current.id_permiso) < Number(best.id_permiso)
      ? current
      : best
  );

  return shareAccess(bestShare, requiredPermission, 'inherited');
}

async function validateActiveUser(userId, role) {
  const id = parseId(userId);

  if (!id) {
    throw createServiceError(
      `El usuario ${role} no es válido`,
      400,
      role === 'emisor' ? 'SENDER_NOT_FOUND' : 'RECEIVER_NOT_FOUND'
    );
  }

  const { data, error } = await supabaseAdmin
    .from('usuario')
    .select('id, id_estado')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw createServiceError(
      `Error al consultar usuario: ${error.message}`,
      500,
      'USER_QUERY_FAILED'
    );
  }

  if (!data || data.id_estado !== USER_STATUS.ACTIVE) {
    throw createServiceError(
      `El usuario ${role} no existe o no está activo`,
      404,
      role === 'emisor' ? 'SENDER_NOT_FOUND' : 'RECEIVER_NOT_FOUND'
    );
  }

  return data;
}

async function createShare({
  senderUserId,
  receiverUserId,
  resourceId,
  resourceType,
  permissionId,
  expiresAt
}) {
  const senderId = parseId(senderUserId);
  const receiverId = parseId(receiverUserId);
  const parsedResourceId = parseId(resourceId);
  const parsedPermissionId = parseId(permissionId);

  const isFolder = resourceType === 'carpeta';
  const resourceName = isFolder ? 'carpeta' : 'archivo';
  const resourceCode = isFolder ? 'FOLDER_NOT_FOUND' : 'FILE_NOT_FOUND';

  if (!senderId || !receiverId) {
    throw createServiceError(
      'El usuario emisor o receptor no es válido',
      400,
      'INVALID_USER_ID'
    );
  }

  if (senderId === receiverId) {
    throw createServiceError(
      `No puedes compartir un ${resourceName} contigo mismo`,
      400,
      'CANNOT_SHARE_WITH_SELF'
    );
  }

  if (!parsedResourceId) {
    throw createServiceError(
      `El ${resourceName} especificado no es válido`,
      404,
      resourceCode
    );
  }

  if (![PERMISSIONS.EDITOR, PERMISSIONS.VIEWER].includes(parsedPermissionId)) {
    throw createServiceError(
      'El permiso especificado no es válido',
      400,
      'INVALID_PERMISSION'
    );
  }

  let normalizedExpiresAt = null;

  if (expiresAt !== undefined && expiresAt !== null) {
    const expirationDate = new Date(expiresAt);

    if (
      Number.isNaN(expirationDate.getTime()) ||
      expirationDate <= new Date()
    ) {
      throw createServiceError(
        'La fecha de expiración debe ser una fecha futura válida',
        400,
        'INVALID_EXPIRATION_DATE'
      );
    }

    normalizedExpiresAt = expirationDate.toISOString();
  }

  await validateActiveUser(senderId, 'emisor');
  await validateActiveUser(receiverId, 'receptor');

  const { data: resource, error: resourceError } = await supabaseAdmin
    .from(resourceType)
    .select('id, id_usuario, id_estado')
    .eq('id', parsedResourceId)
    .maybeSingle();

  if (resourceError) {
    throw createServiceError(
      `Error al consultar ${resourceName}: ${resourceError.message}`,
      500,
      'RESOURCE_QUERY_FAILED'
    );
  }

  if (!resource) {
    throw createServiceError(
      `El ${resourceName} no existe`,
      404,
      resourceCode
    );
  }

  if (resource.id_estado !== 1) {
    throw createServiceError(
      `El ${resourceName} no está disponible para compartir`,
      400,
      resourceCode
    );
  }

  if (resource.id_usuario !== senderId) {
    throw createServiceError(
      `No tienes permisos de propietario sobre este ${resourceName}`,
      403,
      'NOT_RESOURCE_OWNER'
    );
  }

  const resourceColumn = isFolder ? 'id_carpeta' : 'id_archivo';

  const { data: existingShares, error: queryError } = await supabaseAdmin
    .from('compartir')
    .select('id, id_estado')
    .eq(resourceColumn, parsedResourceId)
    .eq('id_usuario_emisor', senderId)
    .eq('id_usuario_receptor', receiverId);

  if (queryError) {
    throw createServiceError(
      `Error al verificar compartidos previos: ${queryError.message}`,
      500,
      'INTERNAL_SERVER_ERROR'
    );
  }

  const activeShare = existingShares?.find(
    share => share.id_estado === SHARE_STATUS.ACTIVE
  );

  if (activeShare) {
    throw createServiceError(
      `El ${resourceName} ya está compartido con este usuario`,
      409,
      'SHARE_ALREADY_EXISTS'
    );
  }

  const revokedShare = existingShares?.find(
    share => share.id_estado === SHARE_STATUS.REVOKED
  );

  const shareData = {
    id_archivo: isFolder ? null : parsedResourceId,
    id_carpeta: isFolder ? parsedResourceId : null,
    id_usuario_emisor: senderId,
    id_usuario_receptor: receiverId,
    id_permiso: parsedPermissionId,
    id_estado: SHARE_STATUS.ACTIVE,
    fecha_compartido: new Date().toISOString(),
    fecha_expiracion: normalizedExpiresAt
  };

  let query;

  if (revokedShare) {
    query = supabaseAdmin
      .from('compartir')
      .update(shareData)
      .eq('id', revokedShare.id);
  } else {
    query = supabaseAdmin
      .from('compartir')
      .insert(shareData);
  }

  const { data, error } = await query.select().single();

  if (error) {
    throw createServiceError(
      `Error al compartir el ${resourceName}: ${error.message}`,
      500,
      'INTERNAL_SERVER_ERROR'
    );
  }

  return data;
}

const ShareService = {
  async searchRecipients({ userId, query }) {
    const term = typeof query === 'string'
      ? query.trim().toLowerCase()
      : '';

    if (
      term.length < 2 ||
      term.length > 254 ||
      !/^[a-z0-9@._+-]+$/.test(term)
    ) {
      return [];
    }

    const prefix = term.replace(/_/g, '\\_');

    const { data, error } = await supabaseAdmin
      .from('usuario')
      .select('nombre, apellido, correo')
      .eq('id_estado', USER_STATUS.ACTIVE)
      .neq('id', Number(userId))
      .ilike('correo', `${prefix}%`)
      .order('correo', { ascending: true })
      .limit(8);

    if (error) {
      throw createServiceError(
        'No se pudieron buscar los destinatarios',
        500,
        'RECIPIENT_SEARCH_FAILED'
      );
    }

    return data || [];
  },

  async resolveReceiver(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      throw createServiceError(
        'El correo del destinatario es obligatorio',
        400,
        'INVALID_RECEIVER_EMAIL'
      );
    }

    const { data, error } = await supabaseAdmin
      .from('usuario')
      .select('id')
      .eq('correo', normalizedEmail)
      .eq('id_estado', USER_STATUS.ACTIVE)
      .maybeSingle();

    if (error) {
      throw createServiceError(
        'No se pudo consultar el destinatario',
        500,
        'RECEIVER_QUERY_FAILED'
      );
    }

    if (!data) {
      throw createServiceError(
        'No existe un usuario activo con ese correo',
        404,
        'RECEIVER_NOT_FOUND'
      );
    }

    return data.id;
  },

  async shareFile({
    senderUserId,
    receiverUserId,
    fileId,
    permissionId,
    expiresAt
  }) {
    return createShare({
      senderUserId,
      receiverUserId,
      resourceId: fileId,
      resourceType: 'archivo',
      permissionId,
      expiresAt
    });
  },

  async shareFolder({
    senderUserId,
    receiverUserId,
    folderId,
    permissionId,
    expiresAt
  }) {
    return createShare({
      senderUserId,
      receiverUserId,
      resourceId: folderId,
      resourceType: 'carpeta',
      permissionId,
      expiresAt
    });
  },

  async getSharedByUser(userId) {
    const parsedUserId = parseId(userId);

    if (!parsedUserId) {
      throw createServiceError(
        'El usuario no es válido',
        400,
        'INVALID_USER_ID'
      );
    }

    const { data, error } = await supabaseAdmin
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
        archivo:id_archivo(
          id, nombre, tamano_bytes, id_estado, fecha_subida
        ),
        carpeta:id_carpeta(
          id, nombre, id_usuario, id_padre,
          id_estado, fecha_creacion, fecha_modificacion
        ),
        receptor:id_usuario_receptor(
          id, nombre, apellido, correo
        ),
        permiso:id_permiso(id, nombre)
      `)
      .eq('id_usuario_emisor', parsedUserId)
      .eq('id_estado', SHARE_STATUS.ACTIVE)
      .order('fecha_compartido', { ascending: false });

    if (error) {
      throw createServiceError(
        `Error al consultar recursos compartidos: ${error.message}`,
        500,
        'INTERNAL_SERVER_ERROR'
      );
    }

    return data || [];
  },

  async getSharedFilesWithUser(userId) {
    const parsedUserId = parseId(userId);

    if (!parsedUserId) {
      throw createServiceError(
        'El usuario no es válido',
        400,
        'INVALID_USER_ID'
      );
    }

    const nowIso = new Date().toISOString();

    const { data, error } = await supabaseAdmin
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
        archivo:id_archivo(
          id, nombre, tamano_bytes, id_estado, fecha_subida
        ),
        carpeta:id_carpeta(id, nombre, id_estado),
        emisor:id_usuario_emisor(id, nombre, apellido, correo),
        permiso:id_permiso(id, nombre)
      `)
      .eq('id_usuario_receptor', parsedUserId)
      .not('id_archivo', 'is', null)
      .eq('id_estado', SHARE_STATUS.ACTIVE)
      .or(`fecha_expiracion.is.null,fecha_expiracion.gt.${nowIso}`)
      .order('fecha_compartido', { ascending: false });

    if (error) {
      throw createServiceError(
        `Error al consultar archivos compartidos: ${error.message}`,
        500,
        'INTERNAL_SERVER_ERROR'
      );
    }

    return (data || []).filter(
      share => share.archivo?.id_estado === FILE_STATUS.ACTIVE
    );
  },

  async getSharedFoldersWithUser(userId) {
    const parsedUserId = parseId(userId);

    if (!parsedUserId) {
      throw createServiceError(
        'El usuario no es válido',
        400,
        'INVALID_USER_ID'
      );
    }

    const nowIso = new Date().toISOString();

    const { data, error } = await supabaseAdmin
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
        carpeta:id_carpeta(
          id, nombre, id_usuario, id_padre,
          id_estado, fecha_creacion, fecha_modificacion
        ),
        emisor:id_usuario_emisor(
          id, nombre, apellido, correo
        ),
        permiso:id_permiso(id, nombre)
      `)
      .eq('id_usuario_receptor', parsedUserId)
      .not('id_carpeta', 'is', null)
      .eq('id_estado', SHARE_STATUS.ACTIVE)
      .or(`fecha_expiracion.is.null,fecha_expiracion.gt.${nowIso}`)
      .order('fecha_compartido', { ascending: false });

    if (error) {
      throw createServiceError(
        `Error al consultar carpetas compartidas: ${error.message}`,
        500,
        'INTERNAL_SERVER_ERROR'
      );
    }

    return (data || []).filter(
      share => share.carpeta?.id_estado === FOLDER_STATUS.ACTIVE
    );
  },

  async getShareById({ shareId, userId }) {
    const parsedShareId = parseId(shareId);
    const parsedUserId = parseId(userId);

    if (!parsedShareId || !parsedUserId) {
      throw createServiceError(
        'El recurso compartido no es válido',
        404,
        'SHARE_NOT_FOUND'
      );
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
        archivo:id_archivo(
          id, nombre, tamano_bytes, id_estado, fecha_subida
        ),
        carpeta:id_carpeta(
          id, nombre, id_usuario, id_padre,
          id_estado, fecha_creacion, fecha_modificacion
        ),
        emisor:id_usuario_emisor(id, nombre, apellido, correo),
        receptor:id_usuario_receptor(id, nombre, apellido, correo),
        permiso:id_permiso(id, nombre)
      `)
      .eq('id', parsedShareId)
      .maybeSingle();

    if (error || !share) {
      throw createServiceError(
        'El recurso compartido no existe',
        404,
        'SHARE_NOT_FOUND'
      );
    }

    if (
      share.id_usuario_emisor !== parsedUserId &&
      share.id_usuario_receptor !== parsedUserId
    ) {
      throw createServiceError(
        'No tienes acceso a este recurso compartido',
        403,
        'ACCESS_DENIED'
      );
    }

    return share;
  },

  async changePermission({ shareId, actorUserId, permissionId }) {
    const id = parseId(shareId);
    const actorId = parseId(actorUserId);
    const permission = parseId(permissionId);

    if (!id || !actorId) {
      throw createServiceError(
        'El recurso compartido no es válido',
        404,
        'SHARE_NOT_FOUND'
      );
    }

    if (![PERMISSIONS.EDITOR, PERMISSIONS.VIEWER].includes(permission)) {
      throw createServiceError(
        'El permiso especificado no es válido',
        400,
        'INVALID_PERMISSION'
      );
    }

    const { data: share, error } = await supabaseAdmin
      .from('compartir')
      .select('id, id_usuario_emisor, id_permiso, id_estado')
      .eq('id', id)
      .maybeSingle();

    if (error || !share) {
      throw createServiceError(
        'El recurso compartido no existe',
        404,
        'SHARE_NOT_FOUND'
      );
    }

    if (share.id_usuario_emisor !== actorId) {
      throw createServiceError(
        'Solo el propietario puede modificar los permisos',
        403,
        'NOT_RESOURCE_OWNER'
      );
    }

    if (share.id_estado !== SHARE_STATUS.ACTIVE) {
      throw createServiceError(
        'No se pueden modificar permisos de un compartido revocado',
        400,
        'SHARE_REVOKED'
      );
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('compartir')
      .update({ id_permiso: permission })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw createServiceError(
        `Error al actualizar permisos: ${updateError.message}`,
        500,
        'INTERNAL_SERVER_ERROR'
      );
    }

    return data;
  },

  async revokeShare({ shareId, actorUserId }) {
    const id = parseId(shareId);
    const actorId = parseId(actorUserId);

    if (!id || !actorId) {
      throw createServiceError(
        'El recurso compartido no es válido',
        404,
        'SHARE_NOT_FOUND'
      );
    }

    const { data: share, error } = await supabaseAdmin
      .from('compartir')
      .select('id, id_usuario_emisor, id_estado')
      .eq('id', id)
      .maybeSingle();

    if (error || !share) {
      throw createServiceError(
        'El recurso compartido no existe',
        404,
        'SHARE_NOT_FOUND'
      );
    }

    if (share.id_usuario_emisor !== actorId) {
      throw createServiceError(
        'Solo el propietario puede revocar el compartido',
        403,
        'NOT_RESOURCE_OWNER'
      );
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('compartir')
      .update({ id_estado: SHARE_STATUS.REVOKED })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw createServiceError(
        `Error al revocar el compartido: ${updateError.message}`,
        500,
        'INTERNAL_SERVER_ERROR'
      );
    }

    return data;
  },

  async getSharedFolderContent({ userId, folderId }) {
    const parsedFolderId = parseId(folderId);

    if (!parsedFolderId) {
      throw createServiceError(
        'La carpeta no es válida',
        400,
        'INVALID_FOLDER_ID'
      );
    }

    const access = await this.validateFolderAccess({
      userId,
      folderId: parsedFolderId,
      requiredPermission: PERMISSIONS.VIEWER
    });

    if (!access.hasAccess) {
      throw createServiceError(
        'No tienes acceso a esta carpeta',
        403,
        'ACCESS_DENIED'
      );
    }

    const [foldersResult, filesResult] = await Promise.all([
      supabaseAdmin
        .from('carpeta')
        .select('id, nombre')
        .eq('id_padre', parsedFolderId)
        .eq('id_estado', FOLDER_STATUS.ACTIVE),

      supabaseAdmin
        .from('archivo')
        .select('id, nombre, tamano_bytes')
        .eq('id_carpeta', parsedFolderId)
        .eq('id_estado', FILE_STATUS.ACTIVE)
    ]);

    if (foldersResult.error || filesResult.error) {
      throw createServiceError(
        'No se pudo consultar el contenido de la carpeta',
        500,
        'CONTENT_QUERY_FAILED'
      );
    }

    return {
      folders: foldersResult.data || [],
      files: filesResult.data || [],
      access
    };
  },

  async getSharedDownload({ userId, fileId }) {
    const parsedFileId = parseId(fileId);

    if (!parsedFileId) {
      throw createServiceError(
        'El archivo no es válido',
        400,
        'INVALID_FILE_ID'
      );
    }

    const access = await this.validateFileAccess({
      userId,
      fileId: parsedFileId,
      requiredPermission: PERMISSIONS.VIEWER
    });

    if (!access.hasAccess) {
      throw createServiceError(
        'No tienes acceso a este archivo',
        403,
        'ACCESS_DENIED'
      );
    }

    const { data, error } = await supabaseAdmin
      .from('archivo')
      .select('nombre, ruta_storage')
      .eq('id', parsedFileId)
      .eq('id_estado', FILE_STATUS.ACTIVE)
      .maybeSingle();

    if (error || !data) {
      throw createServiceError(
        'Archivo no encontrado',
        404,
        'FILE_NOT_FOUND'
      );
    }

    const StorageService = require('./storage.service');

    const url = await StorageService.createSignedUrl(
      data.ruta_storage,
      60
    );

    return {
      url,
      name: data.nombre,
      expiresIn: 60
    };
  },

  async validateFileAccess({
    userId,
    fileId,
    requiredPermission = null
  }) {
    const parsedUserId = parseId(userId);
    const parsedFileId = parseId(fileId);

    if (!parsedUserId || !parsedFileId) {
      return accessDenied('FILE_NOT_FOUND');
    }

    const { data: file, error } = await supabaseAdmin
      .from('archivo')
      .select('id, id_usuario, id_carpeta, id_estado')
      .eq('id', parsedFileId)
      .maybeSingle();

    if (error || !file || file.id_estado !== FILE_STATUS.ACTIVE) {
      return accessDenied('FILE_NOT_FOUND');
    }

    if (file.id_usuario === parsedUserId) {
      return ownerAccess();
    }

    const nowIso = new Date().toISOString();

    const { data: shares, error: shareError } = await supabaseAdmin
      .from('compartir')
      .select('id, id_permiso, fecha_expiracion')
      .eq('id_archivo', parsedFileId)
      .eq('id_usuario_receptor', parsedUserId)
      .eq('id_estado', SHARE_STATUS.ACTIVE)
      .or(`fecha_expiracion.is.null,fecha_expiracion.gt.${nowIso}`);

    if (shareError) {
      throw createServiceError(
        'No se pudieron validar los permisos del archivo',
        500,
        'SHARES_QUERY_FAILED'
      );
    }

    const directShare = shares?.length
      ? shares.reduce((best, current) =>
          Number(current.id_permiso) < Number(best.id_permiso)
            ? current
            : best
        )
      : null;

    const directResult = directShare
      ? shareAccess(directShare, requiredPermission, 'direct')
      : null;

    let inheritedResult = null;

    if (file.id_carpeta) {
      inheritedResult = await resolveFolderInheritedAccess(
        parsedUserId,
        file.id_carpeta,
        requiredPermission
      );
    }

    if (inheritedResult?.isOwner) return inheritedResult;

    if (directResult?.hasAccess &&
        directResult.permissionId === PERMISSIONS.EDITOR) {
      return directResult;
    }

    if (inheritedResult?.hasAccess &&
        inheritedResult.permissionId === PERMISSIONS.EDITOR) {
      return inheritedResult;
    }

    if (directResult?.hasAccess) return directResult;
    if (inheritedResult?.hasAccess) return inheritedResult;

    return directResult ||
      inheritedResult ||
      accessDenied();
  },

  async validateFolderAccess({
    userId,
    folderId,
    requiredPermission = null
  }) {
    const parsedUserId = parseId(userId);
    const parsedFolderId = parseId(folderId);

    if (!parsedUserId || !parsedFolderId) {
      return accessDenied('FOLDER_NOT_FOUND');
    }

    const { data: folder, error } = await supabaseAdmin
      .from('carpeta')
      .select('id, id_padre, id_usuario, id_estado')
      .eq('id', parsedFolderId)
      .maybeSingle();

    if (error || !folder || folder.id_estado !== FOLDER_STATUS.ACTIVE) {
      return accessDenied('FOLDER_NOT_FOUND');
    }

    if (folder.id_usuario === parsedUserId) {
      return ownerAccess();
    }

    const nowIso = new Date().toISOString();

    const { data: shares, error: shareError } = await supabaseAdmin
      .from('compartir')
      .select('id, id_permiso, fecha_expiracion')
      .eq('id_carpeta', parsedFolderId)
      .eq('id_usuario_receptor', parsedUserId)
      .eq('id_estado', SHARE_STATUS.ACTIVE)
      .or(`fecha_expiracion.is.null,fecha_expiracion.gt.${nowIso}`);

    if (shareError) {
      throw createServiceError(
        'No se pudieron validar los permisos de la carpeta',
        500,
        'SHARES_QUERY_FAILED'
      );
    }

    const directShare = shares?.length
      ? shares.reduce((best, current) =>
          Number(current.id_permiso) < Number(best.id_permiso)
            ? current
            : best
        )
      : null;

    const directResult = directShare
      ? shareAccess(directShare, requiredPermission, 'direct')
      : null;

    let inheritedResult = null;

    if (folder.id_padre) {
      inheritedResult = await resolveFolderInheritedAccess(
        parsedUserId,
        folder.id_padre,
        requiredPermission
      );
    }

    if (inheritedResult?.isOwner) return inheritedResult;

    if (directResult?.hasAccess &&
        directResult.permissionId === PERMISSIONS.EDITOR) {
      return directResult;
    }

    if (inheritedResult?.hasAccess &&
        inheritedResult.permissionId === PERMISSIONS.EDITOR) {
      return inheritedResult;
    }

    if (directResult?.hasAccess) return directResult;
    if (inheritedResult?.hasAccess) return inheritedResult;

    return directResult ||
      inheritedResult ||
      accessDenied();
  }
};

module.exports = ShareService;
