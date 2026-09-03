export interface Estacionamiento {
  id_estacionamiento: number;
  numero_estacionamiento: string;
  ubicacion: string | null;
  gls_tipoestacionamiento: "Visita" | "Discapacitado";
  gls_estadoestacionamiento: "Disponible" | "Ocupado" | "Fuera de servicio";
  visita_activa_id: number | null;
  visita_activa_nombre: string | null;
  visita_activa_patente: string | null;
  visita_activa_fecha_entrada: string | null;
}

export interface Visita {
  id_visita: number;
  fecha_entrada: string;
  hora_entrada: string;
  fecha_salida: string | null;
  hora_salida: string | null;
  patente: string | null;
  nombre_visita: string;
  rut_visita: string | null;
  tipo_ocupante: "Visita" | "Residente";
  nombre_residente_visitado: string | null;
  residente_coincide: number;
  carnet_discapacidad_confirmado: number;
  numero_estacionamiento: string | null;
  gls_tipovisita: string;
  gls_tipopermiso: string;
  numero_unidad: string;
  nombre_torre: string;
  nombre_guardia_creador: string;
}

export interface Torre {
  id_torreblock: number;
  nombre_torre: string;
}

export interface Unidad {
  id_unidad: number;
  numero_unidad: string;
}

export interface Residente {
  id_usuario: number;
  nombre_usuario: string;
}

export interface ResidenteConCarnet {
  id_usuario: number;
  nombre_usuario: string;
  numero_unidad: string;
  nombre_torre: string;
}

export interface TipoPermiso {
  id_tipopermiso: number;
  gls_tipopermiso: string;
  tiempo_gratis_minutos: number;
  tarifa_por_minuto_extra: number;
  monto_fijo: number;
  sin_limite_tiempo: number;
  dias_minimo: number | null;
  dias_maximo: number | null;
}

export interface TipoTenenciaPatente {
  id_tipotenencia: number;
  gls_tipotenencia: string;
}

export interface RegistrarEntradaPayload {
  patente?: string;
  nombre_visita?: string;
  rut_visita?: string;
  tipo_visita_id_tipovisita: number;
  tipo_permiso_id_tipopermiso: number;
  condominio_id_condominio: number;
  unidad_id_unidad?: number;
  nombre_residente_visitado?: string;
  residente_visitado_usuario_id?: number;
  tipo_ocupante?: "Visita" | "Residente";
  carnet_discapacidad_confirmado?: boolean;
  residente_usuario_id?: number;
}

export interface RegistrarEntradaResponse {
  visita: Visita;
  cupoAsignado: boolean;
  residenteCoincide: boolean;
  cargoInmediato: { concepto: string; monto_cobrar: number } | null;
  // Ronda 20: coincidencia con la lista VETADOS por RUT y/o patente — solo
  // informativa, nunca bloquea el registro (el guardia decide cómo
  // proceder). null si no hay coincidencia.
  alertaVetado: AlertaVetado | null;
}

export interface ConstanciaExcesoTiempo {
  id_constancia: number;
  concepto: string;
  minutos_extras: number | null;
  monto_cobrar: number;
}

export interface RegistrarSalidaResponse {
  visita: Visita;
  constancia: ConstanciaExcesoTiempo | null;
}

export interface ConsultaPatenteResponse {
  patente: string;
  gls_tipotenencia: string;
  numero_unidad: string;
  nombre_torre: string;
}

export interface LoginResponse {
  token: string;
  guardia: {
    id_usuario: number;
    nombre_usuario: string;
    condominio_id_condominio?: number;
    // Solo presentes cuando rol = 'Residente'.
    unidad_id_unidad?: number;
    numero_unidad?: string;
    nombre_torre?: string;
    // Solo puede venir en true cuando rol = 'Residente': miembro del
    // comité de administración (mismos permisos que Administrador).
    esComite?: boolean;
  };
  rol: "Guardia" | "Administrador" | "Residente" | "Personal" | "JefeGuardias" | "SuperAdmin" | string;
  // Ronda 26: nombre del condominio con el que quedó esta sesión (ver
  // guardia.condominio_id_condominio) — para mostrarlo en el menú en vez
  // de un nombre fijo.
  condominio_nombre?: string;
}

// Ronda 27, a pedido explícito del usuario: cuando TODOS los condominios
// de esta cuenta tienen la mensualidad pendiente, POST /auth/login
// devuelve esto en vez de LoginResponse — no es un error de login (la
// cuenta y contraseña son correctas), simplemente ningún condominio está
// disponible ahora mismo. Ver PagoPendienteScreen.
export interface PagoPendienteResponse {
  pagoPendiente: true;
  rol: string;
}

