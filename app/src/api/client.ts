import { API_BASE_URL } from "../config/api";
import {
  AuditoriaPatenteItem,
  BuscarPaquetesFiltro,
  ConsultaPatenteResponse,
  CrearComunicadoResponse,
  CrearMantencionPayload,
  CrearReservaPayload,
  CrearVetadoPayload,
  CupoArriendo,
  Estacionamiento,
  EntradaBitacora,
  EspacioComun,
  EspacioComunInput,
  Guardia,
  HorarioOcupado,
  ListarMantencionesFiltro,
  ListarReservasFiltro,
  LoginResponse,
  Mantencion,
  Mascota,
  Notificacion,
  Paquete,
  PaquetePendiente,
  PatenteAdmin,
  PersonalAdmin,
  RegistrarEntradaPayload,
  RegistrarEntradaResponse,
  RegistrarEntregaPaquetePayload,
  RegistrarIngresoMantencionPayload,
  RegistrarLlegadaPaquetePayload,
  RegistrarLlegadaPaqueteResponse,
  RegistrarSalidaResponse,
  ReporteGastoComunResponse,
  Reserva,
  Residente,
  ResidenteAdmin,
  ResidenteConCarnet,
  TipoElementoMantencion,
  TipoEspacioComun,
  TipoPaquete,
  TipoPermiso,
  TipoPersonal,
  TipoResidente,
  TipoTenenciaPatente,
  Torre,
  TareaPersonal,
  TurnoAsignado,
  TurnoBloque,
  PersonalTurno,
  DuplaPatronInput,
  ResultadoGenerarPatron,
  TurnoPersonal,
  Unidad,
  UnidadGastoComun,
  Vetado,
  Visita,
  CondominioOpcion,
  CrearCondominioInput,
  CrearCondominioResponse,
  RequiereSeleccionCondominioResponse,
  PagoPendienteResponse,
  RequiereOnboardingResponse,
  CondominioSimple,
  AdministradorCuenta,
  CrearAdministradorInput,
  CondominioConFacturacion,
  EstacionamientoAdmin,
  TipoEstacionamiento,
  EstadoEstacionamiento,
  MisDatos,
  TipoSolicitudArco,
  SolicitudArco,
  SolicitudArcoAdmin,
  LogAuditoria,
  CategoriaRetencion,
  PoliticaRetencionItem,
  ResultadoLimpieza,
  IncidenteSeguridad,
  CrearIncidenteInput,
  QuienVieneHoy,
  TipoAmonestacion,
  TipoMulta,
  Amonestacion,
  CrearAmonestacionInput,
} from "./types";

// Ronda 17: con la sesión persistida (expo-secure-store), un token puede
// quedar guardado más allá de su vigencia (expiró, o el administrador
// revocó el acceso del residente) — sin este aviso, la app se quedaría
// mostrando pantallas con errores 401 sueltos en vez de volver al login.
// AuthContext se suscribe acá una sola vez y llama a logout() cuando
// cualquier request devuelve 401.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

// Ronda 27: igual que arriba pero para 402 — el condominio de la sesión
// activa se bloqueó por falta de pago DESPUÉS de loguearse (el token dura
// hasta 30 días, ver auth.service.ts). Sin este aviso, cada pantalla
// mostraría un error suelto distinto en vez de llevar a la persona a la
// pantalla de "mensualidad pendiente". AuthContext fuerza un logout y,
// como login() ya filtra los condominios bloqueados, el siguiente intento
// de entrar mostrará la pantalla correcta automáticamente.
let onPagoPendiente: (() => void) | null = null;
export function setPagoPendienteHandler(fn: (() => void) | null) {
  onPagoPendiente = fn;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  if (res.status === 401) {
    onUnauthorized?.();
  }
  if (res.status === 402) {
    onPagoPendiente?.();
  }
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || "Ocurrió un error inesperado.");
  }
  return body as T;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders(token) });
  return handleResponse<T>(res);
}

async function send<T>(path: string, method: string, token: string, body?: object): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function login(
  usuariocol: string,
  password: string
): Promise<LoginResponse | RequiereSeleccionCondominioResponse | PagoPendienteResponse | RequiereOnboardingResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuariocol, password }),
  });
  return handleResponse(res);
}

// Ronda 37: paso 2 del login cuando login() devolvió requiereOnboarding —
// el residente elige su usuario/clave definitivos.
export async function completarOnboarding(
  tokenIntermedio: string,
  usuariocolNuevo: string,
  passwordNuevo: string
): Promise<LoginResponse | RequiereSeleccionCondominioResponse | PagoPendienteResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/completar-onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: tokenIntermedio, usuariocol_nuevo: usuariocolNuevo, password_nuevo: passwordNuevo }),
  });
  return handleResponse(res);
}

// Ronda 26: paso 2 del login cuando login() devolvió requiereSeleccionCondominio.
// `tokenIntermedio` es el que vino en esa respuesta (no el de una sesión ya
// activa) — se manda en el body, no como Authorization.
export async function seleccionarCondominio(tokenIntermedio: string, condominioId: number): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/seleccionar-condominio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: tokenIntermedio, condominio_id: condominioId }),
  });
  return handleResponse(res);
}

export const getMisCondominios = (token: string) => get<CondominioOpcion[]>(`/admin-condominios/mios`, token);

export const crearCondominio = (token: string, input: CrearCondominioInput) =>
  send<CrearCondominioResponse>(`/admin-condominios`, "POST", token, input as unknown as object);

export const cambiarPassword = (token: string, passwordActual: string, passwordNueva: string) =>
  send<{ ok: boolean }>(`/auth/cambiar-password`, "POST", token, {
    password_actual: passwordActual,
    password_nueva: passwordNueva,
  });

