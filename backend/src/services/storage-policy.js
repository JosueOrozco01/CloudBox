function countsTowardStorage(file) {
  if (file.id_estado === 3 || file.estado?.nombre === 'Eliminado') return file.storage_deleted_at === null;
  return file.eliminado !== true && (!file.estado?.nombre || ['Activo','En papelera'].includes(file.estado.nombre));
}
module.exports = { countsTowardStorage };
