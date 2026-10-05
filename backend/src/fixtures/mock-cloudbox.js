/**
 * Fixtures estáticos para el desarrollo simultáneo - CloudBox
 * Metodología Contract-First (Etapa 0)
 */

const mockFolders = [
  {
    id: 1,
    nombre: "Documentos Personales",
    id_usuario: 1,
    id_padre: null,
    fecha_creacion: "2026-10-01T10:00:00Z"
  },
  {
    id: 2,
    nombre: "Facturas",
    id_usuario: 1,
    id_padre: 1, // Subcarpeta de Documentos Personales
    fecha_creacion: "2026-10-01T10:05:00Z"
  },
  {
    id: 3,
    nombre: "Imágenes",
    id_usuario: 1,
    id_padre: null,
    fecha_creacion: "2026-10-01T10:10:00Z"
  }
];

const mockFiles = [
  {
    id: 10,
    nombre: "curriculum.pdf",
    tamano_bytes: 1048576, // 1 MB
    ruta_storage: "usuarios/1/archivos/curriculum.pdf",
    id_carpeta: 1,
    id_usuario: 1,
    fecha_subida: "2026-10-01T11:00:00Z"
  },
  {
    id: 11,
    nombre: "factura_luz.pdf",
    tamano_bytes: 524288, // 500 KB
    ruta_storage: "usuarios/1/archivos/factura_luz.pdf",
    id_carpeta: 2,
    id_usuario: 1,
    fecha_subida: "2026-10-01T11:30:00Z"
  },
  {
    id: 12,
    nombre: "foto_perfil.png",
    tamano_bytes: 2097152, // 2 MB
    ruta_storage: "usuarios/1/archivos/foto_perfil.png",
    id_carpeta: 3,
    id_usuario: 1,
    fecha_subida: "2026-10-01T12:00:00Z"
  },
  {
    id: 13,
    nombre: "notas.txt",
    tamano_bytes: 10240, // 10 KB
    ruta_storage: "usuarios/1/archivos/notas.txt",
    id_carpeta: null, // Archivo en la raíz
    id_usuario: 1,
    fecha_subida: "2026-10-01T12:30:00Z"
  }
];

const mockQuotas = {
  total_limit_bytes: 5368709120, // 5 GB
  used_space_bytes: 104857600,   // 100 MB
  available_bytes: 5263851520    // 4.9 GB
};

const mockPaymentSuccess = {
  transaction_id: "trx_mock_987654321",
  status: "success",
  new_quota_bytes: 10737418240, // 10 GB
  date: "2026-10-01T15:00:00Z"
};

module.exports = {
  mockFolders,
  mockFiles,
  mockQuotas,
  mockPaymentSuccess
};