// Registra el push token de Expo del teléfono (ronda 16) — best-effort,
// ver src/utils/notificaciones.ts. Nunca debería frenar el login si falla.
export const registrarPushToken = (token: string, pushToken: string) =>
  send<{ ok: boolean }>(`/auth/push-token`, "POST", token, { push_token: pushToken });

// Ronda 40: se llama al cerrar sesión (best-effort) para que ESTE
// dispositivo deje de recibir push apenas la persona sale — ver
// AuthContext -> logout.
export const eliminarPushToken = (token: string, pushToken: string) =>
  send<{ ok: boolean }>(`/auth/push-token`, "DELETE", token, { push_token: pushToken });

// Flujo "olvidé mi contraseña" (ronda 25) — sin token, el usuario todavía
// no puede loguearse. `identificador` acepta usuariocol o correo_usuario.
export async function solicitarRecuperacion(identificador: string): Promise<{ ok: boolean; mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/solicitar-recuperacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identificador }),
  });
  return handleResponse(res);
}

export async function resetearPassword(
  identificador: string,
  codigo: string,
  passwordNueva: string
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE_URL}/auth/resetear-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identificador, codigo, password_nueva: passwordNueva }),
  });
  return handleResponse(res);
}

export const getTorres = (token: string, condominioId: number) =>
  get<Torre[]>(`/torres?condominio_id=${condominioId}`, token);

export const getUnidadesPorTorre = (token: string, torreId: number) =>
  get<Unidad[]>(`/torres/${torreId}/unidades`, token);

export const getResidentesPorUnidad = (token: string, unidadId: number) =>
  get<Residente[]>(`/unidades/${unidadId}/residentes`, token);

export const getTiposPermiso = (token: string) => get<TipoPermiso[]>(`/tipos-permiso`, token);

export const getTiposTenenciaPatente = (token: string) =>
  get<TipoTenenciaPatente[]>(`/tipos-tenencia-patente`, token);

export const getResidentesConCarnetDiscapacidad = (token: string) =>
  get<ResidenteConCarnet[]>(`/residentes-discapacitados`, token);

export const getTiposResidente = (token: string) => get<TipoResidente[]>(`/tipos-residente`, token);

export const getDisponibilidad = (token: string, condominioId: number) =>
  get<Estacionamiento[]>(`/estacionamientos/disponibilidad?condominio_id=${condominioId}`, token);

export const getVisitasActivas = (token: string, condominioId: number) =>
  get<Visita[]>(`/visitas/activas?condominio_id=${condominioId}`, token);

export const registrarEntrada = (token: string, payload: RegistrarEntradaPayload) =>
  send<RegistrarEntradaResponse>(`/visitas`, "POST", token, payload);

export const registrarSalida = (token: string, idVisita: number) =>
  send<RegistrarSalidaResponse>(`/visitas/${idVisita}/salida`, "PATCH", token);

export const consultarPatente = (token: string, patente: string) =>
  get<ConsultaPatenteResponse>(`/patentes/${encodeURIComponent(patente)}`, token);

// --- Administrador -------------------------------------------------------

export const adminGetGuardias = (token: string) => get<Guardia[]>(`/admin/guardias`, token);

export const adminCrearGuardia = (
  token: string,
  input: { nombre_usuario: string; usuariocol: string; password: string }
) => send<Guardia>(`/admin/guardias`, "POST", token, input);

export const adminActualizarGuardia = (
  token: string,
  id: number,
  input: { nombre_usuario?: string; password?: string; flg_vigencia?: number }
) => send<Guardia>(`/admin/guardias/${id}`, "PATCH", token, input);

export const adminGetResidentes = (token: string) => get<ResidenteAdmin[]>(`/admin/residentes`, token);

export const adminCrearResidente = (
  token: string,
  input: {
    nombre_usuario: string;
    unidad_id_unidad: number;
    tipo_residente_id_tiporesidente?: number;
    flg_propietario?: number;
    rut?: string;
    fecha_nacimiento?: string;
    profesion?: string;
  }
) => send<ResidenteAdmin>(`/admin/residentes`, "POST", token, input);

export const adminActualizarResidente = (
  token: string,
  id: number,
  input: {
    nombre_usuario?: string;
    unidad_id_unidad?: number;
    flg_vigencia?: number;
    password?: string;
    flg_comite?: number;
    tipo_residente_id_tiporesidente?: number | null;
    flg_propietario?: number;
    rut?: string | null;
    fecha_nacimiento?: string | null;
    profesion?: string | null;
  }
) => send<ResidenteAdmin>(`/admin/residentes/${id}`, "PATCH", token, input);

// --- Acceso a la app (login) del residente --------------------------------

// Ronda 37: ya no se manda password — el backend genera una clave
// aleatoria de un solo uso y la devuelve en `password_temporal` (ver
// ResidenteAdmin) para que el admin se la comunique al residente.
// `usuariocol` es opcional — sin él, se autogenera (o se conserva el que
// ya tenía, si es un restablecimiento).
export const adminActivarAccesoResidente = (token: string, id: number, input?: { usuariocol?: string }) =>
  send<ResidenteAdmin>(`/admin/residentes/${id}/acceso`, "POST", token, input ?? {});

export const adminQuitarAccesoResidente = (token: string, id: number) =>
  send<void>(`/admin/residentes/${id}/acceso`, "DELETE", token);

export const adminRegistrarCarnetDiscapacidad = (
  token: string,
  idUsuario: number,
  numero_carnet?: string
) => send<{ id_residentediscapacitado: number }>(`/admin/residentes/${idUsuario}/discapacidad`, "POST", token, { numero_carnet });

export const adminQuitarCarnetDiscapacidad = (token: string, idUsuario: number) =>
  send<void>(`/admin/residentes/${idUsuario}/discapacidad`, "DELETE", token);

export const adminGetPatentes = (token: string) => get<PatenteAdmin[]>(`/admin/patentes`, token);