// Ronda 37, a pedido explícito del usuario: cuando el administrador le
// activó el acceso a un residente (usuario/clave temporales generados
// automáticamente), la PRIMERA vez que ese residente hace login,
// POST /auth/login devuelve esto en vez de LoginResponse — la app tiene
// que obligarlo a elegir su usuario definitivo (único) y su clave propia
// ANTES de dejarlo ver cualquier otra cosa. Ver OnboardingResidenteScreen.
export interface RequiereOnboardingResponse {
  requiereOnboarding: true;
  token: string; // token intermedio: solo sirve para POST /auth/completar-onboarding
}

// Ronda 26 (fase 2): ya no es exclusivo de Administrador — cualquier rol
// puede tener más de un condominio con la MISMA cuenta.
export interface RequiereSeleccionCondominioResponse {
  requiereSeleccionCondominio: true;
  token: string; // token intermedio: solo sirve para POST /auth/seleccionar-condominio
  condominios: CondominioOpcion[];
}

export interface CondominioOpcion {
  id_condominio: number;
  nombre: string;
  // Ronda 26 (fase 2): el rol puede ser distinto entre dos condominios de
  // la misma persona (ej. Residente en uno, Guardia en otro) — se muestra
  // junto al nombre en el selector para que quede claro con cuál entra.
  rol?: string;
}

export interface CrearCondominioTorreInput {
  nombre_torre: string;
  cantidad_pisos?: number;
  numeros_unidad: string[];
}

export interface CrearCondominioEdificioInput {
  cantidad_pisos?: number;
  numeros_unidad: string[];
}

// Ronda 26 (fase 2, a pedido del usuario): 3 formas de estructura —
// "torres" (varias con nombre propio, ej. su condominio de Talca),
// "edificio" (un solo edificio, solo pisos y deptos por piso, sin nombres
// de torre, ej. su edificio de Santiago), y "casas" (condominio cerrado de
// casas, sin pisos ni torres).
export type EstructuraCondominio = "torres" | "edificio" | "casas";

export interface CrearCondominioInput {
  nombre_condominio: string;
  estructura: EstructuraCondominio;
  torres?: CrearCondominioTorreInput[]; // solo si estructura = "torres"
  edificio?: CrearCondominioEdificioInput; // solo si estructura = "edificio"
  numeros_unidad_casas?: string[]; // solo si estructura = "casas"
}

export interface CrearCondominioResponse {
  id_condominio: number;
  nombre: string;
  torres_creadas: number;
  unidades_creadas: number;
}

// --- Administrador -----------------------------------------------------

export interface Guardia {
  id_usuario: number;
  nombre_usuario: string;
  usuariocol: string;
  flg_vigencia: number;
  // Ronda 53, a pedido explícito del usuario, con referencia visual.
  rut?: string | null;
  telefono?: string | null;
}

export interface ResidenteAdmin {
  id_usuario: number;
  nombre_usuario: string;
  unidad_id_unidad: number;
  numero_unidad: string;
  nombre_torre: string;
  flg_vigencia: number;
  id_residentediscapacitado: number | null;
  numero_carnet: string | null;
  // Usuario de acceso a la app (portal de residentes). null = todavía no
  // se le activó el acceso.
  usuariocol: string | null;
  // 1 = miembro del comité de administración: mismos permisos que
  // Administrador en toda la app.
  flg_comite: number;
  // A qué título vive en el depto (ronda 14) — null en residentes de
  // prueba que todavía no se reemplazaron por datos reales.
  tipo_residente_id_tiporesidente: number | null;
  gls_tiporesidente: string | null;
  // 1 = es el dueño registrado de la unidad (ronda 15), viva ahí o no —
  // ver /mi-depto/* y MiHogarScreen. A lo más un residente por unidad
  // debería tener este flag en 1.
  flg_propietario: number;
  // Ronda 36, a pedido explícito del usuario: datos adicionales opcionales
  // — no todo residente los va a tener cargados.
  rut: string | null;
  fecha_nacimiento: string | null; // 'YYYY-MM-DD'
  profesion: string | null;
  // Ronda 37: SOLO viene presente en la respuesta de
  // adminActivarAccesoResidente — la clave temporal recién generada, para
  // que el administrador se la comunique al residente. No se puede volver
  // a consultar después (queda guardada hasheada).
  password_temporal?: string;
}

export interface TipoResidente {
  id_tiporesidente: number;
  gls_tiporesidente: string;
}

export interface PatenteAdmin {
  id_patente: number;
  patente: string;
  gls_tipotenencia: string;
  unidad_id_unidad: number;
  numero_unidad: string;
  nombre_torre: string;
  flg_vigencia: number;
}

