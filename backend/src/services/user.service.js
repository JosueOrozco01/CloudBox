const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const ROLE_PERMISSIONS = {
  Administrador: [
    "admin_panel",
    "manage_users"
  ],
  Usuario: []
};

const getPermissionsByRole = (role) => {
  return ROLE_PERMISSIONS[role] ?? [];
};

const UserService = {
  async getProfileById(userId, supabase) {
    const { data, error } = await supabase
      .from('usuario')
      .select(`
        id,
        nombre,
        apellido,
        correo,
        fecha_registro,
        rol:id_rol (
          nombre
        ),
        estado:id_estado (
          nombre
        )
      `)
      .eq('id', userId)
      .single();

    if (error) {
      const profileError = new Error(
        'No se pudo obtener el perfil del usuario'
      );

      profileError.status = 500;
      profileError.code = 'PROFILE_FETCH_ERROR';
      profileError.cause = error;

      throw profileError;
    }

    const rol = data.rol?.nombre ?? null;

    return {
      id: data.id,
      nombre: data.nombre,
      apellido: data.apellido,
      correo: data.correo,
      rol,
      permissions: getPermissionsByRole(rol),
      estado: data.estado?.nombre ?? null,
      fecha_registro: data.fecha_registro
    };
  },

  async updateProfile(userId, { nombre, apellido }, supabase) {
    const { error: updateError } = await supabase
      .from('usuario')
      .update({
        nombre,
        apellido
      })
      .eq('id', userId);

    if (updateError) {
      console.error("ERROR SUPABASE UPDATE PROFILE:", updateError);

      const profileError = new Error(
        'No se pudo actualizar el perfil'
      );

      profileError.status = 500;
      profileError.code = 'PROFILE_UPDATE_ERROR';
      profileError.cause = updateError;

      throw profileError;
    }

    const { data, error: fetchError } = await supabase
      .from('usuario')
      .select(`
        id,
        nombre,
        apellido,
        correo,
        fecha_registro,
        rol:id_rol (
          nombre
        ),
        estado:id_estado (
          nombre
        )
      `)
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error("ERROR AL LEER PERFIL ACTUALIZADO:", fetchError);

      const profileError = new Error(
        'El perfil se actualizó pero no se pudo obtener'
      );

      profileError.status = 500;
      profileError.code = 'PROFILE_FETCH_ERROR';
      profileError.cause = fetchError;

      throw profileError;
    }

    const rol = data.rol?.nombre ?? null;

    return {
      id: data.id,
      nombre: data.nombre,
      apellido: data.apellido,
      correo: data.correo,
      rol,
      permissions: getPermissionsByRole(rol),
      estado: data.estado?.nombre ?? null,
      fecha_registro: data.fecha_registro
    };
  },

  async verifyCurrentPassword(authUser, password) {
    if (!authUser?.id || !authUser?.email) {
      const error = new Error('No se pudo verificar la identidad del usuario');
      error.status = 401;
      error.code = 'INVALID_USER_IDENTITY';
      throw error;
    }

    // Cliente independiente para verificar la contraseña.
    // No utiliza la clave de administrador.
    const authClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );

    const { data, error } = await authClient.auth.signInWithPassword({
      email: authUser.email,
      password
    });

    if (error) {
      if (error.status === 400 || error.status === 401) {
        return false;
      }

      const verificationError = new Error(
        'No se pudo verificar la contraseña'
      );
      verificationError.status = 503;
      verificationError.code = 'PASSWORD_VERIFICATION_FAILED';
      throw verificationError;
    }

    // Confirmar que la contraseña pertenece al usuario autenticado.
    return data.user?.id === authUser.id;
  }, 

  async revokeUserSessions(authUserId) {
    const { error } = await supabaseAdmin.auth.admin.signOut(
      authUserId,
      'global'
    );

    if (error) {
      const revokeError = new Error(
        'No se pudieron revocar las sesiones del usuario'
      );

      revokeError.status = 500;
      revokeError.code = 'SESSION_REVOCATION_FAILED';

      throw revokeError;
    }
  }
};

module.exports = UserService;