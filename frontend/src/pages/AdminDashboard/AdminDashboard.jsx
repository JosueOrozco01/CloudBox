import UserAvatar from "../../components/UserAvatar/UserAvatar";
import "./AdminDashboard.css";

const icon = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const statusStyles = {
  Completado: { bg: "#dcfce7", color: "#16a34a" },
  Pendiente: { bg: "#fef3c7", color: "#b98900" },
  Activo: { bg: "#dcfce7", color: "#16a34a" },
  Inactivo: { bg: "#fee2e2", color: "#dc2626" },
};

function StatusBadge({ status }) {
  const style = statusStyles[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span
      className="admin-badge"
      style={{ background: style.bg, color: style.color }}
    >
      {status}
    </span>
  );
}

const defaultStats = [
  {
    id: "users",
    label: "Usuarios registrados",
    value: "—",
    delta: "",
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    id: "subs",
    label: "Suscripciones activas",
    value: "—",
    delta: "",
    deltaNeutral: true,
    icon: (
      <>
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <path d="M2 10h20" />
      </>
    ),
  },
  {
    id: "storage",
    label: "Almacenamiento utilizado",
    value: "—",
    progress: 0,
    progressLabel: "Sin datos de almacenamiento",
    icon: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14a9 3 0 0 0 18 0V5" />
        <path d="M3 12a9 3 0 0 0 18 0" />
      </>
    ),
  },
  {
    id: "files",
    label: "Archivos almacenados",
    value: "—",
    delta: "",
    icon: (
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" />
    ),
  },
];

const defaultActivity = [];

const defaultPlanDistribution = [];

const defaultSubscriptionStatus = [];

const defaultRecentUsers = [];

const defaultQuickActions = [
  {
    id: "users",
    label: "Gestionar usuarios",
    description: "Ver lista de usuarios, editar permisos y estados.",
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    id: "plans",
    label: "Administrar planes",
    description: "Modificar costos, cuotas y límites de almacenamiento.",
    icon: <rect width="20" height="14" x="2" y="5" rx="2" />,
  },
  {
    id: "subs",
    label: "Ver suscripciones",
    description: "Facturación, ingresos y estado de pagos.",
    icon: (
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6" />
    ),
  },
  {
    id: "storage",
    label: "Revisar almacenamiento",
    description: "Analizar consumo y rendimiento de servidores.",
    icon: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14a9 3 0 0 0 18 0V5" />
        <path d="M3 12a9 3 0 0 0 18 0" />
      </>
    ),
  },
  {
    id: "metrics",
    label: "Consultar métricas",
    description: "Informes de actividad global y uso de red.",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
];