export interface AuditoriaPatenteItem {
  id_visita: number;
  fecha_entrada: string;
  hora_entrada: string;
  fecha_salida: string | null;
  hora_salida: string | null;
  nombre_visita: string;
  tipo_ocupante: string;
  nombre_torre: string;
  numero_unidad: string;
  gls_tipopermiso: string;
  numero_estacionamiento: string | null;
  nombre_guardia_creador: string;
  usuariocol_guardia_creador: string;
}

// --- Reporte de gasto común ---------------------------------------------

export interface ReporteGastoComunDetalleItem {
  id_constancia: number;
  concepto: string;
  minutos_extras: number | null;
  monto_cobrar: number;
  fecha_movimiento: string;
  id_visita: number;
  fecha_entrada: string;
  hora_entrada: string;
  fecha_salida: string | null;
  hora_salida: string | null;
  nombre_visita: string;
  patente: string | null;
  unidad_id_unidad: number;
  numero_unidad: string;
  nombre_torre: string;
}

export interface ReporteGastoComunResumenDepto {
  unidad_id_unidad: number;
  numero_unidad: string;
  nombre_torre: string;
  cantidad_cobros: number;
  total_cobrar: number;
}

// Cobros por exceso de horario en Reservas de Espacios Comunes (ronda 14) —
// se muestran junto a los de estacionamientos en el mismo reporte, pero
// llegan en un arreglo aparte porque las columnas no son las mismas.
export interface ReporteGastoComunReservaItem {
  id_reserva: number;
  nombre_espacio: string;
  fecha_reserva: string;
  hora_termino: string;
  minutos_exceso: number;
  monto_cobrar: number;
  fecha_movimiento: string;
  unidad_id_unidad: number;
  numero_unidad: string;
  nombre_torre: string;
}

export interface ReporteGastoComunResponse {
  detalle: ReporteGastoComunDetalleItem[];
  detalleReservas: ReporteGastoComunReservaItem[];
  resumenPorDepto: ReporteGastoComunResumenDepto[];
  totalGeneral: number;
}

// --- Paquetería ----------------------------------------------------------

export interface TipoPaquete {
  id_tipopaquete: number;
  gls_tipopaquete: string;
}

export type EstadoPaqueteGls =
  | "Recepcionado"
  | "Notificado"
  | "En portería"
  | "Entregado a residente"
  | "Rechazado por el residente"
  | "Devuelto al remitente"
  | "Perdido";

export interface Paquete {
  id_paquete: number;
  fecha_recepcion: string;
  hora_recepcion: string;
  nombre_receptor: string;
  residente_receptor_usuario_id: number | null;
  receptor_coincide: number;
  rut_receptor: string | null;
  foto_recepcion_url: string;
  observaciones: string | null;
  fecha_entrega: string | null;
  hora_entrega: string | null;
  entregado_a: string | null;
  foto_retiro_url: string | null;
  firma_retiro_url: string | null;
  tipo_paquete_id_tipopaquete: number;
  estado_paquete_id_estadopaquete: number;
  unidad_id_unidad: number;
  condominio_id_condominio: number;
  usuario_id_usuario_creador: number;
  usuario_id_usuario_entrega: number | null;
  gls_tipopaquete: string;
  gls_estadopaquete: EstadoPaqueteGls;
  numero_unidad: string;
  nombre_torre: string;
  nombre_guardia_creador: string;
  nombre_guardia_entrega: string | null;
}

export interface PaquetePendiente extends Paquete {
  diasPendiente: number;
  alerta7dias: boolean;
}

export interface RegistrarLlegadaPaquetePayload {
  unidad_id_unidad: number;
  nombre_receptor: string;
  residente_receptor_usuario_id?: number;
  rut_receptor?: string;
  tipo_paquete_id_tipopaquete?: number;
  foto_recepcion: string;
  condominio_id_condominio: number;
}

export interface RegistrarLlegadaPaqueteResponse {
  paquete: Paquete;
  receptorCoincide: boolean;
}

export interface RegistrarEntregaPaquetePayload {
  entregado_a: string;
  firma_retiro: string;
  foto_retiro?: string;
  condominio_id_condominio: number;
}

export interface BuscarPaquetesFiltro {
  fecha_inicio?: string;
  fecha_termino?: string;
  q?: string;
  unidad_id?: number;
  estado?: EstadoPaqueteGls;
  condominio_id: number;
}

// --- Reservas de Espacios Comunes (ronda 14) ------------------------------

