// Ronda 24: lista única de los módulos de Administrador que se muestran en
// el menú lateral (AdminDrawerContent) — antes estaban como una lista larga
// de botones de colores random en HomeScreen. Se agrupan por tema para que
// el menú sea más fácil de escanear.
export interface ItemMenu {
  label: string;
  route: string;
  icon: string; // emoji simple — no se agregó una librería de íconos para no sumar otra dependencia nativa más en esta misma ronda.
}

export interface SeccionMenu {
  titulo: string;
  items: ItemMenu[];
}

// Ronda 47, a pedido explícito del usuario, con referencia visual:
// reagrupado más cerca de esas categorías (Gestión de residentes / Visitas
// y estacionamientos / Guardias y conserjería / Finanzas / Operación y
// comunicación / Seguridad y auditoría / Privacidad de datos) — ningún
// módulo se quitó, solo se reordenaron y renombraron algunas secciones.
export const SECCIONES_MENU_ADMIN: SeccionMenu[] = [
  {
    titulo: "Gestión de residentes",
    items: [
      { label: "Residentes", route: "AdminResidentes", icon: "🏠" },
      { label: "Patentes de residentes", route: "AdminPatentes", icon: "🔎" },
      { label: "Mascotas", route: "Mascotas", icon: "🐾" },
      { label: "Vetados", route: "AdminVetados", icon: "⛔" },
    ],
  },
  {
    titulo: "Visitas y estacionamientos",
    items: [
      { label: "Disponibilidad de cupos", route: "Disponibilidad", icon: "📍" },
      { label: "Estacionamientos (estado)", route: "AdminEstacionamientos", icon: "🅿️" },
      { label: "Estacionamientos en arriendo", route: "EstacionamientosArriendo", icon: "🚗" },
      { label: "Bitácora de guardias", route: "Bitacora", icon: "📖" },
    ],
  },
  {
    titulo: "Guardias y conserjería",
    items: [
      { label: "Guardias", route: "AdminGuardias", icon: "🛡️" },
      { label: "Personal externo", route: "AdminPersonal", icon: "🧰" },
      { label: "Jefes de área", route: "AdminJefesArea", icon: "👥" },
    ],
  },
  {
    titulo: "Finanzas",
    items: [
      { label: "Gasto común por depto", route: "AdminGastoComun", icon: "💵" },
      { label: "Reporte gasto común", route: "AdminReporteGastoComun", icon: "📊" },
    ],
  },
  {
    titulo: "Operación y comunicación",
    items: [
      { label: "Paquetes", route: "PaqueteBusqueda", icon: "📦" },
      { label: "Reservas de espacios comunes", route: "AdminReservas", icon: "📅" },
      { label: "Mantenciones", route: "AdminMantenciones", icon: "🛠️" },
      { label: "Configurar espacios comunes", route: "AdminEspacios", icon: "⚙️" },
      { label: "Enviar comunicado", route: "AdminComunicados", icon: "📣" },
      { label: "Notificaciones", route: "Notificaciones", icon: "🔔" },
    ],
  },
  {
    titulo: "Convivencia",
    items: [
      { label: "Amonestaciones", route: "AdminAmonestaciones", icon: "📋" },
      { label: "Multas", route: "AdminMultas", icon: "💰" },
    ],
  },
  {
    titulo: "Seguridad y auditoría",
    items: [
      { label: "Auditoría por patente", route: "AdminAuditoria", icon: "🧾" },
      { label: "Incidentes de seguridad", route: "AdminIncidentes", icon: "🚨" },
    ],
  },
  {
    // Ronda 32, Ley 21.719 de Protección de Datos Personales.
    titulo: "Privacidad de datos",
    items: [
      { label: "Solicitudes de residentes", route: "AdminPrivacidad", icon: "🔐" },
      { label: "Registro de auditoría", route: "AdminLogAuditoria", icon: "📋" },
      { label: "Retención de datos", route: "AdminRetencion", icon: "🗓️" },
      { label: "Mi perfil", route: "MisDatos", icon: "🙋" },
    ],
  },
];
