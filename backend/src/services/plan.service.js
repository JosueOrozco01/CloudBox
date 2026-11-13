const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BYTES_PER_GB = 1024 * 1024 * 1024;

function createServiceError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

const PlanService = {
  async getAllPlans() {
    const { data, error } = await supabaseAdmin.from('plan')
      .select('id,nombre,descripcion,precio,espacio_maximo_gb,vigencia_dias,id_estado')
      .order('precio', { ascending: true }).order('id');
    if (error) throw createServiceError('No se pudo consultar el catálogo administrativo', 500, 'DATABASE_ERROR');
    return (data || []).map(plan => ({ ...plan,
      precio: Number(plan.precio), espacio_maximo_gb: Number(plan.espacio_maximo_gb),
      estado: plan.id_estado === 1 ? 'Activo' : 'Inactivo',
    }));
  },
  /**
   * Obtiene todos los planes comerciales activos (id_estado = 1).
   */
  async getActivePlans() {
    const { data, error } = await supabaseAdmin
      .from('plan')
      .select('id, nombre, descripcion, precio, espacio_maximo_gb, vigencia_dias, id_estado')
      .eq('id_estado', 1)
      .order('precio', { ascending: true });

    if (error) {
      throw createServiceError(`Error al listar planes activos: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    return (data || []).map(plan => ({
      id: plan.id,
      nombre: plan.nombre,
      descripcion: plan.descripcion,
      precio: Number(plan.precio),
      espacio_maximo_gb: Number(plan.espacio_maximo_gb),
      capacidad_bytes: Number(plan.espacio_maximo_gb) * BYTES_PER_GB,
      vigencia_dias: plan.vigencia_dias,
      id_estado: plan.id_estado,
      estado: 'Activo'
    }));
  },

  /**
   * Obtiene el detalle de un plan específico por su ID.
   */
  async getPlanById(planId) {
    const id = Number(planId);
    if (!id || isNaN(id)) {
      throw createServiceError('Identificador de plan inválido', 400, 'INVALID_PLAN_ID');
    }

    const { data, error } = await supabaseAdmin
      .from('plan')
      .select('id, nombre, descripcion, precio, espacio_maximo_gb, vigencia_dias, id_estado')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw createServiceError(`Error al consultar plan: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    if (!data) {
      throw createServiceError('Plan comercial no encontrado', 404, 'PLAN_NOT_FOUND');
    }

    return {
      id: data.id,
      nombre: data.nombre,
      descripcion: data.descripcion,
      precio: Number(data.precio),
      espacio_maximo_gb: Number(data.espacio_maximo_gb),
      capacidad_bytes: Number(data.espacio_maximo_gb) * BYTES_PER_GB,
      vigencia_dias: data.vigencia_dias,
      id_estado: data.id_estado,
      estado: data.id_estado === 1 ? 'Activo' : 'Inactivo'
    };
  },

  /**
   * Registra un nuevo plan comercial. Exclusivo para administradores.
   */
  async createPlan({ nombre, descripcion, precio, espacio_maximo_gb, vigencia_dias }) {
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
      throw createServiceError('El nombre del plan es requerido', 400, 'INVALID_PLAN_PAYLOAD');
    }

    const parsedPrice = Number(precio);
    const parsedCapacity = Number(espacio_maximo_gb);
    const parsedValidity = Number(vigencia_dias ?? 30);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      throw createServiceError('El precio debe ser un número mayor o igual a 0', 400, 'INVALID_PLAN_PAYLOAD');
    }

    if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      throw createServiceError('El campo espacio_maximo_gb debe ser un número positivo mayor a cero', 400, 'INVALID_PLAN_PAYLOAD');
    }

    if (!Number.isSafeInteger(parsedValidity) || parsedValidity <= 0) {
      throw createServiceError('La vigencia_dias debe ser un número entero mayor a 0', 400, 'INVALID_PLAN_PAYLOAD');
    }

    if ((nombre.trim().toLowerCase()==='free') !== (parsedPrice===0) || (parsedPrice===0 && parsedCapacity!==1))
      throw createServiceError('Free debe ser Q0/1 GB; los demás planes deben tener precio positivo',400,'INVALID_FREE_PLAN');

    const { data, error } = await supabaseAdmin
      .from('plan')
      .insert({
        nombre: nombre.trim(),
        descripcion: descripcion ? descripcion.trim() : null,
        precio: parsedPrice,
        espacio_maximo_gb: parsedCapacity,
        vigencia_dias: parsedValidity,
        id_estado: 1 // 1 = Activo
      })
      .select()
      .single();

    if (error) {
      throw createServiceError(`Error al insertar plan: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    return {
      id: data.id,
      nombre: data.nombre,
      descripcion: data.descripcion,
      precio: Number(data.precio),
      espacio_maximo_gb: Number(data.espacio_maximo_gb),
      capacidad_bytes: Number(data.espacio_maximo_gb) * BYTES_PER_GB,
      vigencia_dias: data.vigencia_dias,
      id_estado: data.id_estado,
      estado: 'Activo'
    };
  },

  /**
   * Actualiza las características comerciales de un plan existente.
   */
  async updatePlan(planId, updateData) {
    const existing = await this.getPlanById(planId);

    const payload = {};
    if (updateData.nombre !== undefined) {
      if (typeof updateData.nombre !== 'string' || !updateData.nombre.trim())
        throw createServiceError('Nombre inválido', 400, 'INVALID_PLAN_PAYLOAD');
      if (updateData.nombre.trim() !== existing.nombre)
        throw createServiceError('El nombre de un plan existente no se puede cambiar; crea otro plan', 409, 'PLAN_NAME_IMMUTABLE');
    }
    if (updateData.descripcion !== undefined) payload.descripcion = updateData.descripcion ? updateData.descripcion.trim() : null;
    if (updateData.precio !== undefined) {
      const p = Number(updateData.precio);
      if (!Number.isFinite(p) || p < 0) throw createServiceError('Precio inválido', 400, 'INVALID_PLAN_PAYLOAD');
      payload.precio = p;
    }
    if (updateData.espacio_maximo_gb !== undefined) {
      const c = Number(updateData.espacio_maximo_gb);
      if (!Number.isFinite(c) || c <= 0) throw createServiceError('espacio_maximo_gb inválido', 400, 'INVALID_PLAN_PAYLOAD');
      payload.espacio_maximo_gb = c;
    }
    if (updateData.vigencia_dias !== undefined) {
      const v = Number(updateData.vigencia_dias);
      if (!Number.isSafeInteger(v) || v <= 0) throw createServiceError('vigencia_dias inválida', 400, 'INVALID_PLAN_PAYLOAD');
      payload.vigencia_dias = v;
    }

    const candidate={...existing,...payload};
    if (String(existing.nombre).trim().toLowerCase()==='free' &&
      (String(candidate.nombre).trim().toLowerCase()!=='free'||candidate.precio!==0||candidate.espacio_maximo_gb!==1))
      throw createServiceError('Free debe conservar Q0 y 1 GB',409,'FREE_PLAN_PROTECTED');
    if (String(candidate.nombre).trim().toLowerCase()==='free' && (candidate.precio!==0||candidate.espacio_maximo_gb!==1))
      throw createServiceError('Free debe conservar Q0 y 1 GB',400,'INVALID_FREE_PLAN');
    if (['espacio_maximo_gb','vigencia_dias'].some(k=>payload[k]!==undefined && Number(payload[k])!==Number(existing[k]))) {
      const result=await supabaseAdmin.from('suscripcion').select('id').eq('id_plan',existing.id).range(0,0);
      if (result.error) throw result.error;
      if (result.data.length) throw createServiceError('La capacidad y vigencia contratadas son inmutables; crea otro plan para cambiarlas',409,'PLAN_TERMS_IMMUTABLE');
    }
    const { data, error } = await supabaseAdmin
      .from('plan')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error && /CLOUDBOX_(PLAN_NAME_IMMUTABLE|PLAN_TERMS_IMMUTABLE|FREE_PLAN_PROTECTED)/.test(error.message||''))
      throw createServiceError('Las condiciones contratadas y Free están protegidos',409,error.message.replace('CLOUDBOX_',''));
    if (error) {
      throw createServiceError(`Error al actualizar plan: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    return {
      id: data.id,
      nombre: data.nombre,
      descripcion: data.descripcion,
      precio: Number(data.precio),
      espacio_maximo_gb: Number(data.espacio_maximo_gb),
      capacidad_bytes: Number(data.espacio_maximo_gb) * BYTES_PER_GB,
      vigencia_dias: data.vigencia_dias,
      id_estado: data.id_estado,
      estado: data.id_estado === 1 ? 'Activo' : 'Inactivo'
    };
  },

  /**
   * Activa o desactiva lógicamente un plan comercial actualizando id_estado.
   */
  async setPlanStatus(planId, idEstado) {
    const existing = await this.getPlanById(planId);

    const stateNumber = Number(idEstado);
    if (![1, 2].includes(stateNumber)) {
      throw createServiceError('El id_estado debe ser 1 (Activo) o 2 (Inactivo)', 400, 'INVALID_PLAN_STATUS');
    }

    if (String(existing.nombre).trim().toLowerCase()==='free' && stateNumber!==1)
      throw createServiceError('Free debe permanecer activo',409,'FREE_PLAN_PROTECTED');
    const { data, error } = await supabaseAdmin
      .from('plan')
      .update({ id_estado: stateNumber })
      .eq('id', existing.id)
      .select('id, nombre, id_estado')
      .single();

    if (error) {
      throw createServiceError(`Error al cambiar estado del plan: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    return {
      id: data.id,
      id_estado: data.id_estado,
      estado: data.id_estado === 1 ? 'Activo' : 'Inactivo'
    };
  },

  // ==========================================
  // CONTRATO INTERNO EXPORTADO PARA JENNI
  // ==========================================
  /**
   * Retorna la capacidad exacta en bytes y detalles comerciales de un plan.
   * Consumido por Jenni en el módulo de Suscripciones.
   *
   * @param {number} planId - Identificador numérico del plan (int4).
   * @returns {Promise<{
   *   planId: number,
   *   name: string,
   *   capacityBytes: number,
   *   validityDays: number,
   *   isActive: boolean
   * }>}
   */
  async getPlanCapacityBytes(planId) {
    const plan = await this.getPlanById(planId);
    return {
      planId: plan.id,
      name: plan.nombre,
      capacityBytes: Number(plan.espacio_maximo_gb) * BYTES_PER_GB,
      validityDays: Number(plan.vigencia_dias),
      isActive: plan.id_estado === 1
    };
  }
};

module.exports = PlanService;