export interface TipoEspacioComun {
  id_tipoespaciocomun: number;
  gls_tipoespaciocomun: string;
}

export interface EspacioComun {
  id_espaciocomun: number;
  nombre: string;
  tipo_espaciocomun_id_tipoespaciocomun: number;
  gls_tipoespaciocomun: string;
  condominio_id_condominio: number;
  capacidad: number | null;
  flg_reservable: number;
  flg_gratuito: number;
  precio_bloque: number;
  bloque_horas: string; // DECIMAL de MySQL vuelve como string, ej "3.0"
  monto_garantia: number;
  tarifa_atraso_minuto: number;
  hora_apertura: string; // "HH:MM:SS"
  hora_cierre: string;
  dias_disponibles: string | null; // "1,2,3,4,5,6,7" o null = todos los días
  minutos_separacion: number;
  dias_max_anticipacion: number;
  dias_min_cancelacion_residente: number;
  mes_dia_inicio_temporada: string | null; // "MM-DD"
  mes_dia_termino_temporada: string | null;
  flg_vigencia: number;
}

export type EspacioComunInput = Partial<
  Omit<EspacioComun, "id_espaciocomun" | "gls_tipoespaciocomun" | "condominio_id_condominio">
> & {
  nombre: string;
  tipo_espaciocomun_id_tipoespaciocomun: number;
};

export type EstadoReservaGls =
  | "Pendiente"
  | "Aprobado"
  | "Rechazado"
  | "Reservado"
  | "En uso"
  | "Finalizado"
  | "Cancelado"
  | "Expirado";

export interface Reserva {
  id_reserva: number;
  espacio_comun_id_espaciocomun: number;
  unidad_id_unidad: number;
  condominio_id_condominio: number;
  solicitante_usuario_id: number;
  creado_por_usuario_id: number;
  fecha_reserva: string; // "YYYY-MM-DD"
  hora_inicio: string; // "HH:MM:SS"
  hora_termino: string;
  estado_reserespaciocomun_id_estadoreserva: number;
  gls_estadoreserva: EstadoReservaGls;
  monto_tarifa: number;
  monto_garantia: number;
  comprobante_pago_url: string | null;
  fecha_pago_validado: string | null;
  usuario_id_valido_pago: number | null;
  fecha_aprobacion: string | null;
  usuario_id_aprobo: number | null;
  motivo_rechazo: string | null;
  fecha_cancelacion: string | null;
  usuario_id_cancelo: number | null;
  fecha_hora_llegada: string | null;
  fecha_hora_salida: string | null;
  minutos_exceso: number;
  monto_cobro_exceso: number;
  estado_garantia: "Pendiente" | "Devuelta" | "Retenida";
  monto_garantia_retenido: number;
  observacion_garantia: string | null;
  fecha_creacion: string;
  nombre_espacio: string;
  flg_gratuito: number;
  gls_tipoespaciocomun: string;
  numero_unidad: string;
  nombre_torre: string;
  nombre_solicitante: string;
  nombre_creador: string;
}

export interface HorarioOcupado {
  hora_inicio: string;
  hora_termino: string;
  gls_estadoreserva: EstadoReservaGls;
}

export interface CrearReservaPayload {
  espacio_comun_id_espaciocomun: number;
  fecha: string;
  hora_inicio: string;
  hora_termino: string;
  // Solo cuando reserva Administrador/Comité a nombre de un residente.
  unidad_id_unidad?: number;
  solicitante_usuario_id?: number;
}

export interface ListarReservasFiltro {
  condominio_id: number;
  estado?: EstadoReservaGls;
  espacio_id?: number;
  fecha_inicio?: string;
  fecha_termino?: string;
}

// --- Notificaciones (ronda 16) ---------------------------------------------

export type TipoNotificacionGls =
  | "Paquete recibido"
  | "Paquete en portería"
  | "Alerta paquete sin retirar"
  | "Visita registrada"
  | "Comunicado"
  | "Tarea asignada"
  | "Mantención programada"
  | "Mantención en curso";

export interface Notificacion {
  id_notificacionusuario: number;
  flg_leido: number;
  fecha_leido: string | null;
  flg_push_enviado: number;
  id_notificacion: number;
  titulo: string;
  cuerpo: string;
  referencia_tipo: "paquete" | "visita" | "tarea_personal" | "mantencion" | null;
  referencia_id: number | null;
  fecha_creacion: string;
  gls_tiponotificacion: TipoNotificacionGls;
}

export interface CrearComunicadoResponse {
  id_notificacion: number | null;
  destinatarios: number;
}