export const adminCrearPatente = (
  token: string,
  input: { patente: string; tipo_tenencia_id_tipotenencia: number; unidad_id_unidad: number }
) => send<PatenteAdmin>(`/admin/patentes`, "POST", token, input);

export const adminActualizarPatente = (
  token: string,
  id: number,
  input: { patente?: string; tipo_tenencia_id_tipotenencia?: number; flg_vigencia?: number }
) => send<PatenteAdmin>(`/admin/patentes/${id}`, "PATCH", token, input);

export const adminAuditarPatente = (token: string, patente: string) =>
  get<AuditoriaPatenteItem[]>(`/admin/auditoria/patente/${encodeURIComponent(patente)}`, token);

export const adminReporteGastoComun = (
  token: string,
  fechaInicio: string,
  fechaTermino: string,
  condominioId: number
) =>
  get<ReporteGastoComunResponse>(
    `/admin/reportes/gasto-comun?fecha_inicio=${fechaInicio}&fecha_termino=${fechaTermino}&condominio_id=${condominioId}`,
    token
  );

// Ronda 20: URL del Excel del reporte de gasto común (pensado para subir a
// ComunidadFeliz — ver reportes.service.ts). No usa `get()` porque la
// respuesta es binaria, no JSON — la descarga real la hace
// descargarYCompartirArchivo() en utils/descargas.ts.
export const urlReporteGastoComunExcel = (fechaInicio: string, fechaTermino: string, condominioId: number) =>
  `${API_BASE_URL}/admin/reportes/gasto-comun/excel?fecha_inicio=${fechaInicio}&fecha_termino=${fechaTermino}&condominio_id=${condominioId}`;

// --- Paquetería ------------------------------------------------------------

export const getTiposPaquete = (token: string, condominioId: number) =>
  get<TipoPaquete[]>(`/tipos-paquete?condominio_id=${condominioId}`, token);

export const registrarLlegadaPaquete = (token: string, payload: RegistrarLlegadaPaquetePayload) =>
  send<RegistrarLlegadaPaqueteResponse>(`/paquetes`, "POST", token, payload);

export const paqueteCambiarEstado = (
  token: string,
  idPaquete: number,
  nuevoEstado: string,
  observacion: string | undefined,
  condominioId: number
) =>
  send<Paquete>(`/paquetes/${idPaquete}/estado`, "PATCH", token, {
    nuevo_estado: nuevoEstado,
    observacion,
    condominio_id_condominio: condominioId,
  });

export const paqueteRegistrarEntrega = (token: string, idPaquete: number, payload: RegistrarEntregaPaquetePayload) =>
  send<Paquete>(`/paquetes/${idPaquete}/entrega`, "PATCH", token, payload);

export const getPaquetesPendientes = (token: string, condominioId: number) =>
  get<PaquetePendiente[]>(`/paquetes/pendientes?condominio_id=${condominioId}`, token);

export const buscarPaquetes = (token: string, filtro: BuscarPaquetesFiltro) => {
  const params = new URLSearchParams();
  params.set("condominio_id", String(filtro.condominio_id));
  if (filtro.fecha_inicio) params.set("fecha_inicio", filtro.fecha_inicio);
  if (filtro.fecha_termino) params.set("fecha_termino", filtro.fecha_termino);
  if (filtro.q) params.set("q", filtro.q);
  if (filtro.unidad_id) params.set("unidad_id", String(filtro.unidad_id));
  if (filtro.estado) params.set("estado", filtro.estado);
  return get<Paquete[]>(`/paquetes?${params.toString()}`, token);
};

export const getPaquete = (token: string, idPaquete: number) => get<Paquete>(`/paquetes/${idPaquete}`, token);

// --- Reservas de Espacios Comunes ------------------------------------------

export const getTiposEspacioComun = (token: string, condominioId: number) =>
  get<TipoEspacioComun[]>(`/reservas/espacios/tipos?condominio_id=${condominioId}`, token);

export const getEspaciosComunes = (token: string, condominioId: number) =>
  get<EspacioComun[]>(`/reservas/espacios?condominio_id=${condominioId}`, token);

export const getDisponibilidadEspacio = (token: string, idEspacio: number, fecha: string) =>
  get<HorarioOcupado[]>(`/reservas/espacios/${idEspacio}/disponibilidad?fecha=${fecha}`, token);

export const crearReserva = (token: string, payload: CrearReservaPayload) => send<Reserva>(`/reservas`, "POST", token, payload);

export const getMisReservas = (token: string, condominioId: number) =>
  get<Reserva[]>(`/reservas/mias?condominio_id=${condominioId}`, token);

export const getReserva = (token: string, id: number) => get<Reserva>(`/reservas/${id}`, token);

export const cancelarReserva = (token: string, id: number) => send<Reserva>(`/reservas/${id}/cancelar`, "PATCH", token);

export const subirComprobanteReserva = (token: string, id: number, comprobante: string) =>
  send<Reserva>(`/reservas/${id}/comprobante`, "POST", token, { comprobante });

export const getReservasDelDia = (token: string, condominioId: number, fecha: string) =>
  get<Reserva[]>(`/reservas/dia?condominio_id=${condominioId}&fecha=${fecha}`, token);

export const marcarLlegadaReserva = (token: string, id: number) => send<Reserva>(`/reservas/${id}/llegada`, "PATCH", token);

export const marcarSalidaReserva = (token: string, id: number) => send<Reserva>(`/reservas/${id}/salida`, "PATCH", token);

// --- Administrador: configuración de espacios y gestión de reservas -------

export const adminGetEspacios = (token: string, condominioId: number) =>
  get<EspacioComun[]>(`/admin/espacios?condominio_id=${condominioId}`, token);

export const adminCrearEspacio = (token: string, input: EspacioComunInput) =>
  send<EspacioComun>(`/admin/espacios`, "POST", token, input);

