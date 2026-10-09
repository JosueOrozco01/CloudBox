import { Eye, ShieldCheck, UserRoundX, UserRoundCheck } from "lucide-react";
import "./UserManagement.css";

const icon = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const statusStyles = {
  Activo: { bg: "#dcfce7", color: "#16a34a" },
  Pendiente: { bg: "#fef3c7", color: "#b98900" },
  Inactivo: { bg: "#fee2e2", color: "#dc2626" },
  Suspendido: { bg: "#fee2e2", color: "#dc2626" },
};

function StatusBadge({ status }) {
  const style = statusStyles[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span
      className="um-badge"
      style={{ background: style.bg, color: style.color }}
    >
      {status}
    </span>
  );
}

const defaultStats = [
  {
    id: "total",
    label: "Usuarios totales",
    value: "—",
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    id: "active",
    label: "Usuarios activos",
    value: "—",
    icon: <path d="M20 6 9 17l-5-5" />,
  },
  {
    id: "pending",
    label: "Pendientes",
    value: "—",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
  },
  {
    id: "inactive",
    label: "Inactivos / Suspendidos",
    value: "—",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6 M9 9l6 6" />
      </>
    ),
  },
];

const defaultUsers = [];

export default function UserManagement({
  stats = defaultStats,
  users = defaultUsers,
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  query = "",
  filters = {},
  plans = [],
  onFilterChange,
  onSearch,
  onViewUserDetail,
  onEditUser,
  onToggleUserStatus,
  onPageChange,
}) {
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch?.(query);
  };

  return (
    <div className="um-page">
      {/* Encabezado */}
      <div className="um-header">
        <div>
          <h1>Gestión de usuarios</h1>
          <p>
            Administra las cuentas, planes y permisos de los usuarios de
            CloudBox
          </p>
        </div>
      </div>

      {/* Buscador */}
      <form className="um-search" onSubmit={handleSearchSubmit}>
        <span className="um-search-icon">
          <svg {...icon}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Buscar por nombre o correo..."
          value={query}
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </form>

      {/* Tarjetas resumen */}
      <div className="um-stats">
        {stats.map((stat) => (
          <article className="um-stat-card" key={stat.id}>
            <span className="um-stat-icon">
              <svg {...icon}>
                {stat.icon ??
                  defaultStats.find((item) => item.id === stat.id)?.icon}
              </svg>
            </span>
            <div>
              <p className="um-stat-label">{stat.label}</p>
              <p className="um-stat-value">{stat.value}</p>
            </div>
          </article>
        ))}
      </div>

      {/* Filtros */}
      <div className="um-toolbar">
        <div className="um-filters">
          <select
            className="um-filter-btn"
            aria-label="Filtrar por plan"
            value={filters.plan || ""}
            onChange={(event) => onFilterChange("plan", event.target.value)}
          >
            <option value="">Todos los planes</option>
            {plans.map((plan) => (
              <option key={plan}>{plan}</option>
            ))}
          </select>
          <select
            className="um-filter-btn"
            aria-label="Filtrar por estado"
            value={filters.status || ""}
            onChange={(event) => onFilterChange("status", event.target.value)}
          >
            <option value="">Todos los estados</option>
            {["Activo", "Pendiente", "Inactivo", "Suspendido"].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <select
            className="um-filter-btn"
            aria-label="Fecha de registro"
            value={filters.days || ""}
            onChange={(event) => onFilterChange("days", event.target.value)}
          >
            <option value="">Todas las fechas</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
          </select>
        </div>

        <select
          className="um-filter-btn"
          aria-label="Ordenar usuarios"
          value={filters.sort || "recent"}
          onChange={(event) => onFilterChange("sort", event.target.value)}
        >
          <option value="recent">Más recientes</option>
          <option value="name">Nombre</option>
          <option value="storage">Mayor almacenamiento</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="um-table-wrap">
        <table className="um-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Registro</th>
              <th>Almacenamiento</th>
              <th className="um-th-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6}>No se encontraron usuarios.</td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="um-user-cell">
                    <span className="um-avatar">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="um-user-name">{user.name}</p>
                      <p className="um-user-email">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="um-muted">{user.plan}</td>
                <td>
                  <StatusBadge status={user.status} />
                </td>
                <td className="um-muted">{user.registered}</td>
                <td className="um-muted">{user.storage}</td>
                <td>
                  <div className="um-actions">
                    <button
                      type="button"
                      className="um-link-btn"
                      onClick={() => onViewUserDetail?.(user)}
                    >
                      <Eye size={16} />
                      Ver detalle
                    </button>
                    <button
                      type="button"
                      className="um-icon-btn"
                      aria-label="Editar permisos"
                      title="Editar permisos"
                      onClick={() => onEditUser?.(user)}
                    >
                      <ShieldCheck size={18} />
                    </button>
                    <button
                      type="button"
                      className={`um-icon-btn ${user.status === "Activo" ? "danger" : "success"}`}
                      aria-label={
                        user.status === "Activo"
                          ? "Suspender usuario"
                          : "Activar usuario"
                      }
                      title={
                        user.status === "Activo"
                          ? "Suspender usuario"
                          : "Activar usuario"
                      }
                      onClick={() => onToggleUserStatus?.(user)}
                    >
                      {user.status === "Activo" ? (
                        <UserRoundX size={18} />
                      ) : (
                        <UserRoundCheck size={18} />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="um-pagination">
        <p>
          Mostrando{" "}
          <strong>
            {users.length ? (currentPage - 1) * 10 + 1 : 0} a{" "}
            {(currentPage - 1) * 10 + users.length}
          </strong>{" "}
          de {totalCount.toLocaleString()} usuarios
        </p>

        <div className="um-pagination-controls">
          <button
            type="button"
            className="um-page-arrow"
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Página anterior"
          >
            <svg {...icon} width="14" height="14">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              type="button"
              className={`um-page-number ${page === currentPage ? "active" : ""}`}
              onClick={() => onPageChange?.(page)}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            className="um-page-arrow"
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Página siguiente"
          >
            <svg {...icon} width="14" height="14">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