// Gasto común por depto (ronda 17) — flg_gastocomun ya existía desde la
// ronda 14 sobre `unidad` (bloquea reservar espacios comunes reservables si
// está en 0), esta es la primera vez que se expone para administrarlo.
export interface UnidadGastoComun {
  id_unidad: number;
  numero_unidad: string;
  nombre_torre: string;
  flg_gastocomun: number;
}

// --- Personal externo (ronda 18): aseo, jardinería, mantención, etc. ------

export interface TipoPersonal {
  id_tipopersonal: number;
  gls_tipopersonal: string;
}

export interface PersonalAdmin {
  id_usuario: number;
  nombre_usuario: string;
  usuariocol: string | null;
  flg_vigencia: number;
  tipo_personal_id_tipopersonal: number | null;
  gls_tipopersonal: string | null;
  // true si tiene un turno abierto ahora mismo (marcó "Empezar turno" y
  // todavía no marcó salida) — para que el administrador vea de un vistazo
  // quién está en el condominio en este momento.
  turno_abierto: number | boolean;
}

export interface TareaPersonal {
  id_tareapersonal: number;
  descripcion: string;
  estado: "Pendiente" | "Completada";
  fecha_creacion: string;
  fecha_completada: string | null;
  // Solo presentes en el historial que ve Administrador/Comité (no en "mis
  // tareas" del propio trabajador, que ya sabe quién es).
  usuario_id_usuario?: number;
  nombre_personal?: string;
  creado_por_nombre?: string;
}

export interface TurnoPersonal {
  id_turnopersonal: number;
  fecha_inicio: string;
  fecha_termino: string | null;
}

// --- Mantenciones (ronda 19): limpieza de techo, piscina, ascensores, etc. -
// Trabajo de una empresa/contratista EXTERNA sin cuenta en el sistema (a
// diferencia de Personal, ronda 18, que sí tiene login). Solo
// Administrador/Comité programa; el guardia elige de la lista cuál
// mantención programada está llegando a realizar y anota empresa/persona/
// RUT — nunca registra una "suelta".

export interface TipoElementoMantencion {
  id_tipoelementomantencion: number;
  gls_tipoelementomantencion: string;
  flg_vigencia: number;
}

export type EstadoMantencionGls = "Programada" | "En curso" | "Realizada" | "Cancelada";

export interface Mantencion {
  id_mantencion: number;
  titulo: string;
  descripcion: string;
  tipo_elemento_mantencion_id_tipoelementomantencion: number;
  gls_tipoelementomantencion: string;
  condominio_id_condominio: number;
  fecha_programada: string; // "YYYY-MM-DD"
  estado_mantencion_id_estadomantencion: number;
  gls_estadomantencion: EstadoMantencionGls;
  costo_estimado: number | null;
  costo_real: number | null;
  comprobante_url: string | null;
  foto_resultado_url: string | null;
  empresa_nombre: string | null;
  persona_nombre: string | null;
  persona_rut: string | null;
  fecha_hora_llegada: string | null;
  fecha_hora_salida: string | null;
  usuario_id_guardia_llegada: number | null;
  nombre_guardia_llegada: string | null;
  usuario_id_guardia_salida: number | null;
  nombre_guardia_salida: string | null;
  motivo_cancelacion: string | null;
  fecha_cancelacion: string | null;
  usuario_id_cancelo: number | null;
  nombre_cancelo: string | null;
  creado_por_usuario_id: number;
  nombre_creador: string;
  fecha_creacion: string;
}

export interface CrearMantencionPayload {
  titulo: string;
  descripcion: string;
  tipo_elemento_mantencion_id_tipoelementomantencion: number;
  fecha_programada: string;
  costo_estimado?: number | null;
  condominio_id_condominio: number;
}

export interface ListarMantencionesFiltro {
  condominio_id: number;
  estado?: EstadoMantencionGls;
  tipo_elemento_id?: number;
  fecha_inicio?: string;
  fecha_termino?: string;
}

export interface RegistrarIngresoMantencionPayload {
  empresa_nombre: string;
  persona_nombre: string;
  persona_rut?: string;
}

// --- Ronda 20: Estacionamientos para arriendo entre residentes -------------
// "Pizarrón" informativo: el guardia solo consulta (para avisarle al vecino
// interesado), cada residente cambia el estado de SU PROPIO cupo (o
// Administrador/Comité, el de cualquiera). Sin flujo de solicitud/
// aprobación dentro de la app.

export interface CupoArriendo {
  id_estacionamiento: number;
  numero_estacionamiento: string;
  precio_arriendo: number | null;
  unidad_id_unidad: number | null;
  gls_estadoestacionamiento: string; // "Ocupado" | "Disponible para arriendo" (uso normal de este cupo)
  numero_unidad: string | null;
  nombre_torre: string | null;
}