export const adminActualizarEspacio = (token: string, id: number, input: Partial<EspacioComunInput> & { flg_vigencia?: number }) =>
  send<EspacioComun>(`/admin/espacios/${id}`, "PATCH", token, input);

export const adminGetReservas = (token: string, filtro: ListarReservasFiltro) => {
  const params = new URLSearchParams();
  params.set("condominio_id", String(filtro.condominio_id));
  if (filtro.estado) params.set("estado", filtro.estado);
  if (filtro.espacio_id) params.set("espacio_id", String(filtro.espacio_id));
  if (filtro.fecha_inicio) params.set("fecha_inicio", filtro.fecha_inicio);
  if (filtro.fecha_termino) params.set("fecha_termino", filtro.fecha_termino);
  return get<Reserva[]>(`/admin/reservas?${params.toString()}`, token);
};

export const adminAprobarReserva = (token: string, id: number) => send<Reserva>(`/admin/reservas/${id}/aprobar`, "PATCH", token);

export const adminRechazarReserva = (token: string, id: number, motivo: string) =>
  send<Reserva>(`/admin/reservas/${id}/rechazar`, "PATCH", token, { motivo });

export const adminValidarPagoReserva = (token: string, id: number) =>
  send<Reserva>(`/admin/reservas/${id}/validar-pago`, "PATCH", token);

export const adminResolverGarantia = (
  token: string,
  id: number,
  decision: "Devuelta" | "Retenida",
  monto_retenido?: number,
  observacion?: string
) => send<Reserva>(`/admin/reservas/${id}/garantia`, "PATCH", token, { decision, monto_retenido, observacion });

// --- Mi depto: autoadministración del hogar por el dueño (ronda 15) -------
// Solo funciona si el residente logeado es el propietario de su unidad
// (guardia.esPropietario) — el backend además valida esto por su cuenta.

export const getMisResidentesDelHogar = (token: string) => get<ResidenteAdmin[]>(`/mi-depto/residentes`, token);

export const crearResidenteDelHogar = (
  token: string,
  input: {
    nombre_usuario: string;
    tipo_residente_id_tiporesidente?: number;
    rut?: string;
    fecha_nacimiento?: string;
    profesion?: string;
  }
) => send<ResidenteAdmin>(`/mi-depto/residentes`, "POST", token, input);

export const actualizarResidenteDelHogar = (
  token: string,
  id: number,
  input: {
    nombre_usuario?: string;
    flg_vigencia?: number;
    tipo_residente_id_tiporesidente?: number | null;
    rut?: string | null;
    fecha_nacimiento?: string | null;
    profesion?: string | null;
  }
) => send<ResidenteAdmin>(`/mi-depto/residentes/${id}`, "PATCH", token, input);

// --- Notificaciones (ronda 16) ---------------------------------------------
// Bandeja propia: paquetes/visitas/comunicados que le llegaron a este
// usuario. Cualquier rol logeado puede consultarla (en la práctica hoy solo
// Residente recibe algo).

export const getNotificaciones = (token: string) => get<Notificacion[]>(`/notificaciones`, token);

export const marcarNotificacionLeida = (token: string, idNotificacionUsuario: number) =>
  send<{ ok: boolean }>(`/notificaciones/${idNotificacionUsuario}/leido`, "PATCH", token);

// --- Comunicados (ronda 16, Administrador/Comité) --------------------------
// Le llega como notificación a TODOS los residentes activos con acceso del
// condominio (regla del usuario: "debería llegarles a todos").

export const adminCrearComunicado = (token: string, input: { titulo: string; cuerpo: string; condominio_id_condominio: number }) =>
  send<CrearComunicadoResponse>(`/admin/comunicados`, "POST", token, input);

// --- Gasto común por depto (ronda 17, Administrador/Comité) ----------------

export const adminGetUnidadesGastoComun = (token: string, condominioId: number) =>
  get<UnidadGastoComun[]>(`/admin/unidades/gasto-comun?condominio_id=${condominioId}`, token);

export const adminActualizarGastoComunUnidad = (token: string, idUnidad: number, flgGastocomun: number) =>
  send<UnidadGastoComun>(`/admin/unidades/${idUnidad}/gasto-comun`, "PATCH", token, { flg_gastocomun: flgGastocomun });

// --- Personal externo (ronda 18, Administrador/Comité) ---------------------
// Aseo, jardinería, mantención, etc. — ficha + especialidad, tareas puntuales
// (le llegan como notificación) e historial de turno/cumplimiento.

export const adminGetTiposPersonal = (token: string, condominioId: number) =>
  get<TipoPersonal[]>(`/admin/personal/tipos?condominio_id=${condominioId}`, token);

export const adminGetPersonal = (token: string) => get<PersonalAdmin[]>(`/admin/personal`, token);

export const adminCrearPersonal = (
  token: string,
  input: { nombre_usuario: string; usuariocol: string; password: string; tipo_personal_id_tipopersonal?: number; condominio_id_condominio: number }
) => send<PersonalAdmin>(`/admin/personal`, "POST", token, input);

export const adminActualizarPersonal = (
  token: string,
  id: number,
  input: { nombre_usuario?: string; password?: string; flg_vigencia?: number; tipo_personal_id_tipopersonal?: number | null }
) => send<PersonalAdmin>(`/admin/personal/${id}`, "PATCH", token, input);

// Tarea puntual (texto libre, no una plantilla) que le llega al trabajador
// como notificación — bandeja + push best-effort, igual que un comunicado.
export const adminAsignarTareaPersonal = (token: string, idUsuario: number, descripcion: string, condominioId: number) =>
  send<TareaPersonal>(`/admin/personal/${idUsuario}/tarea`, "POST", token, {
    descripcion,
    condominio_id_condominio: condominioId,
  });

