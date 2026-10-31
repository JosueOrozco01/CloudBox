const {recordLog} = require('../services/audit.service');
const PlanService = require('../services/plan.service');

const PlanController = {
  async getAllPlans(req, res, next) {
    try {
      return res.status(200).json({ success: true, data: await PlanService.getAllPlans() });
    } catch (error) { next(error); }
  },
  async getActivePlans(req, res, next) {
    try {
      const plans = await PlanService.getActivePlans();
      return res.status(200).json({
        success: true,
        message: 'Planes comerciales activos obtenidos exitosamente',
        data: plans
      });
    } catch (error) {
      next(error);
    }
  },

  async getPlanById(req, res, next) {
    try {
      const plan = await PlanService.getPlanById(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Plan obtenido exitosamente',
        data: plan
      });
    } catch (error) {
      next(error);
    }
  },

  async createPlan(req, res, next) {
    try {
      const newPlan = await PlanService.createPlan(req.body);
      await recordLog({id_usuario:req.user.id,accion:'CREAR_PLAN',entidad_afectada:'plan',id_entidad_afectada:Number(newPlan.id),ip_origen:req.ip,detalles:{operation:'CREAR_PLAN'}});
      return res.status(201).json({
        success: true,
        message: 'Plan comercial creado satisfactoriamente',
        data: newPlan
      });
    } catch (error) {
      next(error);
    }
  },

  async updatePlan(req, res, next) {
    try {
      const updatedPlan = await PlanService.updatePlan(req.params.id, req.body);
      await recordLog({id_usuario:req.user.id,accion:'CAMBIO_PLAN',entidad_afectada:'plan',id_entidad_afectada:Number(updatedPlan.id),ip_origen:req.ip,detalles:{operation:'CAMBIO_PLAN'}});
      return res.status(200).json({
        success: true,
        message: 'Plan comercial actualizado exitosamente',
        data: updatedPlan
      });
    } catch (error) {
      next(error);
    }
  },

  async setPlanStatus(req, res, next) {
    try {
      const { id_estado } = req.body;
      const result = await PlanService.setPlanStatus(req.params.id, id_estado);
      await recordLog({id_usuario:req.user.id,accion:'CAMBIO_ESTADO_PLAN',entidad_afectada:'plan',id_entidad_afectada:Number(result.id),ip_origen:req.ip,detalles:{operation:'CAMBIO_ESTADO_PLAN'}});
      return res.status(200).json({
        success: true,
        message: 'Estado del plan actualizado exitosamente',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = PlanController;