// --- Ronda 20: VETADOS -------------------------------------------------------
// Personas con prohibición de ingreso (ej. orden de alejamiento). Solo
// Administrador/Comité administra la lista completa; el guardia solo puede
// buscar por RUT (ConsultaVetadoScreen).

export interface Vetado {
  id_vetado: number;
  nombre_completo: string;
  rut: string;
  patente: string | null;
  parentesco: string | null;
  fecha_ingreso: string; // "YYYY-MM-DD"
  foto_persona_url: string | null;
  foto_vehiculo_url: string | null;
  observaciones: string | null;
  flg_vigencia: number;
  // Ronda 52, a pedido explícito del usuario: a qué depto corresponde,
  // si se cargó uno — null si no está asociado a ninguno en particular.
  unidad_id_unidad: number | null;
  numero_unidad: string | null;
  nombre_torre: string | null;
}

export interface AlertaVetado {
  id_vetado: number;
  nombre_completo: string;
  rut: string;
  patente: string | null;
  parentesco: string | null;
  numero_unidad: string | null;
  nombre_torre: string | null;
}

export interface CrearVetadoPayload {
  nombre_completo: string;
  rut: string;
  patente?: string;
  parentesco?: string;
  fecha_ingreso: string;
  foto_persona?: string; // data URL base64
  foto_vehiculo?: string; // data URL base64
  observaciones?: string;
  condominio_id_condominio: number;
  unidad_id_unidad?: number;
}

// --- Ronda 20: Bitácora de guardias -----------------------------------------
// Libro de novedades del turno — compartido entre todos los guardias
// (escriben), Administrador/Comité solo puede leerlo (supervisión).

export interface EntradaBitacora {
  id_bitacora: number;
  texto: string;
  fecha_hora: string; // "YYYY-MM-DD HH:MM:SS"
  nombre_guardia: string;
}

// --- Ronda 20: JEFE_GUARDIAS + turnos ---------------------------------------
// Rol nuevo, con acceso SOLO al calendario semanal de turnos (bloques fijos
// por día) y a un CRUD de guardias. El calendario restringe el login del
// Guardia (ver auth.service.ts) — sin turnos cargados nunca se bloquea.

export interface TurnoBloque {
  id_turnobloque: number;
  gls_turnobloque: string; // "Mañana" | "Tarde" | "Noche" | cualquier nombre editable
  hora_inicio: string; // "HH:MM:SS"
  hora_termino: string;
}

export interface TurnoAsignado {
  id_turnoasignado: number;
  fecha: string; // "YYYY-MM-DD"
  guardia_usuario_id: number;
  nombre_guardia: string;
  rol_guardia?: "Guardia" | "JefeGuardias";
  id_turnobloque: number;
  gls_turnobloque: string;
  hora_inicio: string;
  hora_termino: string;
}

// Ronda 39: personal asignable a un turno — Guardia + JefeGuardias (antes
// solo se podía elegir un Guardia).
export interface PersonalTurno {
  id_usuario: number;
  nombre_usuario: string;
  rol: "Guardia" | "JefeGuardias";
}

export interface DuplaPatronInput {
  guardia_dia_id: number;
  guardia_noche_id: number;
}

export interface ResultadoGenerarPatron {
  dias_generados: number;
  asignaciones_creadas: number;
}

// --- Ronda 20: Mascotas ------------------------------------------------------
// Cada unidad puede tener cero, una o varias — autoservicio de cualquier
// residente activo de esa unidad, o Administrador/Comité (acceso total).

export interface Mascota {
  id_mascota: number;
  nombre: string;
  especie: string | null;
  raza: string | null;
  numero_chip: string | null;
  foto_url: string | null;
  unidad_id_unidad: number;
  flg_vigencia: number;
  // Solo presentes en la vista de Administrador/Comité (todas las mascotas
  // del condominio) — el residente ya sabe cuál es su depto.
  numero_unidad?: string;
  nombre_torre?: string;
}

// Ronda 50, a pedido explícito del usuario, con referencia visual.
export interface VacunaMascota {
  id_mascotavacuna: number;
  nombre_vacuna: string;
  descripcion: string | null;
  fecha_aplicacion: string; // 'YYYY-MM-DD'
  fecha_vencimiento: string | null;
  vigente: boolean;
}

// --- Ronda 28: administración de estacionamientos ---------------------------