// Historial de cumplimiento — solo Administrador/Comité (decisión explícita
// del usuario). Sin idUsuario trae el historial de TODO el personal.
export const adminGetTareasPersonal = (token: string, condominioId: number, idUsuario?: number) =>
  get<TareaPersonal[]>(
    `/admin/personal/tareas?condominio_id=${condominioId}${idUsuario ? `&usuario_id=${idUsuario}` : ""}`,
    token
  );

export const adminGetTurnosPersonal = (token: string, idUsuario: number) =>
  get<TurnoPersonal[]>(`/admin/personal/${idUsuario}/turnos`, token);

// --- Personal externo (ronda 18, autoservicio del propio trabajador) ------
// "Empezar turno"/"Marcar salida" y la bandeja de "mis tareas" — el
// trabajador las marca como completadas él mismo.

export const personalIniciarTurno = (token: string, condominioId: number) =>
  send<TurnoPersonal>(`/personal/turno/iniciar`, "POST", token, { condominio_id_condominio: condominioId });

export const personalFinalizarTurno = (token: string) => send<TurnoPersonal>(`/personal/turno/finalizar`, "POST", token);

export const personalGetTurnoActual = (token: string) => get<TurnoPersonal | null>(`/personal/turno/actual`, token);

export const personalGetTareas = (token: string) => get<TareaPersonal[]>(`/personal/tareas`, token);

export const personalCompletarTarea = (token: string, idTarea: number) =>
  send<TareaPersonal>(`/personal/tareas/${idTarea}/completar`, "PATCH", token);

// --- Mantenciones (ronda 19, Guardia + Administrador) ----------------------
// Limpieza de techo, piscina, ascensores, etc. — trabajo de una empresa
// externa sin cuenta en el sistema. El guardia solo opera el día a día
// (elegir de la lista + marcar ingreso/salida); la programación completa
// (crear/editar/cancelar/comprobantes) es de Administrador/Comité, ver más
// abajo.

export const getElementosMantencion = (token: string, condominioId: number) =>
  get<TipoElementoMantencion[]>(`/mantenciones/elementos?condominio_id=${condominioId}`, token);

export const getMantencionesProgramadas = (token: string, condominioId: number) =>
  get<Mantencion[]>(`/mantenciones/programadas?condominio_id=${condominioId}`, token);

export const getMantencionesEnCurso = (token: string, condominioId: number) =>
  get<Mantencion[]>(`/mantenciones/en-curso?condominio_id=${condominioId}`, token);

export const getMantencion = (token: string, id: number) => get<Mantencion>(`/mantenciones/${id}`, token);

export const registrarIngresoMantencion = (token: string, id: number, payload: RegistrarIngresoMantencionPayload) =>
  send<Mantencion>(`/mantenciones/${id}/ingreso`, "PATCH", token, payload);

export const registrarSalidaMantencion = (token: string, id: number) =>
  send<Mantencion>(`/mantenciones/${id}/salida`, "PATCH", token);

// --- Mantenciones (ronda 19, Administrador/Comité) --------------------------
// Catálogo de infraestructura (propio de cada condominio, editable) +
// programación/cancelación + comprobantes/foto/costo real después.

export const adminGetElementosMantencion = (token: string, condominioId: number, incluirInactivos = false) =>
  get<TipoElementoMantencion[]>(
    `/admin/elementos-mantencion?condominio_id=${condominioId}${incluirInactivos ? "&incluir_inactivos=1" : ""}`,
    token
  );

export const adminCrearElementoMantencion = (token: string, condominioId: number, gls_tipoelementomantencion: string) =>
  send<TipoElementoMantencion>(`/admin/elementos-mantencion`, "POST", token, {
    gls_tipoelementomantencion,
    condominio_id_condominio: condominioId,
  });

export const adminActualizarElementoMantencion = (
  token: string,
  id: number,
  input: { gls_tipoelementomantencion?: string; flg_vigencia?: number }
) => send<TipoElementoMantencion>(`/admin/elementos-mantencion/${id}`, "PATCH", token, input);

export const adminGetMantenciones = (token: string, filtro: ListarMantencionesFiltro) => {
  const params = new URLSearchParams();
  params.set("condominio_id", String(filtro.condominio_id));
  if (filtro.estado) params.set("estado", filtro.estado);
  if (filtro.tipo_elemento_id) params.set("tipo_elemento_id", String(filtro.tipo_elemento_id));
  if (filtro.fecha_inicio) params.set("fecha_inicio", filtro.fecha_inicio);
  if (filtro.fecha_termino) params.set("fecha_termino", filtro.fecha_termino);
  return get<Mantencion[]>(`/admin/mantenciones?${params.toString()}`, token);
};

export const adminGetMantencion = (token: string, id: number) => get<Mantencion>(`/admin/mantenciones/${id}`, token);

export const adminCrearMantencion = (token: string, payload: CrearMantencionPayload) =>
  send<Mantencion>(`/admin/mantenciones`, "POST", token, payload);

export const adminActualizarMantencion = (
  token: string,
  id: number,
  input: Partial<Omit<CrearMantencionPayload, "condominio_id_condominio">>
) => send<Mantencion>(`/admin/mantenciones/${id}`, "PATCH", token, input);

export const adminCancelarMantencion = (token: string, id: number, motivo: string) =>
  send<Mantencion>(`/admin/mantenciones/${id}/cancelar`, "PATCH", token, { motivo });

export const adminSubirDatosFinalesMantencion = (
  token: string,
  id: number,
  input: { comprobante?: string; foto?: string; costo_real?: number }
) => send<Mantencion>(`/admin/mantenciones/${id}/comprobante`, "POST", token, input);

// --- Ronda 20: Estacionamientos para arriendo entre residentes -------------
// Pizarrón informativo (Guardia/Residente/Administrador/Comité pueden
// verlo); solo el dueño del cupo o Administrador/Comité pueden cambiarlo.

export const getPizarronArriendo = (token: string, condominioId: number) =>
  get<CupoArriendo[]>(`/estacionamientos/arriendo?condominio_id=${condominioId}`, token);

