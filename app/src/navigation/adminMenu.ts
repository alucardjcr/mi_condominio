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

export const SECCIONES_MENU_ADMIN: SeccionMenu[] = [
  {
    titulo: "Operación diaria",
    items: [
      { label: "Paquetes", route: "PaqueteBusqueda", icon: "📦" },
      { label: "Reservas de espacios comunes", route: "AdminReservas", icon: "📅" },
      { label: "Mantenciones", route: "AdminMantenciones", icon: "🛠️" },
      { label: "Estacionamientos en arriendo", route: "EstacionamientosArriendo", icon: "🚗" },
      { label: "Estacionamientos (estado)", route: "AdminEstacionamientos", icon: "🅿️" },
      { label: "Disponibilidad de cupos", route: "Disponibilidad", icon: "📍" },
      { label: "Bitácora de guardias", route: "Bitacora", icon: "📖" },
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
    titulo: "Personas",
    items: [
      { label: "Residentes", route: "AdminResidentes", icon: "🏠" },
      { label: "Patentes de residentes", route: "AdminPatentes", icon: "🔎" },
      { label: "Guardias", route: "AdminGuardias", icon: "🛡️" },
      { label: "Personal externo", route: "AdminPersonal", icon: "🧰" },
      { label: "Vetados", route: "AdminVetados", icon: "⛔" },
      { label: "Mascotas", route: "Mascotas", icon: "🐾" },
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
    titulo: "Configuración y comunicación",
    items: [
      { label: "Configurar espacios comunes", route: "AdminEspacios", icon: "⚙️" },
      { label: "Enviar comunicado", route: "AdminComunicados", icon: "📣" },
      { label: "Notificaciones", route: "Notificaciones", icon: "🔔" },
      { label: "Auditoría por patente", route: "AdminAuditoria", icon: "🧾" },
    ],
  },
  {
    // Ronda 32, Ley 21.719 de Protección de Datos Personales.
    titulo: "Privacidad de datos",
    items: [
      { label: "Solicitudes de residentes", route: "AdminPrivacidad", icon: "🔐" },
      { label: "Registro de auditoría", route: "AdminLogAuditoria", icon: "📋" },
      { label: "Retención de datos", route: "AdminRetencion", icon: "🗓️" },
      { label: "Incidentes de seguridad", route: "AdminIncidentes", icon: "🚨" },
      { label: "Mis datos", route: "MisDatos", icon: "🙋" },
    ],
  },
];