export interface EstacionamientoAdmin {
  id_estacionamiento: number;
  numero_estacionamiento: string;
  ubicacion: string | null;
  tipo_id: number;
  tipo: string; // 'Visita' | 'Residente' | 'Discapacitado'
  estado_id: number;
  estado: string; // 'Disponible' | 'Ocupado' | 'Fuera de servicio' | 'Disponible para arriendo'
  // Ronda 29: null = sin depto asignado — a propósito, no todos los deptos
  // tienen estacionamiento propio (varios quedan sin vender); el comité
  // puede arrendarlo después. Solo aplica de verdad a tipo 'Residente'.
  unidad_id_unidad: number | null;
  numero_unidad: string | null;
  nombre_torre: string | null;
  // Ronda 30, a pedido explícito del usuario: control formal que lleva el
  // comité — a qué patente pertenece, si está arrendado, y si quien lo
  // ocupa es el propietario del cupo o un arrendatario. Solo se cargan de
  // verdad para tipo 'Residente'.
  patente: string | null;
  flg_arrendado: number;
  tipo_ocupante: "Propietario" | "Arrendatario" | null;
}

export interface TipoEstacionamiento {
  id_tipoestacionamiento: number;
  gls_tipoestacionamiento: string;
}

export interface EstadoEstacionamiento {
  id_estadoestacionamiento: number;
  gls_estadoestacionamiento: string;
}


// --- Ronda 27: SuperAdmin — crear Administradores + facturación -------------

export interface CondominioSimple {
  id_condominio: number;
  nombre: string;
}

export interface AdministradorCuenta {
  id_usuario: number;
  nombre_usuario: string;
  usuariocol: string;
  flg_vigencia: number;
  condominio_home: string;
}

export interface CrearAdministradorInput {
  nombre_usuario: string;
  usuariocol: string;
  password: string;
  condominio_id_condominio: number;
}

export interface CondominioConFacturacion {
  id_condominio: number;
  nombre: string;
  monto_mensualidad: number | null;
  dia_limite_pago: number;
  bloqueado: boolean;
  periodo_actual: string;
  pagado_periodo_actual: boolean;
}

// --- Ronda 32: derechos ARCO (Ley 21.719 de Protección de Datos) -----------

export interface MisDatos {
  generado_el: string;
  identidad: {
    nombre_usuario: string;
    usuariocol: string | null;
    correo_usuario: string | null;
    rol: string;
    condominio_id_condominio: number | null;
  };
  vivienda: { torre: string | null; numero_unidad: string | null; es_comite: boolean; es_propietario: boolean } | null;
  mascotas: { nombre: string; especie: string | null; raza: string | null; numero_chip: string | null }[];
  patentes: { patente: string; gls_tipotenencia: string }[];
  reservas: {
    fecha_reserva: string;
    hora_inicio: string;
    hora_termino: string;
    gls_espaciocomun: string;
    gls_estadoreserva: string;
  }[];
  paquetes: { fecha_recepcion: string; nombre_receptor: string; gls_tipopaquete: string; gls_estadopaquete: string }[];
}

export type TipoSolicitudArco = "Rectificacion" | "Cancelacion" | "Oposicion";

export interface SolicitudArco {
  id_solicitudarco: number;
  tipo: TipoSolicitudArco;
  detalle: string;
  estado: "Pendiente" | "Resuelta" | "Rechazada";
  respuesta_admin: string | null;
  fecha_solicitud: string;
  fecha_resolucion: string | null;
}

export interface SolicitudArcoAdmin extends SolicitudArco {
  nombre_solicitante: string;
  usuariocol_solicitante: string | null;
  numero_unidad: string | null;
  nombre_torre: string | null;
}

// --- Ronda 33: log de auditoría (Ley 21.719) --------------------------------

export interface LogAuditoria {
  id_logauditoria: number;
  accion: string;
  ruta: string;
  status_code: number | null;
  detalle: string | null;
  fecha: string;
  rol: string | null;
  nombre_usuario: string | null;
  usuariocol: string | null;
}

// --- Ronda 34: retención de datos (Ley 21.719) ------------------------------

export type CategoriaRetencion = "Visitas" | "Bitacora" | "LogAuditoria";

export interface PoliticaRetencionItem {
  categoria: CategoriaRetencion;
  nombre: string;
  dias_retencion: number | null;
}

export interface ResultadoLimpieza {
  categoria: CategoriaRetencion;
  nombre: string;
  dias_retencion: number;
  filas_eliminadas: number;
}

// --- Ronda 34: notificación de brechas de seguridad (Ley 21.719) -----------