export const actualizarEstadoArriendo = (
  token: string,
  id: number,
  input: { disponible: boolean; precio_arriendo?: number | null }
) => send<CupoArriendo>(`/estacionamientos/arriendo/${id}`, "PATCH", token, input);

// --- Ronda 20: VETADOS -------------------------------------------------------

// Búsqueda proactiva del guardia por RUT — no requiere Administrador.
export const buscarVetadoPorRut = (token: string, rut: string, condominioId: number) =>
  get<{ vetado: Vetado | null }>(`/vetados/buscar?rut=${encodeURIComponent(rut)}&condominio_id=${condominioId}`, token);

// Listado completo + CRUD — solo Administrador/Comité.
export const adminGetVetados = (token: string, condominioId: number) =>
  get<Vetado[]>(`/vetados?condominio_id=${condominioId}`, token);

export const adminCrearVetado = (token: string, payload: CrearVetadoPayload) =>
  send<Vetado>(`/vetados`, "POST", token, payload);

export const adminActualizarVetado = (
  token: string,
  id: number,
  input: Partial<Omit<CrearVetadoPayload, "condominio_id_condominio">> & { flg_vigencia?: number }
) => send<Vetado>(`/vetados/${id}`, "PATCH", token, input);

// --- Ronda 20: Bitácora de guardias -----------------------------------------
// Lectura compartida entre Guardia y Administrador/Comité; escritura
// exclusiva de Guardia.

export const getBitacora = (token: string, condominioId: number, fechaInicio?: string, fechaTermino?: string) => {
  const params = new URLSearchParams();
  params.set("condominio_id", String(condominioId));
  if (fechaInicio) params.set("fecha_inicio", fechaInicio);
  if (fechaTermino) params.set("fecha_termino", fechaTermino);
  return get<EntradaBitacora[]>(`/bitacora?${params.toString()}`, token);
};

export const crearEntradaBitacora = (token: string, texto: string, condominioId: number) =>
  send<EntradaBitacora>(`/bitacora`, "POST", token, { texto, condominio_id_condominio: condominioId });

// --- Ronda 20/39: JEFE_GUARDIAS ----------------------------------------------
// Este rol tiene acceso a: calendario de turnos (con vista mensual desde la
// ronda 39), CRUD de bloques de turno, generador de patrón ("4x4"), y CRUD
// de guardias (que reutiliza tal cual los mismos datos que
// adminGetGuardias/adminCrearGuardia/adminActualizarGuardia, pero por rutas
// propias).

export const jefeGetBloques = (token: string, condominioId: number) =>
  get<TurnoBloque[]>(`/jefe-guardias/bloques?condominio_id=${condominioId}`, token);

export const jefeCrearBloque = (
  token: string,
  condominioId: number,
  input: { gls_turnobloque: string; hora_inicio: string; hora_termino: string }
) => send<TurnoBloque>(`/jefe-guardias/bloques`, "POST", token, { ...input, condominio_id_condominio: condominioId });

export const jefeActualizarBloque = (
  token: string,
  id: number,
  input: { gls_turnobloque?: string; hora_inicio?: string; hora_termino?: string }
) => send<TurnoBloque>(`/jefe-guardias/bloques/${id}`, "PATCH", token, input);

export const jefeEliminarBloque = (token: string, id: number) => send<void>(`/jefe-guardias/bloques/${id}`, "DELETE", token);

// Ronda 39: Guardia + JefeGuardias (antes solo se podía elegir un Guardia).
export const jefeGetPersonal = (token: string, condominioId: number) =>
  get<PersonalTurno[]>(`/jefe-guardias/personal?condominio_id=${condominioId}`, token);

// Ronda 39: renombrada de jefeGetTurnosSemana — sin fechas trae la semana en
// curso, con fechas cualquier rango (usado ahora para traer un mes completo).
export const jefeGetTurnos = (token: string, condominioId: number, fechaInicio?: string, fechaTermino?: string) => {
  const params = new URLSearchParams();
  params.set("condominio_id", String(condominioId));
  if (fechaInicio) params.set("fecha_inicio", fechaInicio);
  if (fechaTermino) params.set("fecha_termino", fechaTermino);
  return get<TurnoAsignado[]>(`/jefe-guardias/turnos?${params.toString()}`, token);
};

export const jefeAsignarTurno = (
  token: string,
  input: { guardia_usuario_id: number; turno_bloque_id_turnobloque: number; fecha: string; condominio_id_condominio: number }
) => send<TurnoAsignado>(`/jefe-guardias/turnos`, "POST", token, input);

export const jefeQuitarTurno = (token: string, id: number) => send<void>(`/jefe-guardias/turnos/${id}`, "DELETE", token);

// Ronda 39, a pedido explícito del usuario: genera el calendario de un
// rango completo, rotando cíclicamente por `duplas` cada `diasPorBloque`
// días (patrón "4x4"). SOBRESCRIBE cualquier asignación previa en ese
// rango — ver la nota completa en turnos.service.ts.
export const jefeGenerarPatronTurnos = (
  token: string,
  condominioId: number,
  input: {
    fecha_inicio: string;
    fecha_termino: string;
    bloque_dia_id: number;
    bloque_noche_id: number;
    dias_por_bloque: number;
    duplas: DuplaPatronInput[];
  }
) =>
  send<ResultadoGenerarPatron>(`/jefe-guardias/turnos/generar-patron`, "POST", token, {
    ...input,
    condominio_id_condominio: condominioId,
  });

export const jefeGetGuardias = (token: string) => get<Guardia[]>(`/jefe-guardias/guardias`, token);

export const jefeCrearGuardia = (
  token: string,
  input: { nombre_usuario: string; usuariocol: string; password: string }
) => send<Guardia>(`/jefe-guardias/guardias`, "POST", token, input);

