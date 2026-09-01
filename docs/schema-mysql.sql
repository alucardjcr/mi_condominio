-- ============================================================================
-- DDL consolidado para MySQL/MariaDB — TODO lo construido hasta hoy de
-- "Mi Condominio" (estacionamientos + visitas + paquetería + login de
-- residentes + rol de comité + tipos de residente + reservas de espacios
-- comunes + dueños de depto administrando su propio hogar + notificaciones
-- push de paquetes/visitas/comunicados + gasto común por depto + personal
-- externo con turno y tareas, ronda 18). Reemplaza a los dos archivos que existían
-- por separado (schema-estacionamientos-visita.sql y schema-paqueteria.sql,
-- que quedan solo como referencia histórica) — desde la migración a MySQL
-- (ronda 13) este es el único archivo que hay que mantener al día.
--
-- Se usa tal cual para:
--   - Levantar una base MySQL/MariaDB local de desarrollo (ver
--     backend/README o el README raíz del proyecto).
--   - Como base para el hosting real cuando se contrate (Railway u otro).
--
-- Convenciones:
--   - utf8mb4 / utf8mb4_unicode_ci en toda la base (soporta tildes, ñ,
--     emojis en notificaciones futuras) — corrige el latin1 del ERD
--     original, que estaba anotado como pendiente técnico.
--   - Todas las tablas InnoDB (soporte de FKs y transacciones).
--   - Se agregaron índices sobre condominio_id_condominio en las tablas de
--     mayor volumen esperado (visita, paquete, usuario) — con cientos de
--     condominios compartiendo las mismas tablas, son críticos para el
--     rendimiento (pendiente técnico que también estaba anotado).
--   - `flg_comite` en `usuario` (ronda 12): comité de administración = un
--     Residente con este flag en 1, no un tipo_usuario nuevo.
--   - IMPORTANTE — fechas como VARCHAR, no DATE/DATETIME: todo el código
--     de servicios (estacionamientoVisita.service.ts, paquetes.service.ts,
--     reportes.service.ts) guarda y compara fechas como strings ISO 8601
--     completos (`new Date().toISOString()`, ej. "2026-08-28T14:30:00.000Z"),
--     tanto en las columnas "fecha_*" como en las "hora_*" (mismo valor en
--     ambas), y filtra rangos con comparación lexicográfica de texto
--     (`fecha_x >= ? AND fecha_x <= ?`), que funciona igual en MySQL que en
--     SQLite siempre que el formato sea ISO 8601 consistente. Migrar estas
--     columnas a DATE/DATETIME reales de MySQL requeriría reescribir ese
--     código (separar fecha/hora, reformatear al insertar, ajustar
--     comparaciones) — fuera del alcance de "migrar a MySQL", que es mover
--     el motor sin tocar la lógica de negocio ya probada. Por eso estas
--     columnas quedaron como VARCHAR(35) aquí, igual que en el schema.sql
--     de SQLite que reemplazan. El módulo de Reservas de Espacios Comunes
--     (próximo a construirse) sí va a necesitar aritmética de fechas/horas
--     real en SQL (traslapes de horario, rangos de temporada, anticipación
--     en días) — ahí conviene usar DATE/TIME/DATETIME de verdad desde el
--     diseño, en vez de heredar este patrón.
-- ============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS condominio (
  id_condominio   INT AUTO_INCREMENT PRIMARY KEY,
  gls_condominio  VARCHAR(150) NOT NULL,
  flg_vigencia    TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS torre_block (
  id_torreblock    INT AUTO_INCREMENT PRIMARY KEY,
  nombre_torre     VARCHAR(45) NOT NULL,
  cantidad_pisos   INT,
  ubicacion        VARCHAR(100),
  condominio_id_condominio INT NOT NULL,
  flg_vigencia     TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_torreblock_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS unidad (
  id_unidad                  INT AUTO_INCREMENT PRIMARY KEY,
  numero_unidad               VARCHAR(45) NOT NULL,
  piso                         INT,
  condominio_id_condominio    INT NOT NULL,
  torre_block_id_torreblock   INT NOT NULL,
  flg_vigencia                 TINYINT NOT NULL DEFAULT 1,
  -- 1 = gasto común al día, 0 = con deuda (ronda 14, Reservas de Espacios
  -- Comunes: solo una unidad al día puede reservar un espacio común
  -- reservable — ver reserva_espaciocomun más abajo). Ya venía en el ERD
  -- completo real, se incorpora recién ahora porque es la primera regla de
  -- negocio que lo necesita.
  flg_gastocomun                TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_unidad_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_unidad_torreblock FOREIGN KEY (torre_block_id_torreblock)
    REFERENCES torre_block (id_torreblock),
  INDEX idx_unidad_condominio (condominio_id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Usuarios: guardias y administradores (login), y residentes (precargados
-- por depto, con acceso opcional a la app — ver login de residentes,
-- ronda 11 — y `flg_comite`, ronda 12).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tipo_usuario (
  id_tipousuario  INT AUTO_INCREMENT PRIMARY KEY,
  gls_tipousuario VARCHAR(50) NOT NULL, -- 'Guardia', 'Residente', 'Administrador', 'Personal' (ronda 18), 'JefeGuardias' (ronda 20)
  flg_vigencia    TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relación de cada residente con el depto en el que vive (ronda 14, a
-- pedido del usuario: "quiero que agregues los tipos de residente que
-- tenemos" — pensado para que el administrador pueda informar a la PDI, si
-- lo piden, quién vive en un depto y a qué título). Puede haber varios
-- residentes con el mismo tipo en un mismo depto (ej. dos roomies), o
-- distintos tipos conviviendo (propietario + pareja + roomies).
CREATE TABLE IF NOT EXISTS tipo_residente (
  id_tiporesidente   INT AUTO_INCREMENT PRIMARY KEY,
  gls_tiporesidente  VARCHAR(50) NOT NULL, -- Propietario, Arrendatario, Pareja del propietario, Roomie, Familiar, Otro
  flg_vigencia       TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Especialidad de un usuario tipo 'Personal' (ronda 18: personal externo del
-- condominio — aseo, jardinería, mantención, etc.). Igual que
-- tipo_residente, es un catálogo por condominio, no un enum fijo, para que
-- el administrador pueda agregar especialidades propias más adelante si
-- hace falta (hoy no hay pantalla para eso, ver "Supuestos").
CREATE TABLE IF NOT EXISTS tipo_personal (
  id_tipopersonal   INT AUTO_INCREMENT PRIMARY KEY,
  gls_tipopersonal  VARCHAR(50) NOT NULL, -- Aseo, Jardinería, Mantención, Conserjería externa, Otro
  condominio_id_condominio INT NOT NULL,
  flg_vigencia      TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_tipopersonal_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario         INT AUTO_INCREMENT PRIMARY KEY,
  nombre_usuario      VARCHAR(100) NOT NULL,
  correo_usuario      VARCHAR(255),
  password_usuario    VARCHAR(100), -- hash bcrypt; NULL si todavía no se activó el acceso
  usuariocol          VARCHAR(45) UNIQUE,
  tipo_usuario_id_tipousuario INT NOT NULL,
  unidad_id_unidad    INT NULL, -- depto del residente, si aplica
  condominio_id_condominio INT NOT NULL,
  flg_vigencia        TINYINT NOT NULL DEFAULT 1,
  -- Solo aplica a un usuario tipo 'Residente': si está en 1, es además
  -- miembro del comité de administración y tiene los mismos permisos que
  -- un Administrador en todo el sistema, EXCEPTO nombrar/quitar comité
  -- (eso es exclusivo del Administrador real — ver auth.service.ts /
  -- middleware/auth.ts / admin.ts).
  flg_comite          TINYINT NOT NULL DEFAULT 0,
  -- Solo aplica a un usuario tipo 'Residente' (ronda 14): a qué título vive
  -- en el depto — Propietario, Arrendatario, Pareja del propietario,
  -- Roomie, Familiar u Otro. NULL en los residentes de prueba que todavía
  -- no se reemplazaron por datos reales, y en Guardia/Administrador (no
  -- aplica).
  tipo_residente_id_tiporesidente INT NULL,
  -- Solo aplica a un usuario tipo 'Residente' (ronda 15): es el DUEÑO
  -- registrado del depto (unidad_id_unidad), independiente de si vive ahí
  -- o no (puede tener el depto arrendado y vivir en otra ciudad). El
  -- dueño siempre tiene una cuenta con acceso a la app (usuariocol +
  -- password, igual que cualquier residente) y, mientras esté vigente,
  -- puede administrar el listado de residentes de SU unidad (agregar,
  -- editar, dar de baja) sin depender del Administrador — ver
  -- routes/mi-depto.ts. A lo más un usuario por unidad debería tener este
  -- flag en 1 (no forzado por constraint, pero actualizarResidente/
  -- crearResidente lo transfieren automáticamente si se reasigna). Si el
  -- dueño SÍ vive en el depto, además normalmente tiene
  -- tipo_residente_id_tiporesidente = 'Propietario'; si no vive ahí, este
  -- campo puede quedar en NULL (no es "residente" en el sentido de quién
  -- ocupa la unidad, solo su dueño).
  flg_propietario     TINYINT NOT NULL DEFAULT 0,
  -- Token de push de Expo del teléfono donde este usuario tiene la sesión
  -- activa (ronda 16, módulo de notificaciones) — lo registra la app misma
  -- con POST /auth/push-token después de loguearse y de que el usuario
  -- acepta el permiso de notificaciones. NULL = todavía no lo registró (no
  -- bloquea nada: la notificación igual queda en su bandeja dentro de la
  -- app, ver notificacion_usuario más abajo). Un usuario, un token a la vez
  -- en este MVP — no soporta varios dispositivos logeados a la vez.
  push_token          VARCHAR(255) NULL,
  -- Solo aplica a un usuario tipo 'Personal' (ronda 18: personal externo —
  -- aseo, jardinería, mantención, etc.): su especialidad, de un catálogo por
  -- condominio (tipo_personal). NULL en Guardia/Administrador/Residente, y
  -- también puede quedar NULL en un Personal sin especialidad asignada
  -- todavía (ej. "Otro"/sin clasificar).
  tipo_personal_id_tipopersonal INT NULL,
  CONSTRAINT fk_usuario_tipousuario FOREIGN KEY (tipo_usuario_id_tipousuario)
    REFERENCES tipo_usuario (id_tipousuario),
  CONSTRAINT fk_usuario_unidad FOREIGN KEY (unidad_id_unidad)
    REFERENCES unidad (id_unidad),
  CONSTRAINT fk_usuario_tipopersonal FOREIGN KEY (tipo_personal_id_tipopersonal)
    REFERENCES tipo_personal (id_tipopersonal),
  CONSTRAINT fk_usuario_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_usuario_tiporesidente FOREIGN KEY (tipo_residente_id_tiporesidente)
    REFERENCES tipo_residente (id_tiporesidente),
  INDEX idx_usuario_condominio_tipo (condominio_id_condominio, tipo_usuario_id_tipousuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Residentes con carnet de discapacidad registrado y validado por el
-- administrador. Solo un residente que esté acá puede usar un cupo de
-- discapacitados sin que el guardia tenga que confirmarle el carnet cada
-- vez (a diferencia de una visita externa).
CREATE TABLE IF NOT EXISTS residente_discapacitado (
  id_residentediscapacitado INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id_usuario         INT NOT NULL UNIQUE,
  numero_carnet               VARCHAR(50),
  flg_vigencia                 TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_residentediscapacitado_usuario FOREIGN KEY (usuario_id_usuario)
    REFERENCES usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ronda 26: multi-condominio para Administrador — un mismo administrador
-- puede llevar más de un condominio (ej. "Valles de Varoli" y "Altos de
-- San Miguel") con la MISMA cuenta (usuariocol/password), eligiendo a cuál
-- entrar después de loguearse (ver auth.service.ts -> login/
-- seleccionarCondominio). Fase 1: solo Administrador usa esta tabla;
-- Guardia/Residente/Personal siguen atados a un solo condominio vía
-- usuario.condominio_id_condominio como hasta ahora (queda pendiente para
-- una ronda futura extender el mismo mecanismo a esos roles).
-- Ronda 26 (fase 1): tabla de la primera versión del multi-condominio,
-- solo para Administrador. SUPERADA por `membresia` (ver abajo, ronda 26
-- fase 2), que generaliza lo mismo a Guardia/Residente/Personal/
-- JefeGuardias. Se deja tal cual (nadie la borra ni la usa más en el
-- código desde la fase 2) en vez de un DROP TABLE, siguiendo el mismo
-- criterio conservador de todo este archivo (solo agregar, nunca borrar).
CREATE TABLE IF NOT EXISTS usuario_condominio (
  id_usuariocondominio   INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id_usuario     INT NOT NULL,
  condominio_id_condominio INT NOT NULL,
  flg_vigencia           TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_usuariocondominio_usuario FOREIGN KEY (usuario_id_usuario)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_usuariocondominio_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  UNIQUE KEY uq_usuariocondominio (usuario_id_usuario, condominio_id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ronda 26 (fase 2): "membresía" — CUALQUIER usuario (Guardia, Residente,
-- Personal, JefeGuardias, Administrador) puede ahora pertenecer a más de
-- un condominio con la MISMA cuenta (usuariocol/password/correo, que
-- siguen viviendo en `usuario`), eligiendo a cuál entrar después de
-- loguearse — igual que ya hacía Administrador desde la fase 1, pero
-- generalizado. Ej: un residente con depto en Talca Y en Santiago, o un
-- guardia que hace turnos en dos condominios distintos.
--
-- Cada fila es "esta persona, en este condominio, tiene este rol (y este
-- depto/comité/tipo de personal si corresponde)". El rol e incluso el
-- depto pueden ser DISTINTOS entre dos condominios de la misma persona
-- (ej. Residente en uno, Guardia en otro) — por eso tipo_usuario_id_tipousuario
-- vive acá y no solo en `usuario`.
--
-- Las columnas equivalentes que quedaron en `usuario` (tipo_usuario_id_tipousuario,
-- condominio_id_condominio, unidad_id_unidad, flg_comite, flg_propietario,
-- tipo_residente_id_tiporesidente, tipo_personal_id_tipopersonal) NO se
-- borran (evitar tocar la única fuente de verdad del login sería más
-- riesgoso que dejarlas): sirven como snapshot de compatibilidad y como
-- valores por defecto al crear la membresía inicial de un usuario nuevo,
-- pero login()/seleccionarCondominio() en auth.service.ts SIEMPRE leen de
-- `membresia`, nunca directo de esas columnas de `usuario`.
CREATE TABLE IF NOT EXISTS membresia (
  id_membresia            INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id_usuario      INT NOT NULL,
  condominio_id_condominio INT NOT NULL,
  tipo_usuario_id_tipousuario INT NOT NULL,
  -- Solo si el rol de ESTA membresía es 'Residente'.
  unidad_id_unidad        INT NULL,
  flg_comite              TINYINT NOT NULL DEFAULT 0,
  flg_propietario         TINYINT NOT NULL DEFAULT 0,
  tipo_residente_id_tiporesidente INT NULL,
  -- Solo si el rol de ESTA membresía es 'Personal'.
  tipo_personal_id_tipopersonal INT NULL,
  flg_vigencia            TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_membresia_usuario FOREIGN KEY (usuario_id_usuario)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_membresia_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_membresia_tipousuario FOREIGN KEY (tipo_usuario_id_tipousuario)
    REFERENCES tipo_usuario (id_tipousuario),
  CONSTRAINT fk_membresia_unidad FOREIGN KEY (unidad_id_unidad)
    REFERENCES unidad (id_unidad),
  CONSTRAINT fk_membresia_tiporesidente FOREIGN KEY (tipo_residente_id_tiporesidente)
    REFERENCES tipo_residente (id_tiporesidente),
  CONSTRAINT fk_membresia_tipopersonal FOREIGN KEY (tipo_personal_id_tipopersonal)
    REFERENCES tipo_personal (id_tipopersonal),
  -- A lo más UNA membresía por (usuario, condominio): dentro de un mismo
  -- condominio una persona tiene un solo rol/depto, no dos filas
  -- compitiendo. Para cambiar de rol en ese condominio se EDITA la fila,
  -- no se agrega otra.
  UNIQUE KEY uq_membresia_usuario_condominio (usuario_id_usuario, condominio_id_condominio),
  INDEX idx_membresia_usuario (usuario_id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill idempotente (INSERT IGNORE + UNIQUE KEY de arriba): cada
-- usuario que ya existía antes de esta ronda queda automáticamente con UNA
-- membresía que replica exactamente su fila de `usuario` — así nadie
-- pierde acceso a su condominio de siempre, y el camino de "un solo
-- condominio" sigue siendo idéntico a como era antes de esta ronda para
-- todo el mundo hasta que alguien le agregue una segunda membresía.
INSERT IGNORE INTO membresia (
  usuario_id_usuario, condominio_id_condominio, tipo_usuario_id_tipousuario,
  unidad_id_unidad, flg_comite, flg_propietario, tipo_residente_id_tiporesidente,
  tipo_personal_id_tipopersonal
)
SELECT id_usuario, condominio_id_condominio, tipo_usuario_id_tipousuario,
       unidad_id_unidad, flg_comite, flg_propietario, tipo_residente_id_tiporesidente,
       tipo_personal_id_tipopersonal
FROM usuario
WHERE flg_vigencia = 1;

-- Ronda 27: rol "SuperAdmin" — a pedido explícito del usuario, SOLO él
-- (dueño del sistema, no un Administrador de condominio) puede crear
-- cuentas con rol Administrador (ver services/superadmin.service.ts /
-- routes/super-admin.ts). No se crea ninguna cuenta SuperAdmin automática
-- acá — eso se hace a mano una sola vez con
-- backend/src/db/crear-superadmin.ts (nunca con credenciales hardcodeadas
-- en el código). Este rol no está atado a NINGÚN condominio en particular
-- (administra el sistema completo, no un condominio) — login() lo detecta
-- y le entrega un token sin condominio_id_condominio, saltándose por
-- completo la lógica de membresías.
INSERT IGNORE INTO tipo_usuario (id_tipousuario, gls_tipousuario) VALUES (6, 'SuperAdmin');

-- Ronda 27: facturación por condominio — a pedido del usuario, cada
-- condominio paga una mensualidad; si no paga dentro de los primeros N
-- días del mes (dia_limite_pago), el condominio queda bloqueado: deja de
-- aparecer en el selector de condominios de TODOS sus usuarios (Guardia,
-- Residente, Personal, Administrador — ver auth.service.ts -> login()) y,
-- por si alguien ya tenía una sesión abierta de antes, cualquier request
-- a la API para ese condominio se corta con 402 (ver middleware
-- requireSuscripcionAlDia). monto_mensualidad = NULL significa "todavía
-- sin configurar" — un condominio en ese estado NUNCA se bloquea (así los
-- condominios que ya existían antes de esta ronda, como Valles de Varoli,
-- no quedan bloqueados de sorpresa hasta que el SuperAdmin les configure
-- un precio a propósito).
CREATE TABLE IF NOT EXISTS condominio_facturacion (
  id_condominiofacturacion INT AUTO_INCREMENT PRIMARY KEY,
  condominio_id_condominio INT NOT NULL UNIQUE,
  monto_mensualidad        DECIMAL(10,0) NULL,
  dia_limite_pago          TINYINT NOT NULL DEFAULT 5,
  CONSTRAINT fk_condominiofacturacion_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Un pago = un período (mes) de un condominio. Por ahora se registra a
-- mano (ver superadmin.service.ts -> marcarPagado, "transferencia,
-- efectivo, etc." a pedido del usuario), dejando la estructura lista para
-- que en el futuro un webhook de una pasarela de pago (Webpay u otra)
-- inserte estas filas automáticamente en vez del SuperAdmin a mano —
-- ninguna otra parte del sistema necesitaría cambiar para eso, ya que la
-- verificación de bloqueo (condominioEstaBloqueado) solo mira si existe la
-- fila con fecha_pago para el período actual.
CREATE TABLE IF NOT EXISTS pago_condominio (
  id_pagocondominio INT AUTO_INCREMENT PRIMARY KEY,
  condominio_id_condominio INT NOT NULL,
  periodo             CHAR(7) NOT NULL, -- 'YYYY-MM'
  monto                DECIMAL(10,0) NOT NULL,
  fecha_pago            DATETIME NULL, -- NULL = registrado pero no confirmado (no debería pasar con el flujo manual actual, pero deja lugar para un futuro estado "pendiente de confirmación" de una pasarela)
  registrado_por_usuario_id INT NULL, -- SuperAdmin que lo marcó a mano; NULL si en el futuro lo inserta un webhook de pago automático
  CONSTRAINT fk_pagocondominio_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_pagocondominio_usuario FOREIGN KEY (registrado_por_usuario_id)
    REFERENCES usuario (id_usuario),
  UNIQUE KEY uq_pagocondominio_periodo (condominio_id_condominio, periodo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ronda 25: recuperación de contraseña ("olvidé mi contraseña" en Login).
-- Flujo de 2 pasos: el usuario pide un código de 6 dígitos (identificándose
-- por usuariocol o por correo_usuario, ver auth.service.ts) y luego lo
-- ingresa junto a la contraseña nueva. Se guarda solo el HASH del código
-- (bcrypt, igual que password_usuario), nunca el código en texto plano —
-- así una fuga de la base no entrega códigos utilizables directamente.
-- Cada solicitud nueva inserta una fila; las anteriores no usadas del mismo
-- usuario se invalidan (flg_usado=1) para que solo el código más reciente
-- sirva. Expira a los 15 minutos (validado en el service, no acá).
CREATE TABLE IF NOT EXISTS password_reset_token (
  id_passwordresettoken INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id_usuario     INT NOT NULL,
  codigo_hash            VARCHAR(100) NOT NULL,
  fecha_creacion         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_expiracion       DATETIME NOT NULL,
  flg_usado              TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_passwordresettoken_usuario FOREIGN KEY (usuario_id_usuario)
    REFERENCES usuario (id_usuario),
  INDEX idx_passwordresettoken_usuario (usuario_id_usuario, flg_usado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tipo_visita (
  id_tipovisita   INT AUTO_INCREMENT PRIMARY KEY,
  gls_tipovisita  VARCHAR(100) NOT NULL,
  flg_vigencia    TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tipo_estacionamiento (
  id_tipoestacionamiento   INT AUTO_INCREMENT PRIMARY KEY,
  gls_tipoestacionamiento  VARCHAR(100) NOT NULL, -- 'Visita' | 'Residente' | 'Discapacitado'
  descripcion              VARCHAR(100),
  flg_vigencia             TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estado_estacionamiento (
  id_estadoestacionamiento   INT AUTO_INCREMENT PRIMARY KEY,
  gls_estadoestacionamiento  VARCHAR(100) NOT NULL,
  flg_vigencia               TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estacionamiento (
  id_estacionamiento         INT AUTO_INCREMENT PRIMARY KEY,
  numero_estacionamiento     VARCHAR(10) NOT NULL,
  ubicacion                  VARCHAR(100),
  tipo_estacionamiento_id_tipoestacionamiento     INT NOT NULL,
  estado_estacionamiento_id_estadoestacionamiento INT NOT NULL,
  condominio_id_condominio   INT NOT NULL,
  unidad_id_unidad           INT NULL, -- cupo fijo de residente, si aplica
  -- Ronda 20: solo aplica a un cupo tipo 'Residente' (unidad_id_unidad NO
  -- NULL) cuando su estado_estacionamiento es 'Disponible para arriendo' —
  -- precio que el dueño del cupo pone para que el guardia se lo informe a
  -- un vecino interesado (pedido del usuario: "pizarrón informativo", sin
  -- flujo de solicitud/aprobación dentro de la app — ver
  -- estacionamientosArriendo.service.ts). NULL en cualquier otro caso.
  precio_arriendo             INT NULL,
  CONSTRAINT fk_estacionamiento_tipo FOREIGN KEY (tipo_estacionamiento_id_tipoestacionamiento)
    REFERENCES tipo_estacionamiento (id_tipoestacionamiento),
  CONSTRAINT fk_estacionamiento_estado FOREIGN KEY (estado_estacionamiento_id_estadoestacionamiento)
    REFERENCES estado_estacionamiento (id_estadoestacionamiento),
  CONSTRAINT fk_estacionamiento_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_estacionamiento_unidad FOREIGN KEY (unidad_id_unidad)
    REFERENCES unidad (id_unidad),
  INDEX idx_estacionamiento_condominio (condominio_id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Tipos de permiso: Normal (6 hrs gratis + $60/min de exceso), 12 horas
-- ($2500 fijo), 24 horas ($5000 fijo), Fin de semana largo ($10.000 fijo,
-- 2 a 4 días), Discapacitado (sin límite de tiempo, sin cobro), y Peatonal
-- (sin límite de tiempo, sin cobro — para visitas a pie, que no ocupan
-- cupo de estacionamiento).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tipo_permiso_visita (
  id_tipopermiso           INT AUTO_INCREMENT PRIMARY KEY,
  gls_tipopermiso          VARCHAR(50) NOT NULL,
  tiempo_gratis_minutos    INT NOT NULL DEFAULT 0,
  tarifa_por_minuto_extra  INT NOT NULL DEFAULT 0,
  monto_fijo               INT NOT NULL DEFAULT 0,
  sin_limite_tiempo        TINYINT NOT NULL DEFAULT 0,
  dias_minimo              INT,
  dias_maximo              INT,
  flg_vigencia              TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visita (
  id_visita       INT AUTO_INCREMENT PRIMARY KEY,
  fecha_entrada   VARCHAR(35) NOT NULL,
  hora_entrada    VARCHAR(35) NOT NULL,
  fecha_salida    VARCHAR(35),
  hora_salida     VARCHAR(35),
  patente         VARCHAR(10),
  nombre_visita   VARCHAR(255) NOT NULL,
  rut_visita      VARCHAR(10),

  tipo_ocupante   VARCHAR(20) NOT NULL DEFAULT 'Visita', -- 'Visita' | 'Residente'

  nombre_residente_visitado     VARCHAR(150),
  residente_visitado_usuario_id INT NULL,
  residente_coincide             TINYINT NOT NULL DEFAULT 0,

  carnet_discapacidad_confirmado TINYINT NOT NULL DEFAULT 0,
  residente_discapacitado_id      INT NULL,

  tipo_visita_id_tipovisita            INT NOT NULL,
  tipo_permiso_id_tipopermiso          INT NOT NULL,
  condominio_id_condominio             INT NOT NULL,
  unidad_id_unidad                     INT NOT NULL,
  estacionamiento_id_estacionamiento   INT NULL,
  usuario_id_usuario_creador           INT NOT NULL,

  CONSTRAINT fk_visita_tipovisita FOREIGN KEY (tipo_visita_id_tipovisita)
    REFERENCES tipo_visita (id_tipovisita),
  CONSTRAINT fk_visita_tipopermiso FOREIGN KEY (tipo_permiso_id_tipopermiso)
    REFERENCES tipo_permiso_visita (id_tipopermiso),
  CONSTRAINT fk_visita_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_visita_unidad FOREIGN KEY (unidad_id_unidad)
    REFERENCES unidad (id_unidad),
  CONSTRAINT fk_visita_estacionamiento FOREIGN KEY (estacionamiento_id_estacionamiento)
    REFERENCES estacionamiento (id_estacionamiento),
  CONSTRAINT fk_visita_residente FOREIGN KEY (residente_visitado_usuario_id)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_visita_residentediscapacitado FOREIGN KEY (residente_discapacitado_id)
    REFERENCES residente_discapacitado (id_residentediscapacitado),
  CONSTRAINT fk_visita_guardia FOREIGN KEY (usuario_id_usuario_creador)
    REFERENCES usuario (id_usuario),

  INDEX idx_visita_condominio_fecha (condominio_id_condominio, fecha_entrada),
  INDEX idx_visita_unidad (unidad_id_unidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS constancia_exceso_tiempo (
  id_constancia     INT AUTO_INCREMENT PRIMARY KEY,
  fecha_movimiento  VARCHAR(35) NOT NULL,
  hora_movimiento   VARCHAR(35) NOT NULL,
  concepto          VARCHAR(50) NOT NULL,
  minutos_extras    INT,
  monto_cobrar      INT NOT NULL,
  visita_id_visita  INT NOT NULL,
  CONSTRAINT fk_constancia_visita FOREIGN KEY (visita_id_visita)
    REFERENCES visita (id_visita),
  INDEX idx_constancia_fecha (fecha_movimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Patentes del condominio — módulo de consulta y CRUD del administrador.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tipo_tenencia_patente (
  id_tipotenencia  INT AUTO_INCREMENT PRIMARY KEY,
  gls_tipotenencia VARCHAR(50) NOT NULL -- 'Propietario' | 'Arrendatario'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS patente_condominio (
  id_patente        INT AUTO_INCREMENT PRIMARY KEY,
  patente            VARCHAR(10) NOT NULL UNIQUE,
  tipo_tenencia_id_tipotenencia INT NOT NULL,
  unidad_id_unidad   INT NOT NULL,
  condominio_id_condominio INT NOT NULL,
  flg_vigencia       TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_patente_tipotenencia FOREIGN KEY (tipo_tenencia_id_tipotenencia)
    REFERENCES tipo_tenencia_patente (id_tipotenencia),
  CONSTRAINT fk_patente_unidad FOREIGN KEY (unidad_id_unidad)
    REFERENCES unidad (id_unidad),
  CONSTRAINT fk_patente_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Paquetería (encomiendas que llegan a conserjería para los residentes).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tipo_paquete (
  id_tipopaquete    INT AUTO_INCREMENT PRIMARY KEY,
  gls_tipopaquete   VARCHAR(100) NOT NULL,
  condominio_id_condominio INT NOT NULL,
  flg_vigencia      TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_tipopaquete_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estado_paquete (
  id_estadopaquete  INT AUTO_INCREMENT PRIMARY KEY,
  gls_estadopaquete VARCHAR(100) NOT NULL,
  condominio_id_condominio INT NOT NULL,
  flg_vigencia      TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_estadopaquete_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paquete (
  id_paquete          INT AUTO_INCREMENT PRIMARY KEY,
  fecha_recepcion     VARCHAR(35) NOT NULL,
  hora_recepcion      VARCHAR(35) NOT NULL,

  nombre_receptor               VARCHAR(255) NOT NULL,
  residente_receptor_usuario_id INT NULL,
  receptor_coincide             TINYINT NOT NULL DEFAULT 0,
  rut_receptor                  VARCHAR(15),

  foto_recepcion_url  VARCHAR(500) NOT NULL,

  observaciones        VARCHAR(500),

  -- Evita reenviar la notificación/push de "llevas 7 días sin retirar"
  -- (ronda 16) cada vez que se recalcula alerta7dias (que es perezoso, se
  -- recalcula en cada listado de pendientes — mismo patrón que la
  -- expiración de reservas). Se marca en 1 la primera vez que se dispara.
  alerta7dias_notificada TINYINT NOT NULL DEFAULT 0,

  fecha_entrega         VARCHAR(35),
  hora_entrega          VARCHAR(35),
  entregado_a           VARCHAR(255),
  foto_retiro_url        VARCHAR(500),
  firma_retiro_url        VARCHAR(500),

  tipo_paquete_id_tipopaquete     INT NOT NULL,
  estado_paquete_id_estadopaquete INT NOT NULL,
  unidad_id_unidad               INT NOT NULL,
  condominio_id_condominio       INT NOT NULL,

  usuario_id_usuario_creador  INT NOT NULL,
  usuario_id_usuario_entrega  INT NULL,

  CONSTRAINT fk_paquete_tipopaquete FOREIGN KEY (tipo_paquete_id_tipopaquete)
    REFERENCES tipo_paquete (id_tipopaquete),
  CONSTRAINT fk_paquete_estadopaquete FOREIGN KEY (estado_paquete_id_estadopaquete)
    REFERENCES estado_paquete (id_estadopaquete),
  CONSTRAINT fk_paquete_unidad FOREIGN KEY (unidad_id_unidad)
    REFERENCES unidad (id_unidad),
  CONSTRAINT fk_paquete_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_paquete_residente FOREIGN KEY (residente_receptor_usuario_id)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_paquete_guardia_creador FOREIGN KEY (usuario_id_usuario_creador)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_paquete_guardia_entrega FOREIGN KEY (usuario_id_usuario_entrega)
    REFERENCES usuario (id_usuario),

  INDEX idx_paquete_condominio_estado (condominio_id_condominio, estado_paquete_id_estadopaquete),
  INDEX idx_paquete_unidad (unidad_id_unidad),
  INDEX idx_paquete_fecha_recepcion (fecha_recepcion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Reservas de Espacios Comunes (ronda 14). A diferencia del resto de este
-- schema, fecha_reserva/hora_inicio/hora_termino y los timestamps de
-- llegada/salida son DATE/TIME/DATETIME reales de MySQL, no VARCHAR — ver
-- la nota al principio de este archivo sobre por qué el resto del schema
-- usa VARCHAR y por qué este módulo no debía heredar ese patrón: acá sí
-- hace falta aritmética real de fechas/horas (traslapes de horario, rangos
-- de temporada, anticipación en días, minutos de atraso).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tipo_espaciocomun (
  id_tipoespaciocomun   INT AUTO_INCREMENT PRIMARY KEY,
  gls_tipoespaciocomun  VARCHAR(100) NOT NULL,
  condominio_id_condominio INT NOT NULL,
  flg_vigencia          TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_tipoespaciocomun_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estado_reserespaciocomun (
  id_estadoreserva   INT AUTO_INCREMENT PRIMARY KEY,
  -- Pendiente -> Aprobado/Rechazado -> (si es pagado) Reservado tras
  -- validar el comprobante, o Expirado si no se valida a tiempo -> En uso
  -- (guardia marca llegada) -> Finalizado (guardia marca salida). Cancelado
  -- puede llegar desde Pendiente/Aprobado/Reservado.
  gls_estadoreserva  VARCHAR(30) NOT NULL,
  flg_vigencia       TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS espacio_comun (
  id_espaciocomun      INT AUTO_INCREMENT PRIMARY KEY,
  nombre               VARCHAR(150) NOT NULL,
  tipo_espaciocomun_id_tipoespaciocomun INT NOT NULL,
  condominio_id_condominio INT NOT NULL,
  capacidad            INT NULL,

  -- Reservable (quincho, cancha: pasa por todo el flujo de reserva) vs.
  -- libre uso (piscina, gimnasio: aparece en el catálogo para que el
  -- residente sepa que existe y sus reglas, pero no genera reserva ni pasa
  -- por aprobación — el acceso físico lo sigue controlando el guardia como
  -- hoy, fuera de este módulo).
  flg_reservable       TINYINT NOT NULL DEFAULT 1,

  -- Tarifa: un espacio pagado cobra precio_bloque por cada bloque de
  -- bloque_horas horas (o fracción, redondeado hacia arriba). Esto
  -- simplifica el ERD original (que separaba esto en una tabla
  -- tarifa_espaciocomun aparte, pensada para varias tarifas simultáneas
  -- por espacio) a una sola tarifa vigente a la vez por espacio, que es lo
  -- que pidió el usuario ("la tarifa la define cada condominio libremente
  -- por espacio", en singular) — más simple de configurar y de mostrar en
  -- la app. El monto cobrado en cada reserva igual queda "congelado" en
  -- reserva_espaciocomun.monto_tarifa, así que cambiar la tarifa de un
  -- espacio no altera reservas ya aprobadas.
  flg_gratuito         TINYINT NOT NULL DEFAULT 1,
  precio_bloque        INT NOT NULL DEFAULT 0,
  bloque_horas         DECIMAL(4,1) NOT NULL DEFAULT 1.0,
  monto_garantia       INT NOT NULL DEFAULT 0,
  tarifa_atraso_minuto INT NOT NULL DEFAULT 0,

  -- Configuración de disponibilidad (regla 7).
  hora_apertura        TIME NOT NULL DEFAULT '09:00:00',
  hora_cierre          TIME NOT NULL DEFAULT '22:00:00',
  -- Días de la semana habilitados para reservar, 1=lunes .. 7=domingo,
  -- separados por coma (ej. "1,2,3,4,5,6,7"). NULL = todos los días.
  dias_disponibles     VARCHAR(20) NULL,
  minutos_separacion   INT NOT NULL DEFAULT 0,
  dias_max_anticipacion INT NOT NULL DEFAULT 30,
  -- Días de anticipación mínima que exige el condominio para que un
  -- RESIDENTE cancele su propia reserva (regla 12; 0 = puede cancelar el
  -- mismo día). Administrador/comité pueden cancelar cualquier reserva sin
  -- este límite.
  dias_min_cancelacion_residente INT NOT NULL DEFAULT 0,

  -- Espacio de temporada (regla 8, ej. piscina "1 dic al 28 feb"): formato
  -- MM-DD, NULL en ambos = disponible todo el año. Si mes_dia_inicio >
  -- mes_dia_termino se interpreta como un rango que cruza fin de año (ej.
  -- 12-01 a 02-28 = disponible del 1 dic al 28 feb siguiente).
  mes_dia_inicio_temporada CHAR(5) NULL,
  mes_dia_termino_temporada CHAR(5) NULL,

  flg_vigencia         TINYINT NOT NULL DEFAULT 1,

  CONSTRAINT fk_espaciocomun_tipo FOREIGN KEY (tipo_espaciocomun_id_tipoespaciocomun)
    REFERENCES tipo_espaciocomun (id_tipoespaciocomun),
  CONSTRAINT fk_espaciocomun_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  INDEX idx_espaciocomun_condominio (condominio_id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reserva_espaciocomun (
  id_reserva            INT AUTO_INCREMENT PRIMARY KEY,
  espacio_comun_id_espaciocomun INT NOT NULL,
  unidad_id_unidad      INT NOT NULL,
  condominio_id_condominio INT NOT NULL,

  -- Residente "dueño" de la reserva (a quien se le cobra/notifica), y quien
  -- efectivamente la solicitó — puede ser el mismo residente, o
  -- administrador/comité si fue una solicitud telefónica a nombre de un
  -- residente (regla 4/12).
  solicitante_usuario_id INT NOT NULL,
  creado_por_usuario_id  INT NOT NULL,

  fecha_reserva  DATE NOT NULL,
  hora_inicio    TIME NOT NULL,
  hora_termino   TIME NOT NULL,

  estado_reserespaciocomun_id_estadoreserva INT NOT NULL,

  -- Montos "congelados" al momento de aprobar (si la tarifa del espacio
  -- cambia después, no afecta reservas ya aprobadas).
  monto_tarifa   INT NOT NULL DEFAULT 0,
  monto_garantia INT NOT NULL DEFAULT 0,

  comprobante_pago_url   VARCHAR(500) NULL,
  fecha_pago_validado    DATETIME NULL,
  usuario_id_valido_pago INT NULL,

  fecha_aprobacion  DATETIME NULL,
  usuario_id_aprobo  INT NULL,
  motivo_rechazo     VARCHAR(500) NULL,

  fecha_cancelacion  DATETIME NULL,
  usuario_id_cancelo INT NULL,

  -- Marcadas por el guardia en el módulo "Reserva Área Común" (regla 10).
  fecha_hora_llegada DATETIME NULL,
  fecha_hora_salida  DATETIME NULL,
  minutos_exceso     INT NOT NULL DEFAULT 0,
  monto_cobro_exceso INT NOT NULL DEFAULT 0,

  -- Garantía (regla 9): registro aparte del ciclo de estados de la reserva,
  -- no se carga al gasto común (ya se cobró junto con la tarifa por
  -- transferencia).
  estado_garantia         VARCHAR(20) NOT NULL DEFAULT 'Pendiente', -- Pendiente | Devuelta | Retenida
  monto_garantia_retenido INT NOT NULL DEFAULT 0,
  observacion_garantia    VARCHAR(500) NULL,

  fecha_creacion DATETIME NOT NULL,

  CONSTRAINT fk_reserva_espacio FOREIGN KEY (espacio_comun_id_espaciocomun)
    REFERENCES espacio_comun (id_espaciocomun),
  CONSTRAINT fk_reserva_unidad FOREIGN KEY (unidad_id_unidad)
    REFERENCES unidad (id_unidad),
  CONSTRAINT fk_reserva_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_reserva_solicitante FOREIGN KEY (solicitante_usuario_id)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_reserva_creador FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_reserva_estado FOREIGN KEY (estado_reserespaciocomun_id_estadoreserva)
    REFERENCES estado_reserespaciocomun (id_estadoreserva),
  CONSTRAINT fk_reserva_valido_pago FOREIGN KEY (usuario_id_valido_pago)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_reserva_aprobo FOREIGN KEY (usuario_id_aprobo)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_reserva_cancelo FOREIGN KEY (usuario_id_cancelo)
    REFERENCES usuario (id_usuario),

  INDEX idx_reserva_espacio_fecha (espacio_comun_id_espaciocomun, fecha_reserva),
  INDEX idx_reserva_unidad (unidad_id_unidad),
  INDEX idx_reserva_condominio_estado (condominio_id_condominio, estado_reserespaciocomun_id_estadoreserva)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Notificaciones (ronda 16): a pedido del usuario — "notificaciones push
-- para paquetes y visitas y otras cosas... el administrador o el comité
-- podrá emitir un comunicado y deberían llegarles a todos". Cubre paquetes
-- (recepción y "en portería"), visitas (aviso al residente cuando alguien
-- llega a su depto) y comunicados (administrador/comité a todos los
-- residentes activos del condominio).
--
-- Cada notificación queda SIEMPRE guardada en notificacion_usuario (una fila
-- por destinatario, con su propio leído/no leído) — eso es lo que
-- garantiza que el residente la vea al abrir la app, sin depender de nada
-- más. Además, si el destinatario tiene un push_token de Expo registrado
-- (usuario.push_token), se intenta un push real al teléfono — best effort:
-- si falla (sin token, sin red, Expo Go sin soporte de push remoto desde el
-- SDK 53, token inválido, etc.) nunca rompe el flujo que la generó (crear un
-- paquete, registrar una visita, etc.), solo queda flg_push_enviado=0. Ver
-- notificaciones.service.ts y la nota de "Supuestos" en el README sobre
-- development build vs. Expo Go.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tipo_notificacion (
  id_tiponotificacion   INT AUTO_INCREMENT PRIMARY KEY,
  gls_tiponotificacion  VARCHAR(50) NOT NULL, -- Paquete recibido | Paquete en portería | Alerta paquete sin retirar | Visita registrada | Comunicado | Tarea asignada (ronda 18)
  condominio_id_condominio INT NOT NULL,
  flg_vigencia          TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_tiponotificacion_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificacion (
  id_notificacion  INT AUTO_INCREMENT PRIMARY KEY,
  tipo_notificacion_id_tiponotificacion INT NOT NULL,
  titulo           VARCHAR(150) NOT NULL,
  cuerpo           VARCHAR(500) NOT NULL,
  condominio_id_condominio INT NOT NULL,
  -- De qué quedó generada (para poder navegar directo desde la app más
  -- adelante) — NULL en un comunicado, que no está ligado a ningún registro
  -- puntual de paquetería/visitas.
  referencia_tipo  VARCHAR(20) NULL, -- 'paquete' | 'visita' | NULL
  referencia_id    INT NULL,
  -- Quién la generó: el guardia que registró el paquete/visita (NULL en la
  -- alerta de 7 días, que la dispara el sistema al recalcularla), o el
  -- administrador/comité que redactó el comunicado.
  creado_por_usuario_id INT NULL,
  fecha_creacion   DATETIME NOT NULL,
  CONSTRAINT fk_notificacion_tipo FOREIGN KEY (tipo_notificacion_id_tiponotificacion)
    REFERENCES tipo_notificacion (id_tiponotificacion),
  CONSTRAINT fk_notificacion_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_notificacion_creador FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuario (id_usuario),
  INDEX idx_notificacion_condominio_fecha (condominio_id_condominio, fecha_creacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Un registro por destinatario: así un comunicado que le llega a los 112
-- deptos activos tiene un leído/no leído independiente por residente, igual
-- que un paquete o una visita le llega a todos los que viven/son dueños de
-- ese depto (no solo a quien coincidió por nombre).
CREATE TABLE IF NOT EXISTS notificacion_usuario (
  id_notificacionusuario INT AUTO_INCREMENT PRIMARY KEY,
  notificacion_id_notificacion INT NOT NULL,
  usuario_id_usuario     INT NOT NULL,
  flg_leido              TINYINT NOT NULL DEFAULT 0,
  fecha_leido            DATETIME NULL,
  -- 1 = se intentó el push real y Expo lo aceptó; 0 = no había push_token
  -- registrado, o el envío falló. Nunca bloquea la notificación dentro de
  -- la app, que siempre queda guardada igual.
  flg_push_enviado       TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_notificacionusuario_notificacion FOREIGN KEY (notificacion_id_notificacion)
    REFERENCES notificacion (id_notificacion),
  CONSTRAINT fk_notificacionusuario_usuario FOREIGN KEY (usuario_id_usuario)
    REFERENCES usuario (id_usuario),
  INDEX idx_notificacionusuario_usuario_leido (usuario_id_usuario, flg_leido)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Personal externo (ronda 18): aseo, jardinería, mantención, etc. — a
-- pedido del usuario ("busca la mejor manera de incorporarlos al sistema").
-- Se modeló como un tipo_usuario más ('Personal'), con login propio igual
-- que Guardia (usuariocol + password asignados por el administrador al
-- crearlo, no un flujo de "activar acceso" aparte como en Residente).
-- ---------------------------------------------------------------------------

-- Registro de turno del propio trabajador: "Empezar turno" / "Marcar
-- salida" desde su propia app (autoservicio, no lo marca el guardia) — así
-- queda registrada la fecha y horario en que estuvo en el condominio. A lo
-- más un turno abierto (fecha_termino NULL) por usuario a la vez —
-- reforzado en personal.service.ts, no con un constraint de base de datos
-- (mismo criterio que el resto de las reglas de negocio de este MVP).
CREATE TABLE IF NOT EXISTS turno_personal (
  id_turnopersonal    INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id_usuario  INT NOT NULL,
  condominio_id_condominio INT NOT NULL,
  fecha_inicio        DATETIME NOT NULL,
  fecha_termino        DATETIME NULL,
  CONSTRAINT fk_turnopersonal_usuario FOREIGN KEY (usuario_id_usuario)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_turnopersonal_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  INDEX idx_turnopersonal_usuario_fecha (usuario_id_usuario, fecha_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tarea puntual que administrador/comité le escribe a UN trabajador
-- específico (texto libre, ej. "cortar árboles costado sur" — a pedido
-- explícito del usuario: "mejor que le llegue como una notificación, porque
-- en realidad ellos saben sus deberes"). No es una plantilla de checklist:
-- cada tarea es un mensaje suelto. Se reparte como notificación (bandeja +
-- push best-effort, ver notificacion/notificacion_usuario arriba) al
-- trabajador destinatario, y este la marca como Completada desde su propia
-- app — el historial de cumplimiento (qué se completó y cuándo) solo lo ve
-- administrador/comité, nunca otro Personal ni un Residente.
CREATE TABLE IF NOT EXISTS tarea_personal (
  id_tareapersonal    INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id_usuario  INT NOT NULL, -- el trabajador destinatario
  descripcion         VARCHAR(500) NOT NULL,
  estado              VARCHAR(20) NOT NULL DEFAULT 'Pendiente', -- 'Pendiente' | 'Completada'
  condominio_id_condominio INT NOT NULL,
  creado_por_usuario_id INT NOT NULL, -- administrador/comité que la escribió
  fecha_creacion       DATETIME NOT NULL,
  fecha_completada     DATETIME NULL,
  CONSTRAINT fk_tareapersonal_usuario FOREIGN KEY (usuario_id_usuario)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_tareapersonal_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_tareapersonal_creador FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuario (id_usuario),
  INDEX idx_tareapersonal_usuario_estado (usuario_id_usuario, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Mantenciones (ronda 19): limpieza de techos, piscina, ascensores, etc. —
-- trabajo hecho por una empresa/contratista EXTERNA sin cuenta en el
-- sistema (a diferencia de Personal, que sí tiene login). Reglas cerradas
-- con el usuario antes de construir: Administrador/Comité programa la
-- mantención con anticipación (puntual, sin recurrencia automática — "todos
-- los veranos... no hay problema que fuese puntual"); el guardia, el día
-- que la empresa llega, SIEMPRE elige de la lista cuál mantención
-- programada está realizando (nunca registra una "suelta") y anota los
-- datos de la empresa (nombre, persona, RUT). Al marcar la salida de la
-- empresa la mantención pasa sola a Realizada (mismo patrón que
-- marcarLlegada/marcarSalida de Reservas). El costo es solo informativo, no
-- se prorratea en el gasto común. El comprobante/factura y las fotos del
-- trabajo terminado los sube Administrador/Comité después, al recibirlos de
-- la empresa — nunca el guardia. Se notifica a todos los residentes activos
-- del condominio en dos momentos: al programarla (aviso anticipado) y al
-- iniciar (cuando el guardia marca el ingreso de la empresa) — ver
-- notificaciones.service.ts.
-- ---------------------------------------------------------------------------

-- Catálogo de elementos/infraestructura de mantención (techo, piscina,
-- ascensor, fachada, áreas verdes, etc.) — a diferencia de otros catálogos
-- de este MVP (tipo_personal, tipo_notificacion), el usuario pidió
-- explícitamente que cada condominio pueda elegir/editar el suyo, así que
-- este SÍ tiene pantalla de administración (CRUD) desde el día uno — ver
-- AdminElementosMantencionScreen en la app.
CREATE TABLE IF NOT EXISTS tipo_elemento_mantencion (
  id_tipoelementomantencion INT AUTO_INCREMENT PRIMARY KEY,
  gls_tipoelementomantencion VARCHAR(100) NOT NULL,
  condominio_id_condominio INT NOT NULL,
  flg_vigencia TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_tipoelementomantencion_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  INDEX idx_tipoelementomantencion_condominio (condominio_id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Programada -> En curso (guardia marca ingreso de la empresa) -> Realizada
-- (guardia marca salida) — o Cancelada, solo desde Programada. Estados
-- fijos, no catalogados por condominio (mismo criterio que
-- estado_reserespaciocomun/estado_estacionamiento).
CREATE TABLE IF NOT EXISTS estado_mantencion (
  id_estadomantencion  INT AUTO_INCREMENT PRIMARY KEY,
  gls_estadomantencion VARCHAR(30) NOT NULL,
  flg_vigencia         TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mantencion (
  id_mantencion        INT AUTO_INCREMENT PRIMARY KEY,
  titulo               VARCHAR(150) NOT NULL,
  descripcion          VARCHAR(2000) NOT NULL,
  tipo_elemento_mantencion_id_tipoelementomantencion INT NOT NULL,
  condominio_id_condominio INT NOT NULL,
  fecha_programada     DATE NOT NULL,

  estado_mantencion_id_estadomantencion INT NOT NULL,

  costo_estimado       INT NULL,
  costo_real           INT NULL,
  -- Subidos por Administrador/Comité después, al recibir la factura/boleta
  -- de la empresa (nunca por el guardia).
  comprobante_url      VARCHAR(500) NULL,
  foto_resultado_url   VARCHAR(500) NULL,

  creado_por_usuario_id INT NOT NULL,
  fecha_creacion        DATETIME NOT NULL,

  motivo_cancelacion    VARCHAR(500) NULL,
  fecha_cancelacion     DATETIME NULL,
  usuario_id_cancelo    INT NULL,

  -- Registro del guardia: empresa/contratista externa que llega a hacer el
  -- trabajo (sin cuenta en el sistema) — siempre sobre una mantención ya
  -- Programada, nunca "suelta" (regla explícita del usuario).
  empresa_nombre             VARCHAR(255) NULL,
  persona_nombre             VARCHAR(255) NULL,
  persona_rut                VARCHAR(15) NULL,
  fecha_hora_llegada         DATETIME NULL,
  usuario_id_guardia_llegada INT NULL,
  fecha_hora_salida          DATETIME NULL,
  usuario_id_guardia_salida  INT NULL,

  CONSTRAINT fk_mantencion_tipoelemento FOREIGN KEY (tipo_elemento_mantencion_id_tipoelementomantencion)
    REFERENCES tipo_elemento_mantencion (id_tipoelementomantencion),
  CONSTRAINT fk_mantencion_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_mantencion_estado FOREIGN KEY (estado_mantencion_id_estadomantencion)
    REFERENCES estado_mantencion (id_estadomantencion),
  CONSTRAINT fk_mantencion_creador FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_mantencion_cancelo FOREIGN KEY (usuario_id_cancelo)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_mantencion_guardia_llegada FOREIGN KEY (usuario_id_guardia_llegada)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_mantencion_guardia_salida FOREIGN KEY (usuario_id_guardia_salida)
    REFERENCES usuario (id_usuario),

  INDEX idx_mantencion_condominio_estado (condominio_id_condominio, estado_mantencion_id_estadomantencion),
  INDEX idx_mantencion_fecha (fecha_programada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- VETADOS (ronda 20): personas con prohibición de ingreso al condominio —
-- caso típico, orden de alejamiento contra la pareja de una residente.
-- Solo Administrador/Comité puede agregar/editar (información sensible),
-- pero cualquier guardia puede consultarla (búsqueda por RUT desde su propia
-- pantalla) y el sistema la revisa automáticamente al registrar una visita
-- vehicular o peatonal (por RUT y, si viene, por patente) — ver
-- registrarEntrada en estacionamientoVisita.service.ts. A pedido explícito
-- del usuario, la alerta NUNCA bloquea el registro: solo se le muestra al
-- guardia (campo alertaVetado en la respuesta) y él decide cómo proceder
-- (ej. llamar a Carabineros). flg_vigencia permite dar de baja a alguien de
-- la lista (orden de alejamiento vencida, etc.) sin borrar el historial.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vetado (
  id_vetado            INT AUTO_INCREMENT PRIMARY KEY,
  nombre_completo       VARCHAR(255) NOT NULL,
  rut                   VARCHAR(15) NOT NULL,
  patente               VARCHAR(10) NULL, -- del vehículo de la persona, si tiene
  parentesco            VARCHAR(150) NULL, -- relación con la residente actual (ej. "Ex pareja depto 305")
  -- Fecha en que esta persona quedó registrada en el listado de VETADOS (no
  -- confundir con la fecha de alguna visita — este registro es preventivo,
  -- puede que la persona nunca haya intentado entrar).
  fecha_ingreso          DATE NOT NULL,
  foto_persona_url       VARCHAR(500) NULL,
  foto_vehiculo_url      VARCHAR(500) NULL,
  observaciones          VARCHAR(500) NULL,
  condominio_id_condominio INT NOT NULL,
  flg_vigencia            TINYINT NOT NULL DEFAULT 1,
  creado_por_usuario_id   INT NOT NULL, -- Administrador/Comité que lo agregó
  fecha_creacion          DATETIME NOT NULL,
  CONSTRAINT fk_vetado_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_vetado_creador FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuario (id_usuario),
  INDEX idx_vetado_condominio_rut (condominio_id_condominio, rut, flg_vigencia),
  INDEX idx_vetado_condominio_patente (condominio_id_condominio, patente, flg_vigencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Bitácora de guardias (ronda 20): libro de novedades de portería
-- tradicional — compartido entre todos los guardias del condominio (el que
-- entra de turno lee lo que anotó el anterior), auto-timestamp de
-- fecha/hora y nombre del guardia que escribe (nunca editable a mano).
-- Administrador/Comité puede leerla (supervisión) pero no escribir en ella.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bitacora_guardia (
  id_bitacora                INT AUTO_INCREMENT PRIMARY KEY,
  texto                       VARCHAR(2000) NOT NULL,
  fecha_hora                  DATETIME NOT NULL,
  usuario_id_usuario_guardia  INT NOT NULL, -- guardia que escribió (auto, no editable)
  condominio_id_condominio    INT NOT NULL,
  CONSTRAINT fk_bitacora_guardia FOREIGN KEY (usuario_id_usuario_guardia)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_bitacora_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  INDEX idx_bitacora_condominio_fecha (condominio_id_condominio, fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Turnos de guardias (ronda 20): rol nuevo JEFE_GUARDIAS gestiona el
-- calendario semanal ("bloques fijos por día" — Mañana/Tarde/Noche,
-- catalogados por condominio con su horario) y asigna qué guardia cubre
-- cada bloque cada día. A pedido explícito del usuario, este calendario
-- SÍ restringe el login del guardia (ver login() en auth.service.ts):
--   a) Si el guardia no tiene NINGÚN turno asignado nunca (tabla vacía para
--      él), se le deja entrar igual — fail-open, para no dejar a portería
--      sin acceso mientras el condominio recién empieza a usar esta
--      herramienta (supuesto a confirmar con el usuario, ver ronda 20).
--   b) Si tiene turnos asignados esta semana (lunes a domingo) pero ninguno
--      es hoy, se le bloquea el login hoy.
--   c) Si tiene un turno asignado hoy, solo puede entrar dentro de la
--      ventana [hora_inicio - 15 min, hora_termino + 15 min] de alguno de
--      sus bloques de hoy (margen para no cortar por segundos).
-- JEFE_GUARDIAS además tiene un CRUD de guardias para su propio control
-- (reutiliza listarGuardias/crearGuardia/actualizarGuardia de
-- admin.service.ts, montado en rutas propias /jefe-guardias/*) — y SOLO eso:
-- no tiene acceso a ningún otro módulo del sistema.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS turno_bloque (
  id_turnobloque      INT AUTO_INCREMENT PRIMARY KEY,
  gls_turnobloque      VARCHAR(50) NOT NULL, -- 'Mañana' | 'Tarde' | 'Noche'
  hora_inicio           TIME NOT NULL,
  hora_termino          TIME NOT NULL,
  condominio_id_condominio INT NOT NULL,
  flg_vigencia          TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_turnobloque_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS turno_asignado_guardia (
  id_turnoasignado         INT AUTO_INCREMENT PRIMARY KEY,
  guardia_usuario_id        INT NOT NULL,
  turno_bloque_id_turnobloque INT NOT NULL,
  fecha                      DATE NOT NULL,
  condominio_id_condominio  INT NOT NULL,
  creado_por_usuario_id     INT NOT NULL, -- JefeGuardias que hizo la asignación
  fecha_creacion             DATETIME NOT NULL,
  CONSTRAINT fk_turnoasignado_guardia FOREIGN KEY (guardia_usuario_id)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_turnoasignado_bloque FOREIGN KEY (turno_bloque_id_turnobloque)
    REFERENCES turno_bloque (id_turnobloque),
  CONSTRAINT fk_turnoasignado_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_turnoasignado_creador FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuario (id_usuario),
  UNIQUE KEY uq_turnoasignado_guardia_bloque_fecha (guardia_usuario_id, turno_bloque_id_turnobloque, fecha),
  INDEX idx_turnoasignado_condominio_fecha (condominio_id_condominio, fecha),
  INDEX idx_turnoasignado_guardia_fecha (guardia_usuario_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Mascotas (ronda 20): cada unidad puede tener cero, una o varias mascotas
-- registradas — autoservicio de cualquier residente activo de esa unidad
-- (no exclusivo del propietario). Mínimo pedido por el usuario: foto +
-- nombre. Se agregaron especie, raza y número de chip (este último sugerido
-- explícitamente por el usuario, "como número de chip por ejemplo") como
-- campos opcionales — supuesto a confirmar, ver ronda 20.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mascota (
  id_mascota             INT AUTO_INCREMENT PRIMARY KEY,
  nombre                  VARCHAR(100) NOT NULL,
  especie                 VARCHAR(50) NULL, -- 'Perro' | 'Gato' | 'Otro'
  raza                    VARCHAR(100) NULL,
  numero_chip             VARCHAR(50) NULL,
  foto_url                VARCHAR(500) NULL,
  unidad_id_unidad        INT NOT NULL,
  condominio_id_condominio INT NOT NULL,
  creado_por_usuario_id    INT NOT NULL, -- residente que la registró
  fecha_creacion           DATETIME NOT NULL,
  flg_vigencia             TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_mascota_unidad FOREIGN KEY (unidad_id_unidad)
    REFERENCES unidad (id_unidad),
  CONSTRAINT fk_mascota_condominio FOREIGN KEY (condominio_id_condominio)
    REFERENCES condominio (id_condominio),
  CONSTRAINT fk_mascota_creador FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuario (id_usuario),
  INDEX idx_mascota_unidad (unidad_id_unidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