export interface IncidenteSeguridad {
  id_incidenteseguridad: number;
  condominio_id_condominio: number;
  fecha_deteccion: string;
  descripcion: string;
  datos_afectados: string;
  personas_afectadas_estimado: number | null;
  acciones_tomadas: string | null;
  notificado_agencia_fecha: string | null;
  notificado_afectados_fecha: string | null;
  estado: "Abierto" | "Cerrado";
  creado_por_usuario_id: number;
  fecha_creacion: string;
  plazo_vencimiento: string;
  horas_restantes: number;
  plazo_vencido: boolean;
}

export interface CrearIncidenteInput {
  fecha_deteccion: string;
  descripcion: string;
  datos_afectados: string;
  personas_afectadas_estimado?: number | null;
  acciones_tomadas?: string | null;
}

// --- Ronda 40: "quién viene hoy" (personal externo + mantenciones) --------

export interface PersonalEnTurnoHoy {
  id_turnopersonal: number;
  fecha_inicio: string;
  fecha_termino: string | null;
  id_usuario: number;
  nombre_usuario: string;
  gls_tipopersonal: string | null;
}

export interface QuienVieneHoy {
  personal_externo: PersonalEnTurnoHoy[];
  mantenciones: Mantencion[];
}

// --- Ronda 41: Amonestaciones y Multas --------------------------------------

export interface TipoAmonestacion {
  id_tipoamonestacion: number;
  gls_tipoamonestacion: string;
  flg_es_multa: number;
  flg_vigencia: number;
}

export interface TipoMulta {
  id_tipomulta: number;
  gls_tipomulta: string;
  monto_sugerido: number | null;
  unidad_monto: string; // 'UF' | 'UTM'
  flg_vigencia: number;
}

export type EstadoAmonestacionGls = "Enviada" | "Pendiente de aprobación" | "Aprobada" | "Rechazada" | "Notificada";

export interface Amonestacion {
  id_amonestacion: number;
  condominio_id_condominio: number;
  unidad_id_unidad: number;
  numero_unidad: string;
  nombre_torre: string;
  tipo_amonestacion_id_tipoamonestacion: number;
  gls_tipoamonestacion: string;
  flg_es_multa: number;
  descripcion: string;
  fecha_hecho: string; // 'YYYY-MM-DD'
  tipo_multa_id_tipomulta: number | null;
  gls_tipomulta: string | null;
  monto: string | null;
  unidad_monto: string | null;
  estado: EstadoAmonestacionGls;
  aprobado_por_usuario_id: number | null;
  nombre_aprobador: string | null;
  fecha_aprobacion: string | null;
  motivo_rechazo: string | null;
  notificado_por_usuario_id: number | null;
  nombre_notificador: string | null;
  fecha_notificacion: string | null;
  creado_por_usuario_id: number;
  nombre_creador: string;
  fecha_creacion: string;
}

export interface CrearAmonestacionInput {
  unidad_id_unidad: number;
  tipo_amonestacion_id_tipoamonestacion: number;
  descripcion: string;
  fecha_hecho: string;
  tipo_multa_id_tipomulta?: number;
  monto?: number;
  unidad_monto?: string;
}

// --- Ronda 45: monitoreo de actividad sospechosa (exclusivo SuperAdmin) --

export type TipoEventoSeguridad = "rate_limit_login" | "rate_limit_recuperacion" | "login_fallido";

export interface EventoSeguridad {
  id_eventoseguridad: number;
  tipo: TipoEventoSeguridad;
  ip: string | null;
  usuariocol_intentado: string | null;
  detalle: string | null;
  fecha: string;
}

export interface ResumenEventoSeguridad {
  tipo: TipoEventoSeguridad;
  ultimas_24h: number;
  ultimos_7dias: number;
}

// --- Ronda 47: dashboard del Home de Administrador -------------------------

export interface DashboardAdmin {
  condominio: {
    nombre: string;
    total_deptos: number;
    residentes_activos: number;
    espacios_comunes: number;
    guardias_activos: number;
  };
  gasto_comun: {
    deptos_pagados: number;
    deptos_total: number;
    porcentaje_pagado: number;
  };
  estacionamientos: {
    total_cupos: number;
    visitas_dentro: number;
  };
  solicitudes: {
    abiertas: number;
    urgentes: number;
  };
  seguridad: {
    incidentes_abiertos: number;
    ultimo_evento: string | null;
  };
}

export interface ActividadRecienteItem {
  id_bitacora: number;
  texto: string;
  fecha_hora: string;
  nombre_usuario: string;
}

// --- Ronda 53: dashboard del Home de JefeGuardias --------------------------

export interface ResumenTurnoGuardia {
  guardia_usuario_id: number;
  id_turnobloque: number;
  gls_turnobloque: string;
  hora_inicio: string;
  hora_termino: string;
  cantidad: number;
}