export const jefeActualizarGuardia = (
  token: string,
  id: number,
  input: { nombre_usuario?: string; password?: string; flg_vigencia?: number }
) => send<Guardia>(`/jefe-guardias/guardias/${id}`, "PATCH", token, input);

// --- Ronda 20: Mascotas ------------------------------------------------------
// Sin argumentos trae las de mi propia unidad (Residente); con condominioId
// trae todas (Administrador/Comité) — ver mascotasRouter en el backend.

export const getMascotas = (token: string, condominioId?: number) =>
  get<Mascota[]>(`/mascotas${condominioId ? `?condominio_id=${condominioId}` : ""}`, token);

export const crearMascota = (
  token: string,
  input: { nombre: string; especie?: string; raza?: string; numero_chip?: string; foto?: string; unidad_id_unidad?: number; condominio_id_condominio?: number }
) => send<Mascota>(`/mascotas`, "POST", token, input);

export const actualizarMascota = (
  token: string,
  id: number,
  input: { nombre?: string; especie?: string; raza?: string; numero_chip?: string; foto?: string; flg_vigencia?: number }
) => send<Mascota>(`/mascotas/${id}`, "PATCH", token, input);

export const eliminarMascota = (token: string, id: number) => send<void>(`/mascotas/${id}`, "DELETE", token);

// --- Ronda 27: SuperAdmin — crear Administradores + facturación -------------

export const superAdminGetCondominios = (token: string) => get<CondominioSimple[]>(`/super-admin/condominios`, token);

export const superAdminGetAdministradores = (token: string) =>
  get<AdministradorCuenta[]>(`/super-admin/administradores`, token);

export const superAdminCrearAdministrador = (token: string, input: CrearAdministradorInput) =>
  send<AdministradorCuenta>(`/super-admin/administradores`, "POST", token, input);

export const superAdminActualizarAdministrador = (
  token: string,
  id: number,
  input: { password?: string; flg_vigencia?: number }
) => send<AdministradorCuenta>(`/super-admin/administradores/${id}`, "PATCH", token, input);

export const superAdminGetFacturacion = (token: string) =>
  get<CondominioConFacturacion[]>(`/super-admin/facturacion`, token);

export const superAdminConfigurarFacturacion = (
  token: string,
  condominioId: number,
  input: { monto_mensualidad: number | null; dia_limite_pago?: number }
) => send<{ ok: boolean }>(`/super-admin/facturacion/${condominioId}`, "PUT", token, input);

export const superAdminMarcarPagado = (token: string, condominioId: number, input: { periodo?: string; monto: number }) =>
  send<{ ok: boolean }>(`/super-admin/facturacion/${condominioId}/marcar-pagado`, "POST", token, input);

// --- Ronda 28/29: administración de estacionamientos ------------------------

export const getEstacionamientosAdmin = (token: string, condominioId: number) =>
  get<EstacionamientoAdmin[]>(`/admin/estacionamientos?condominio_id=${condominioId}`, token);

export const getEstadosEstacionamiento = (token: string) => get<EstadoEstacionamiento[]>(`/admin/estacionamientos/estados`, token);

export const getTiposEstacionamiento = (token: string) => get<TipoEstacionamiento[]>(`/admin/estacionamientos/tipos`, token);

export const crearEstacionamiento = (
  token: string,
  input: {
    numero_estacionamiento: string;
    ubicacion?: string;
    tipo_estacionamiento_id_tipoestacionamiento: number;
    unidad_id_unidad?: number | null;
    condominio_id_condominio: number;
  }
) => send<EstacionamientoAdmin>(`/admin/estacionamientos`, "POST", token, input);

// Ronda 29/30: generalizada — puede cambiar el estado, la asignación de
// depto (unidad_id_unidad, null para desasignar), el registro formal de
// ocupación (patente/flg_arrendado/tipo_ocupante), o cualquier combinación.
export const actualizarEstacionamiento = (
  token: string,
  id: number,
  input: {
    estado_id?: number;
    unidad_id_unidad?: number | null;
    patente?: string | null;
    flg_arrendado?: number;
    tipo_ocupante?: "Propietario" | "Arrendatario" | null;
  }
) => send<EstacionamientoAdmin>(`/admin/estacionamientos/${id}`, "PATCH", token, input);

// --- Ronda 32: derechos ARCO (Ley 21.719 de Protección de Datos) -----------

export const getMisDatos = (token: string) => get<MisDatos>(`/privacidad/mis-datos`, token);

export const getMisSolicitudesArco = (token: string) => get<SolicitudArco[]>(`/privacidad/mis-solicitudes`, token);

export const crearSolicitudArco = (token: string, input: { tipo: TipoSolicitudArco; detalle: string }) =>
  send<SolicitudArco>(`/privacidad/solicitudes`, "POST", token, input);

export const adminGetSolicitudesArco = (token: string, condominioId: number) =>
  get<SolicitudArcoAdmin[]>(`/admin/privacidad/solicitudes?condominio_id=${condominioId}`, token);

export const adminResolverSolicitudArco = (
  token: string,
  id: number,
  input: { estado: "Resuelta" | "Rechazada"; respuesta_admin: string }
) => send<SolicitudArcoAdmin>(`/admin/privacidad/solicitudes/${id}`, "PATCH", token, input);

export const adminGetAuditoria = (
  token: string,
  condominioId: number,
  filtro: { usuario_id?: number; accion?: string; desde?: string; hasta?: string; q?: string } = {}
) => {
  const params = new URLSearchParams({ condominio_id: String(condominioId) });
  if (filtro.usuario_id) params.set("usuario_id", String(filtro.usuario_id));
  if (filtro.accion) params.set("accion", filtro.accion);
  if (filtro.desde) params.set("desde", filtro.desde);
  if (filtro.hasta) params.set("hasta", filtro.hasta);
  if (filtro.q) params.set("q", filtro.q);
  return get<LogAuditoria[]>(`/admin/auditoria?${params.toString()}`, token);
};