export default function AdminDashboard({
  stats = defaultStats,
  systemAlert = "",
  activity = defaultActivity,
  planDistribution = defaultPlanDistribution,
  subscriptionStatus = defaultSubscriptionStatus,
  recentUsers = defaultRecentUsers,
  topStorageUsers = [],
  quickActions = defaultQuickActions,
  onManageUsers,
  onReviewStorage,
  onViewAllActivity,
  onViewUserDetail,
  onQuickAction,
}) {
  const planTotal = planDistribution.reduce((total, plan) => total + plan.count, 0);
  let planOffset = 0;
  const planSegments = planDistribution.map((plan) => {
    const start = planOffset;
    planOffset += planTotal ? (plan.count / planTotal) * 100 : 0;
    return `${plan.color} ${start}% ${planOffset}%`;
  });
  return (
    <div className="admin-page admin-overview">
      {/* Encabezado */}
      <div className="admin-header">
        <div>
          <span className="admin-eyebrow">CLOUDBOX · ADMINISTRACIÓN</span>
          <h1>Panel de administración</h1>
          <p>Supervisa el estado general y la actividad de CloudBox</p>
          <span className="admin-header-caption">Todo tu espacio de trabajo, en una sola vista.</span>
        </div>
        <button
          type="button"
          className="admin-primary-btn"
          onClick={onManageUsers}
        >
          <svg {...icon}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M20 8v6m-3-3h6" /></svg>
          Gestionar usuarios
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      {/* Alerta del sistema */}
      {systemAlert && (
        <div className="admin-alert">
          <svg {...icon} width="18" height="18">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4 M12 17h.01" />
          </svg>
          <p>{systemAlert}</p>
          <button
            type="button"
            className="admin-alert-btn"
            onClick={onReviewStorage}
          >
            Revisar almacenamiento
          </button>
        </div>
      )}

      {/* Tarjetas de estadísticas */}
      <div className="admin-stats">
        {stats.map((stat) => (
          <article className={`admin-stat-card admin-stat-${stat.id}`} key={stat.id}>
            <div className="admin-stat-head">
              <span className="admin-stat-icon">
                <svg {...icon}>
                  {stat.icon ??
                    defaultStats.find((item) => item.id === stat.id)?.icon}
                </svg>
              </span>
            </div>
            <p className="admin-stat-label">{stat.label}</p>
            <p className="admin-stat-value">{stat.value}</p>

            {stat.progress !== undefined ? (
              <>
                <div className="admin-stat-progress">
                  <div
                    className="admin-stat-progress-fill"
                    style={{ width: `${stat.progress}%` }}
                  />
                </div>
                <p className="admin-stat-sub">{stat.progressLabel}</p>
              </>
            ) : (
              <p
                className={`admin-stat-delta ${stat.deltaNeutral ? "neutral" : ""}`}
              >
                {stat.delta}
              </p>
            )}
          </article>
        ))}
      </div>

      {/* Actividad reciente + paneles laterales */}
      <div className="admin-columns">
        <div className="admin-main-column">
          <div className="admin-card admin-activity-card">
            <div className="admin-card-head">
              <h2>Actividad reciente</h2>
              <p>Los últimos movimientos de tu plataforma.</p>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Acción realizada</th>
                    <th>Fecha / Hora</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.length === 0 && (
                    <tr>
                      <td colSpan={4} className="admin-empty">No hay actividad registrada.<span>Los movimientos de la plataforma aparecerán aquí.</span></td>
                    </tr>
                  )}
                  {activity.map((row) => (
                    <tr key={row.id}>
                      <td className="admin-strong">{row.user}</td>
                      <td className="admin-muted">{row.action}</td>
                      <td className="admin-muted">{row.date}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className="admin-view-all"
              onClick={onViewAllActivity}
            >
              Ver toda la actividad
              <span aria-hidden="true"> →</span>
            </button>
          </div>

          {/* Usuarios recientes */}
          <div className="admin-card admin-recent-users">
            <div className="admin-card-head">
              <h2>Usuarios recientes</h2>
              <p>Conoce a quienes se acaban de unir a CloudBox.</p>
            </div>

            <ul className="admin-user-list">
              {recentUsers.length === 0 && <li className="admin-empty">Todavía no hay usuarios recientes.</li>}
              {recentUsers.map((user) => (
                <li key={user.id}>
                  <UserAvatar user={user} className="admin-user-avatar" />
                  <div className="admin-user-info">
                    <p className="admin-user-name">{user.name}</p>
                    <p className="admin-user-email">{user.email}</p>
                  </div>
                  <span className="admin-user-plan">{user.plan}</span>
                  <StatusBadge status={user.status} />
                  <button
                    type="button"
                    className="admin-detail-link"
                    onClick={() => onViewUserDetail?.(user)}
                  >
                    Ver detalle
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="admin-side">
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>Distribución de planes</h2>
              <p>Una mirada a las suscripciones por plan.</p>
            </div>
            <div className="admin-plan-summary">
              <div className="admin-plan-donut" role="img" aria-label={`${planTotal.toLocaleString()} suscripciones distribuidas entre ${planDistribution.length} planes`} style={{ background: planTotal ? `conic-gradient(${planSegments.join(", ")})` : undefined }}>
                <div><strong>{planTotal.toLocaleString()}</strong><span>suscripciones</span></div>
              </div>
            </div>
            <ul className="admin-plan-list">
              {planDistribution.length === 0 && <li className="admin-empty">Aún no hay planes con suscripciones.</li>}
              {planDistribution.map((plan) => (
                <li key={plan.id}>
                  <div className="admin-plan-row">
                    <span>{plan.label}</span>
                    <span>{plan.count.toLocaleString()} usuarios</span>
                  </div>
                  <div className="admin-plan-bar">
                    <div
                      className="admin-plan-bar-fill"
                      style={{
                        width: `${plan.percent}%`,
                        background: plan.color,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="admin-card">
            <div className="admin-card-head">
              <h2>Estado de suscripciones</h2>
              <p>El resumen de tu base de suscriptores.</p>
            </div>

            <ul className="admin-sub-status-list">
              {subscriptionStatus.length === 0 && <li className="admin-empty">No hay suscripciones registradas.</li>}
              {subscriptionStatus.map((item) => (
                <li key={item.id}>
                  <span className="admin-sub-status-label">
                    <span
                      className="admin-dot"
                      style={{ background: item.color }}
                    />
                    {item.label}
                  </span>
                  <span className="admin-sub-status-count">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="admin-card admin-storage-users">
            <div className="admin-card-head">
              <h2>Mayor uso de almacenamiento</h2>
              <p>
                Hasta cinco usuarios, priorizados por porcentaje de uso y
                espacio ocupado
              </p>
            </div>
            <ul className="admin-storage-list">
              {topStorageUsers.length === 0 && (
                <li>Todavía no hay consumo de almacenamiento registrado.</li>
              )}
              {topStorageUsers.map((user) => (
                <li key={user.id}>
                  <div className="admin-storage-user">
                    <UserAvatar user={user} />
                    <div>
                      <p className="admin-user-name">{user.name}</p>
                      <p className="admin-user-email">{user.plan}</p>
                    </div>
                    <button
                      type="button"
                      className="admin-detail-link"
                      onClick={() => onViewUserDetail?.(user)}
                    >
                      Ver detalle
                    </button>
                  </div>
                  <div className="admin-storage-usage">
                    <span>
                      {(user.usedBytes / 1024 ** 3).toFixed(2)} GB utilizados
                      {user.maxBytes > 0
                        ? ` de ${(user.maxBytes / 1024 ** 3).toFixed(2)} GB`
                        : ""}
                    </span>
                    {user.storagePercent !== null && (
                      <strong>{Number(user.storagePercent.toFixed(1))}%</strong>
                    )}
                  </div>
                  {user.storagePercent !== null ? (
                    <div
                      className="admin-plan-bar"
                      role="progressbar"
                      aria-label={`Almacenamiento de ${user.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, user.storagePercent)}
                      aria-valuetext={`${Number(user.storagePercent.toFixed(1))}% utilizado`}
                    >
                      <div
                        className="admin-plan-bar-fill"
                        style={{
                          width: `${Math.min(100, user.storagePercent)}%`,
                          background:
                            user.storagePercent >= 100
                              ? "#dc2626"
                              : user.storagePercent >= 90
                                ? "#f59e0b"
                                : "#2563ff",
                        }}
                      />
                    </div>
                  ) : (
                    <p className="admin-storage-note">
                      {user.maxBytes === undefined
                        ? "El límite del plan no se recibió. Actualiza el backend para consultar el porcentaje."
                        : "Sin cuota vigente; se muestra el espacio ocupado."}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div>
        <h2 className="admin-section-title">Tu centro de gestión</h2>
        <p className="admin-section-description">Accede directamente a las herramientas de administración.</p>
        <div className="admin-quick-grid">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="admin-quick-card"
              onClick={() => onQuickAction?.(action.id)}
            >
              <span className="admin-quick-icon">
                <svg {...icon}>{action.icon}</svg>
              </span>
              <span className="admin-quick-arrow" aria-hidden="true">↗</span>
              <p className="admin-quick-label">{action.label}</p>
              <p className="admin-quick-desc">{action.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