// --- Ronda 34: retención de datos (Ley 21.719) ------------------------------

export const adminGetRetencion = (token: string, condominioId: number) =>
  get<PoliticaRetencionItem[]>(`/admin/retencion?condominio_id=${condominioId}`, token);

// Ronda 35, a pedido explícito del usuario: cada condominio define el
// plazo en la unidad que le acomode — días, semanas o años.
export type UnidadRetencion = "dias" | "semanas" | "anios";

export const adminConfigurarRetencion = (
  token: string,
  condominioId: number,
  categoria: CategoriaRetencion,
  cantidad: number | null,
  unidad: UnidadRetencion
) =>
  send<{ ok: boolean }>(`/admin/retencion/${categoria}`, "PUT", token, {
    condominio_id_condominio: condominioId,
    cantidad,
    unidad,
  });

export const adminEjecutarLimpiezaRetencion = (token: string, condominioId: number) =>
  send<ResultadoLimpieza[]>(`/admin/retencion/ejecutar`, "POST", token, { condominio_id_condominio: condominioId });

// --- Ronda 34: notificación de brechas de seguridad (Ley 21.719) -----------

export const adminGetIncidentes = (token: string, condominioId: number) =>
  get<IncidenteSeguridad[]>(`/admin/incidentes?condominio_id=${condominioId}`, token);

export const adminCrearIncidente = (token: string, condominioId: number, input: CrearIncidenteInput) =>
  send<IncidenteSeguridad>(`/admin/incidentes`, "POST", token, { ...input, condominio_id_condominio: condominioId });

export const adminNotificarAgencia = (token: string, id: number) =>
  send<IncidenteSeguridad>(`/admin/incidentes/${id}/notificar-agencia`, "POST", token, {});

export const adminNotificarAfectados = (token: string, id: number) =>
  send<IncidenteSeguridad>(`/admin/incidentes/${id}/notificar-afectados`, "POST", token, {});

export const adminCerrarIncidente = (token: string, id: number, accionesTomadas: string) =>
  send<IncidenteSeguridad>(`/admin/incidentes/${id}/cerrar`, "POST", token, { acciones_tomadas: accionesTomadas });

// --- Ronda 40: "quién viene hoy" (personal externo + mantenciones) --------

export const getQuienVieneHoy = (token: string, condominioId: number) =>
  get<QuienVieneHoy>(`/hoy?condominio_id=${condominioId}`, token);

// --- Ronda 41: Amonestaciones y Multas --------------------------------------
// Todas estas rutas viven bajo /admin/*, así que Administrador o Comité
// (ambos con acceso al módulo completo). El chequeo exclusivo de
// Administrador para "notificar" una multa se hace en el backend — el
// front igualmente oculta ese botón si el rol no es Administrador, para
// que no llegue a intentarlo y se lleve un error.

export const adminGetTiposAmonestacion = (token: string, condominioId: number, incluirInactivos = false) =>
  get<TipoAmonestacion[]>(
    `/admin/tipos-amonestacion?condominio_id=${condominioId}${incluirInactivos ? "&incluir_inactivos=true" : ""}`,
    token
  );

export const adminCrearTipoAmonestacion = (
  token: string,
  condominioId: number,
  input: { gls_tipoamonestacion: string; flg_es_multa?: number }
) => send<TipoAmonestacion>(`/admin/tipos-amonestacion`, "POST", token, { ...input, condominio_id_condominio: condominioId });

export const adminActualizarTipoAmonestacion = (
  token: string,
  id: number,
  input: { gls_tipoamonestacion?: string; flg_es_multa?: number; flg_vigencia?: number }
) => send<TipoAmonestacion>(`/admin/tipos-amonestacion/${id}`, "PATCH", token, input);

export const adminGetTiposMulta = (token: string, condominioId: number, incluirInactivos = false) =>
  get<TipoMulta[]>(`/admin/tipos-multa?condominio_id=${condominioId}${incluirInactivos ? "&incluir_inactivos=true" : ""}`, token);

export const adminCrearTipoMulta = (
  token: string,
  condominioId: number,
  input: { gls_tipomulta: string; monto_sugerido?: number; unidad_monto?: string }
) => send<TipoMulta>(`/admin/tipos-multa`, "POST", token, { ...input, condominio_id_condominio: condominioId });

export const adminActualizarTipoMulta = (
  token: string,
  id: number,
  input: { gls_tipomulta?: string; monto_sugerido?: number | null; unidad_monto?: string; flg_vigencia?: number }
) => send<TipoMulta>(`/admin/tipos-multa/${id}`, "PATCH", token, input);

export const adminGetAmonestaciones = (token: string, condominioId: number, filtro?: { estado?: string; unidad_id?: number }) => {
  const params = new URLSearchParams({ condominio_id: String(condominioId) });
  if (filtro?.estado) params.set("estado", filtro.estado);
  if (filtro?.unidad_id) params.set("unidad_id", String(filtro.unidad_id));
  return get<Amonestacion[]>(`/admin/amonestaciones?${params.toString()}`, token);
};

export const adminCrearAmonestacion = (token: string, condominioId: number, input: CrearAmonestacionInput) =>
  send<Amonestacion>(`/admin/amonestaciones`, "POST", token, { ...input, condominio_id_condominio: condominioId });

export const adminAprobarMulta = (token: string, id: number) =>
  send<Amonestacion>(`/admin/amonestaciones/${id}/aprobar`, "POST", token, {});

export const adminRechazarMulta = (token: string, id: number, motivo: string) =>
  send<Amonestacion>(`/admin/amonestaciones/${id}/rechazar`, "POST", token, { motivo });

export const adminNotificarMulta = (token: string, id: number) =>
  send<Amonestacion>(`/admin/amonestaciones/${id}/notificar`, "POST", token, {});
