import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, initSchema } from "./client";
import { sembrarCatalogosAmonestacionMulta } from "../services/catalogos-default.service";

function run(sql: string, params: unknown[] = []) {
  return db.prepare(sql).run(...(params as any[]));
}

async function main() {
  // Aplica el schema antes de sembrar — este script se corre suelto
  // (`npm run seed`), no pasa por el arranque de index.ts.
  await initSchema();

  // -----------------------------------------------------------------------
  // Condominio
  // -----------------------------------------------------------------------
  await run(`INSERT IGNORE INTO condominio (id_condominio, gls_condominio) VALUES (1, 'Valles de Varoli')`);
  const CONDOMINIO_ID = 1;

  // -----------------------------------------------------------------------
  // Torres (6) y unidades — datos reales de "Deptos por piso Varoli.pdf":
  // numero_unidad = piso*100 + base + columna(0..3)
  // -----------------------------------------------------------------------
  const TORRES = [
    { nombre: "Torre 1", pisos: 4, base: 1 },
    { nombre: "Torre 2", pisos: 5, base: 5 },
    { nombre: "Torre 3", pisos: 4, base: 9 },
    { nombre: "Torre 4", pisos: 5, base: 13 },
    { nombre: "Torre 5", pisos: 5, base: 17 },
    { nombre: "Torre 6", pisos: 5, base: 21 },
  ];

  const torreIds: number[] = [];
  for (let i = 0; i < TORRES.length; i++) {
    const t = TORRES[i];
    await run(
      `INSERT IGNORE INTO torre_block (id_torreblock, nombre_torre, cantidad_pisos, condominio_id_condominio) VALUES (?, ?, ?, ?)`,
      [i + 1, t.nombre, t.pisos, CONDOMINIO_ID]
    );
    torreIds.push(i + 1);
  }

  let idUnidad = 1;
  const unidadesPorTorre: Record<number, { id: number; numero: string }[]> = {};
  for (let i = 0; i < TORRES.length; i++) {
    const t = TORRES[i];
    const torreId = torreIds[i];
    unidadesPorTorre[torreId] = [];
    for (let piso = 1; piso <= t.pisos; piso++) {
      for (let col = 0; col < 4; col++) {
        const numero = String(piso * 100 + t.base + col);
        await run(
          `INSERT IGNORE INTO unidad (id_unidad, numero_unidad, piso, condominio_id_condominio, torre_block_id_torreblock) VALUES (?, ?, ?, ?, ?)`,
          [idUnidad, numero, piso, CONDOMINIO_ID, torreId]
        );
        unidadesPorTorre[torreId].push({ id: idUnidad, numero });
        idUnidad++;
      }
    }
  }
  const totalUnidades = idUnidad - 1;

  // -----------------------------------------------------------------------
  // Tipos de usuario + guardias/admin (login) + residentes (precargados, sin login)
  // -----------------------------------------------------------------------
  await run(`INSERT IGNORE INTO tipo_usuario (id_tipousuario, gls_tipousuario) VALUES (1, 'Guardia')`);
  await run(`INSERT IGNORE INTO tipo_usuario (id_tipousuario, gls_tipousuario) VALUES (2, 'Residente')`);
  await run(`INSERT IGNORE INTO tipo_usuario (id_tipousuario, gls_tipousuario) VALUES (3, 'Administrador')`);
  await run(`INSERT IGNORE INTO tipo_usuario (id_tipousuario, gls_tipousuario) VALUES (4, 'Personal')`); // ronda 18: personal externo
  await run(`INSERT IGNORE INTO tipo_usuario (id_tipousuario, gls_tipousuario) VALUES (5, 'JefeGuardias')`); // ronda 20: gestiona turnos + CRUD de guardias, y solo eso

  // Tipos de residente (ronda 14) — a qué título vive alguien en el depto.
  const TIPOS_RESIDENTE = ["Propietario", "Arrendatario", "Pareja del propietario", "Roomie", "Familiar", "Otro"];
  for (let i = 0; i < TIPOS_RESIDENTE.length; i++) {
    await run(`INSERT IGNORE INTO tipo_residente (id_tiporesidente, gls_tiporesidente) VALUES (?, ?)`, [i + 1, TIPOS_RESIDENTE[i]]);
  }
  const TIPO_RESIDENTE_PROPIETARIO_ID = 1;
  const TIPO_RESIDENTE_ARRENDATARIO_ID = 2;
  const TIPO_RESIDENTE_PAREJA_ID = 3;
  const TIPO_RESIDENTE_ROOMIE_ID = 4;

  // Cuentas de prueba — password: "1234" (cámbialas antes de usar en producción)
  const passwordHash = bcrypt.hashSync("1234", 10);
  await run(
    `INSERT IGNORE INTO usuario (id_usuario, nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio)
     VALUES (1, 'Pedro Soto', 'guardia1', ?, 1, ?)`,
    [passwordHash, CONDOMINIO_ID]
  );
  await run(
    `INSERT IGNORE INTO usuario (id_usuario, nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio)
     VALUES (2, 'Maria Diaz', 'guardia2', ?, 1, ?)`,
    [passwordHash, CONDOMINIO_ID]
  );
  await run(
    `INSERT IGNORE INTO usuario (id_usuario, nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio)
     VALUES (3, 'Administrador Varoli', 'admin', ?, 3, ?)`,
    [passwordHash, CONDOMINIO_ID]
  );

  // Residentes: 1 por depto, como placeholder (falta el listado real de
  // quién vive en cada depto — el administrador lo carga desde la app), con
  // tipo_residente "Propietario" por defecto (el más común y el que ya
  // asume el resto del MVP, ej. patentes) y flg_propietario=1 (ronda 15: por
  // defecto se asume que el placeholder es además el dueño registrado del
  // depto, hasta que se reemplace por datos reales o se anote lo contrario
  // — ver el caso de depto arrendado más abajo).
  let idUsuarioResidente = 4;
  const residenteIdPorUnidad: Record<number, number> = {};
  for (const u of Object.values(unidadesPorTorre).flat()) {
    await run(
      `INSERT IGNORE INTO usuario (id_usuario, nombre_usuario, tipo_usuario_id_tipousuario, unidad_id_unidad, condominio_id_condominio, tipo_residente_id_tiporesidente, flg_propietario)
       VALUES (?, ?, 2, ?, ?, ?, 1)`,
      [idUsuarioResidente, `Residente ${u.numero}`, u.id, CONDOMINIO_ID, TIPO_RESIDENTE_PROPIETARIO_ID]
    );
    residenteIdPorUnidad[u.id] = idUsuarioResidente;
    idUsuarioResidente++;
  }

  // Demo de "varios residentes por depto, con distinto tipo cada uno"
  // (ronda 14, ejemplo real que dio el usuario: vive con su pareja y 2
  // roomies en el mismo depto) — se agrega sobre el depto 101 para que se
  // vea el caso funcionando sin tocar el resto de los datos de prueba.
  const deptoDemoMultiresidente = unidadesPorTorre[torreIds[0]][0]; // depto 101 (misma unidad que se usa más abajo para discapacitados/patentes)
  const RESIDENTES_DEMO_MULTIPLES: { nombre: string; tipo: number }[] = [
    { nombre: "Pareja de Residente 101", tipo: TIPO_RESIDENTE_PAREJA_ID },
    { nombre: "Roomie 1 - Depto 101", tipo: TIPO_RESIDENTE_ROOMIE_ID },
    { nombre: "Roomie 2 - Depto 101", tipo: TIPO_RESIDENTE_ROOMIE_ID },
  ];
  for (const r of RESIDENTES_DEMO_MULTIPLES) {
    await run(
      `INSERT IGNORE INTO usuario (id_usuario, nombre_usuario, tipo_usuario_id_tipousuario, unidad_id_unidad, condominio_id_condominio, tipo_residente_id_tiporesidente)
       VALUES (?, ?, 2, ?, ?, ?)`,
      [idUsuarioResidente, r.nombre, deptoDemoMultiresidente.id, CONDOMINIO_ID, r.tipo]
    );
    idUsuarioResidente++;
  }

  // Acceso a la app ya activado (ronda 15) para los dos residentes de
  // demo que se usan en el README/pruebas end-to-end — "Residente 101"
  // (dueño que vive en su depto, con pareja + 2 roomies a cargo) y
  // "Residente 102" (arrendatario, ver el bloque de depto arrendado más
  // abajo) — usuario "residente101"/"residente102", password "1234".
  // Antes esto se activaba a mano con un curl aparte (ver README); ahora
  // queda directo en el seed para poder probar de punta a punta sin ese
  // paso manual.
  await run(`UPDATE usuario SET usuariocol = 'residente101', password_usuario = ? WHERE id_usuario = ? AND usuariocol IS NULL`, [
    passwordHash,
    residenteIdPorUnidad[deptoDemoMultiresidente.id],
  ]);

  // Demo de "depto arrendado" (ronda 15, ejemplo del usuario: "el depto
  // puede tener 1 propietario pero este no necesariamente vive en él, sino
  // que lo tiene arrendado") — sobre el depto 102: el placeholder que ya
  // vivía ahí pasa a ser el arrendatario (vive ahí, ya no es el dueño), y
  // se agrega aparte un dueño real que NO vive en el depto (sin
  // tipo_residente — no es "quien vive ahí") pero sí tiene su propia cuenta
  // con acceso a la app, para poder administrar a los residentes de ESE
  // depto a distancia (ver /mi-depto/* y MiHogarScreen en la app). Queda
  // con login ya activado en el seed (a diferencia del resto de los
  // residentes de prueba) justo para poder probar este flujo de punta a
  // punta sin un paso manual aparte.
  const deptoArrendadoDemo = unidadesPorTorre[torreIds[0]][1]; // depto 102
  await run(
    `UPDATE usuario SET tipo_residente_id_tiporesidente = ?, flg_propietario = 0 WHERE id_usuario = ?`,
    [TIPO_RESIDENTE_ARRENDATARIO_ID, residenteIdPorUnidad[deptoArrendadoDemo.id]]
  );
  await run(`UPDATE usuario SET usuariocol = 'residente102', password_usuario = ? WHERE id_usuario = ? AND usuariocol IS NULL`, [
    passwordHash,
    residenteIdPorUnidad[deptoArrendadoDemo.id],
  ]);
  const duenoDepto102UsuarioId = idUsuarioResidente;
  await run(
    `INSERT IGNORE INTO usuario
       (id_usuario, nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, unidad_id_unidad, condominio_id_condominio, flg_propietario)
     VALUES (?, 'Dueño Depto 102 (no vive ahí)', 'dueno102', ?, 2, ?, ?, 1)`,
    [duenoDepto102UsuarioId, passwordHash, deptoArrendadoDemo.id, CONDOMINIO_ID]
  );
  idUsuarioResidente++;

  // -----------------------------------------------------------------------
  // Personal externo (ronda 18): aseo, jardinería, mantención, etc. — con
  // login propio ya activado desde el seed (a diferencia de Residente), para
  // poder probar turno/tareas de punta a punta sin un paso manual aparte.
  // -----------------------------------------------------------------------
  const TIPOS_PERSONAL = ["Aseo", "Jardinería", "Mantención", "Conserjería externa", "Otro"];
  for (let i = 0; i < TIPOS_PERSONAL.length; i++) {
    await run(`INSERT IGNORE INTO tipo_personal (id_tipopersonal, gls_tipopersonal, condominio_id_condominio) VALUES (?, ?, ?)`, [
      i + 1,
      TIPOS_PERSONAL[i],
      CONDOMINIO_ID,
    ]);
  }
  const TIPO_PERSONAL_ASEO_ID = 1;
  const TIPO_PERSONAL_JARDINERIA_ID = 2;
  const TIPO_PERSONAL_MANTENCION_ID = 3;

  const idUsuarioAseo = idUsuarioResidente; // sigue la misma secuencia de id_usuario que los residentes de arriba
  await run(
    `INSERT IGNORE INTO usuario (id_usuario, nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio, tipo_personal_id_tipopersonal)
     VALUES (?, 'Rosa González (Aseo)', 'aseo1', ?, 4, ?, ?)`,
    [idUsuarioAseo, passwordHash, CONDOMINIO_ID, TIPO_PERSONAL_ASEO_ID]
  );
  const idUsuarioJardinero = idUsuarioAseo + 1;
  await run(
    `INSERT IGNORE INTO usuario (id_usuario, nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio, tipo_personal_id_tipopersonal)
     VALUES (?, 'Juan Pérez (Jardinero)', 'jardinero1', ?, 4, ?, ?)`,
    [idUsuarioJardinero, passwordHash, CONDOMINIO_ID, TIPO_PERSONAL_JARDINERIA_ID]
  );
  const idUsuarioMantencion = idUsuarioJardinero + 1;
  await run(
    `INSERT IGNORE INTO usuario (id_usuario, nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio, tipo_personal_id_tipopersonal)
     VALUES (?, 'Luis Torres (Maestro mantención)', 'mantencion1', ?, 4, ?, ?)`,
    [idUsuarioMantencion, passwordHash, CONDOMINIO_ID, TIPO_PERSONAL_MANTENCION_ID]
  );
  idUsuarioResidente = idUsuarioMantencion + 1;

  // Un residente de ejemplo registrado con carnet de discapacidad (regla 1)
  const primeraUnidadTorre1 = unidadesPorTorre[torreIds[0]][0];
  const residenteDiscapacitadoUsuarioId = residenteIdPorUnidad[primeraUnidadTorre1.id];
  await run(
    `INSERT IGNORE INTO residente_discapacitado (usuario_id_usuario, numero_carnet) VALUES (?, 'CD-000123')`,
    [residenteDiscapacitadoUsuarioId]
  );

  // -----------------------------------------------------------------------
  // Tipo de visita (transporte) y tipo de permiso (reglas de cobro)
  // -----------------------------------------------------------------------
  await run(`INSERT IGNORE INTO tipo_visita (id_tipovisita, gls_tipovisita) VALUES (1, 'Vehicular')`);
  await run(`INSERT IGNORE INTO tipo_visita (id_tipovisita, gls_tipovisita) VALUES (2, 'Peatonal')`);

  await run(
    `INSERT IGNORE INTO tipo_permiso_visita (id_tipopermiso, gls_tipopermiso, tiempo_gratis_minutos, tarifa_por_minuto_extra, monto_fijo)
     VALUES (1, 'Normal', 360, 60, 0)`
  );
  await run(
    `INSERT IGNORE INTO tipo_permiso_visita (id_tipopermiso, gls_tipopermiso, monto_fijo)
     VALUES (2, '12 horas', 2500)`
  );
  await run(
    `INSERT IGNORE INTO tipo_permiso_visita (id_tipopermiso, gls_tipopermiso, monto_fijo)
     VALUES (3, '24 horas', 5000)`
  );
  await run(
    `INSERT IGNORE INTO tipo_permiso_visita (id_tipopermiso, gls_tipopermiso, monto_fijo, dias_minimo, dias_maximo)
     VALUES (4, 'Fin de semana largo', 10000, 2, 4)`
  );
  await run(
    `INSERT IGNORE INTO tipo_permiso_visita (id_tipopermiso, gls_tipopermiso, sin_limite_tiempo)
     VALUES (5, 'Discapacitado', 1)`
  );
  await run(
    `INSERT IGNORE INTO tipo_permiso_visita (id_tipopermiso, gls_tipopermiso, sin_limite_tiempo)
     VALUES (6, 'Peatonal', 1)`
  );

  // -----------------------------------------------------------------------
  // Estacionamientos: 11 cupos de visita (V-01..V-11) + 3 de discapacitados
  // (D-01..D-03), pools separados.
  // -----------------------------------------------------------------------
  await run(
    `INSERT IGNORE INTO tipo_estacionamiento (id_tipoestacionamiento, gls_tipoestacionamiento, descripcion) VALUES (1, 'Visita', 'Cupo de estacionamiento para visitas')`
  );
  await run(`INSERT IGNORE INTO tipo_estacionamiento (id_tipoestacionamiento, gls_tipoestacionamiento) VALUES (2, 'Residente')`);
  await run(
    `INSERT IGNORE INTO tipo_estacionamiento (id_tipoestacionamiento, gls_tipoestacionamiento, descripcion) VALUES (3, 'Discapacitado', 'Sin límite de tiempo, requiere carnet o registro de residente')`
  );

  await run(`INSERT IGNORE INTO estado_estacionamiento (id_estadoestacionamiento, gls_estadoestacionamiento) VALUES (1, 'Disponible')`);
  await run(`INSERT IGNORE INTO estado_estacionamiento (id_estadoestacionamiento, gls_estadoestacionamiento) VALUES (2, 'Ocupado')`);
  await run(`INSERT IGNORE INTO estado_estacionamiento (id_estadoestacionamiento, gls_estadoestacionamiento) VALUES (3, 'Fuera de servicio')`);
  await run(`INSERT IGNORE INTO estado_estacionamiento (id_estadoestacionamiento, gls_estadoestacionamiento) VALUES (4, 'Disponible para arriendo')`); // ronda 20

  const TOTAL_CUPOS_VISITA = 11;
  for (let i = 1; i <= TOTAL_CUPOS_VISITA; i++) {
    const numero = `V-${String(i).padStart(2, "0")}`;
    await run(
      `INSERT IGNORE INTO estacionamiento
         (id_estacionamiento, numero_estacionamiento, ubicacion, tipo_estacionamiento_id_tipoestacionamiento, estado_estacionamiento_id_estadoestacionamiento, condominio_id_condominio)
       VALUES (?, ?, 'Subterráneo -1', 1, 1, ?)`,
      [i, numero, CONDOMINIO_ID]
    );
  }

  const TOTAL_CUPOS_DISCAPACITADO = 3;
  for (let i = 1; i <= TOTAL_CUPOS_DISCAPACITADO; i++) {
    const id = TOTAL_CUPOS_VISITA + i;
    const numero = `D-${String(i).padStart(2, "0")}`;
    await run(
      `INSERT IGNORE INTO estacionamiento
         (id_estacionamiento, numero_estacionamiento, ubicacion, tipo_estacionamiento_id_tipoestacionamiento, estado_estacionamiento_id_estadoestacionamiento, condominio_id_condominio)
       VALUES (?, ?, 'Acceso principal', 3, 1, ?)`,
      [id, numero, CONDOMINIO_ID]
    );
  }

  // Ronda 20: cupos fijos de residente ("Estacionamientos para arriendo
  // entre vecinos") — 3 de ejemplo, sobre las mismas 3 primeras unidades de
  // Torre 1 que ya se usan en otros módulos de demo. El 102 queda de
  // ejemplo ya "Disponible para arriendo" con precio, para que el pizarrón
  // del guardia tenga algo que mostrar de entrada; los otros dos quedan
  // "Ocupado" (uso normal del dueño).
  const CUPOS_RESIDENTE_DEMO = [
    { numero: "R-01", unidad: unidadesPorTorre[torreIds[0]][0], estado: 2, precio: null as number | null }, // 101, Ocupado
    { numero: "R-02", unidad: unidadesPorTorre[torreIds[0]][1], estado: 4, precio: 55000 }, // 102, Disponible para arriendo
    { numero: "R-03", unidad: unidadesPorTorre[torreIds[0]][2], estado: 2, precio: null as number | null }, // 103, Ocupado
  ];
  for (let i = 0; i < CUPOS_RESIDENTE_DEMO.length; i++) {
    const c = CUPOS_RESIDENTE_DEMO[i];
    const id = TOTAL_CUPOS_VISITA + TOTAL_CUPOS_DISCAPACITADO + i + 1;
    await run(
      `INSERT IGNORE INTO estacionamiento
         (id_estacionamiento, numero_estacionamiento, ubicacion, tipo_estacionamiento_id_tipoestacionamiento, estado_estacionamiento_id_estadoestacionamiento, condominio_id_condominio, unidad_id_unidad, precio_arriendo)
       VALUES (?, ?, 'Subterráneo -1', 2, ?, ?, ?, ?)`,
      [id, c.numero, c.estado, CONDOMINIO_ID, c.unidad.id, c.precio]
    );
  }

  // -----------------------------------------------------------------------
  // Patentes del condominio (autos de residentes) — datos de ejemplo
  // -----------------------------------------------------------------------
  await run(`INSERT IGNORE INTO tipo_tenencia_patente (id_tipotenencia, gls_tipotenencia) VALUES (1, 'Propietario')`);
  await run(`INSERT IGNORE INTO tipo_tenencia_patente (id_tipotenencia, gls_tipotenencia) VALUES (2, 'Arrendatario')`);

  const segundaUnidadTorre1 = unidadesPorTorre[torreIds[0]][1];
  await run(
    `INSERT IGNORE INTO patente_condominio (patente, tipo_tenencia_id_tipotenencia, unidad_id_unidad, condominio_id_condominio)
     VALUES ('AABB12', 1, ?, ?)`,
    [primeraUnidadTorre1.id, CONDOMINIO_ID]
  );
  await run(
    `INSERT IGNORE INTO patente_condominio (patente, tipo_tenencia_id_tipotenencia, unidad_id_unidad, condominio_id_condominio)
     VALUES ('CCDD34', 2, ?, ?)`,
    [segundaUnidadTorre1.id, CONDOMINIO_ID]
  );

  // -----------------------------------------------------------------------
  // Paquetería: 15 tipos de tu ERD + "Bulto" (default cuando el guardia no
  // elige tipo), y los 7 estados con el flujo confirmado.
  // -----------------------------------------------------------------------
  const TIPOS_PAQUETE = [
    "Carta",
    "Sobre certificado",
    "Paquete pequeño",
    "Paquete mediano",
    "Paquete grande",
    "Caja de compras online",
    "Documento importante",
    "Encomienda express",
    "Sobre con documentación legal",
    "Revista o catálogo",
    "Alimento no perecible",
    "Medicamento",
    "Paquete frágil",
    "Correspondencia interna",
    "Otro",
    "Bulto", // default cuando el guardia no selecciona ningún tipo
  ];
  for (let i = 0; i < TIPOS_PAQUETE.length; i++) {
    await run(
      `INSERT IGNORE INTO tipo_paquete (id_tipopaquete, gls_tipopaquete, condominio_id_condominio) VALUES (?, ?, ?)`,
      [i + 1, TIPOS_PAQUETE[i], CONDOMINIO_ID]
    );
  }
  // Debe coincidir con TIPO_PAQUETE_DEFAULT_ID en paquetes.service.ts.
  const TIPO_PAQUETE_BULTO_ID = TIPOS_PAQUETE.length; // 16
  void TIPO_PAQUETE_BULTO_ID;

  const ESTADOS_PAQUETE = [
    "Recepcionado",
    "Notificado",
    "En portería",
    "Entregado a residente",
    "Rechazado por el residente",
    "Devuelto al remitente",
    "Perdido",
  ];
  for (let i = 0; i < ESTADOS_PAQUETE.length; i++) {
    await run(
      `INSERT IGNORE INTO estado_paquete (id_estadopaquete, gls_estadopaquete, condominio_id_condominio) VALUES (?, ?, ?)`,
      [i + 1, ESTADOS_PAQUETE[i], CONDOMINIO_ID]
    );
  }

  // -----------------------------------------------------------------------
  // Reservas de Espacios Comunes (ronda 14): catálogos de tipo de espacio y
  // de estados de reserva. NO se siembra ningún espacio_comun — Valles de
  // Varoli no tiene ninguno arrendable hoy (el administrador los configura
  // desde la app cuando corresponda, ver AdminEspaciosScreen).
  // -----------------------------------------------------------------------
  const TIPOS_ESPACIOCOMUN = [
    "Quincho",
    "Salón de eventos",
    "Sala de reuniones",
    "Sala multiuso",
    "Piscina",
    "Gimnasio",
    "Cancha multiuso",
    "Sala de juegos infantiles",
    "Terraza común",
    "Cowork",
    "Otro",
  ];
  for (let i = 0; i < TIPOS_ESPACIOCOMUN.length; i++) {
    await run(
      `INSERT IGNORE INTO tipo_espaciocomun (id_tipoespaciocomun, gls_tipoespaciocomun, condominio_id_condominio) VALUES (?, ?, ?)`,
      [i + 1, TIPOS_ESPACIOCOMUN[i], CONDOMINIO_ID]
    );
  }

  const ESTADOS_RESERVA = ["Pendiente", "Aprobado", "Rechazado", "Reservado", "En uso", "Finalizado", "Cancelado", "Expirado"];
  for (let i = 0; i < ESTADOS_RESERVA.length; i++) {
    await run(`INSERT IGNORE INTO estado_reserespaciocomun (id_estadoreserva, gls_estadoreserva) VALUES (?, ?)`, [
      i + 1,
      ESTADOS_RESERVA[i],
    ]);
  }

  // -----------------------------------------------------------------------
  // Notificaciones (ronda 16): catálogo de tipos — paquetes, visitas y
  // comunicados. Debe coincidir con las constantes GLS_TIPONOTIF_* de
  // notificaciones.service.ts.
  // -----------------------------------------------------------------------
  const TIPOS_NOTIFICACION = [
    "Paquete recibido",
    "Paquete en portería",
    "Alerta paquete sin retirar",
    "Visita registrada",
    "Comunicado",
    "Tarea asignada", // ronda 18: tarea puntual de administrador/comité a un trabajador de personal externo
    "Mantención programada", // ronda 19: aviso anticipado al programar una mantención
    "Mantención en curso", // ronda 19: aviso cuando el guardia marca el ingreso de la empresa
  ];
  for (let i = 0; i < TIPOS_NOTIFICACION.length; i++) {
    await run(`INSERT IGNORE INTO tipo_notificacion (id_tiponotificacion, gls_tiponotificacion, condominio_id_condominio) VALUES (?, ?, ?)`, [
      i + 1,
      TIPOS_NOTIFICACION[i],
      CONDOMINIO_ID,
    ]);
  }

  // Ronda 41, a pedido explícito del usuario: catálogos por defecto de
  // amonestaciones/multas (11 y 20 tipos) + los 2 tipos de notificación
  // nuevos que necesita ese módulo — ver catalogos-default.service.ts.
  await sembrarCatalogosAmonestacionMulta(CONDOMINIO_ID);

  // -----------------------------------------------------------------------
  // Mantenciones (ronda 19): catálogo de elementos de infraestructura
  // (editable por el administrador desde la app, a diferencia de otros
  // catálogos cerrados del MVP) y los 4 estados fijos del ciclo de vida.
  // -----------------------------------------------------------------------
  const TIPOS_ELEMENTO_MANTENCION = [
    "Techo",
    "Piscina",
    "Ascensores",
    "Fachada",
    "Áreas verdes / jardines",
    "Bomba de agua",
    "Portón eléctrico / acceso vehicular",
    "Cámaras de seguridad",
    "Grupo electrógeno",
    "Sistema eléctrico",
    "Estacionamientos / pavimento",
    "Otro",
  ];
  for (let i = 0; i < TIPOS_ELEMENTO_MANTENCION.length; i++) {
    await run(`INSERT IGNORE INTO tipo_elemento_mantencion (id_tipoelementomantencion, gls_tipoelementomantencion, condominio_id_condominio) VALUES (?, ?, ?)`, [
      i + 1,
      TIPOS_ELEMENTO_MANTENCION[i],
      CONDOMINIO_ID,
    ]);
  }

  const ESTADOS_MANTENCION = ["Programada", "En curso", "Realizada", "Cancelada"];
  for (let i = 0; i < ESTADOS_MANTENCION.length; i++) {
    await run(`INSERT IGNORE INTO estado_mantencion (id_estadomantencion, gls_estadomantencion) VALUES (?, ?)`, [
      i + 1,
      ESTADOS_MANTENCION[i],
    ]);
  }

  // -----------------------------------------------------------------------
  // Ronda 20: VETADOS, Bitácora de guardias, JEFE_GUARDIAS + turnos,
  // Mascotas.
  // -----------------------------------------------------------------------

  // VETADOS: 1 registro de ejemplo para poder probar la alerta de punta a
  // punta (registrar una visita con este mismo RUT o patente debe devolver
  // alertaVetado en la respuesta, sin bloquear el registro).
  await run(
    `INSERT IGNORE INTO vetado
       (id_vetado, nombre_completo, rut, patente, parentesco, fecha_ingreso, observaciones, condominio_id_condominio, creado_por_usuario_id, fecha_creacion)
     VALUES (1, 'Persona De Prueba Vetada', '11111111-1', 'VETA11', 'Ex pareja de residente del depto 101', '2026-01-15', 'Orden de alejamiento vigente — dato de prueba.', ?, 3, '2026-01-15 09:00:00')`,
    [CONDOMINIO_ID]
  );

  // Bitácora de guardias: 1 entrada de ejemplo (compartida entre guardias).
  await run(
    `INSERT IGNORE INTO bitacora_guardia (id_bitacora, texto, fecha_hora, usuario_id_usuario_guardia, condominio_id_condominio)
     VALUES (1, 'Turno sin novedades. Se revisaron accesos y estacionamientos de visita, todo en orden.', '2026-08-29 22:00:00', 1, ?)`,
    [CONDOMINIO_ID]
  );

  // JEFE_GUARDIAS: bloques fijos por día (catálogo, no hay CRUD de bloques
  // en la app — son fijos) y una cuenta de prueba. A propósito NO se siembra
  // ninguna fila en turno_asignado_guardia: así guardia1/guardia2 (usados en
  // el resto de las pruebas end-to-end de todo el proyecto) quedan siempre
  // en el caso "fail-open" (sin calendario cargado, login permitido) y no se
  // rompe ningún curl de rondas anteriores por quedar fuera de horario. La
  // asignación de turnos y el bloqueo de login se prueban aparte, insertando
  // filas puntuales (ver README / verificación de esta ronda).
  const TURNO_BLOQUES = [
    { gls: "Mañana", inicio: "08:00:00", termino: "16:00:00" },
    { gls: "Tarde", inicio: "16:00:00", termino: "23:59:00" },
    { gls: "Noche", inicio: "00:00:00", termino: "08:00:00" },
  ];
  for (let i = 0; i < TURNO_BLOQUES.length; i++) {
    const b = TURNO_BLOQUES[i];
    await run(
      `INSERT IGNORE INTO turno_bloque (id_turnobloque, gls_turnobloque, hora_inicio, hora_termino, condominio_id_condominio) VALUES (?, ?, ?, ?, ?)`,
      [i + 1, b.gls, b.inicio, b.termino, CONDOMINIO_ID]
    );
  }

  const idUsuarioJefeGuardias = idUsuarioResidente; // sigue la misma secuencia de id_usuario usada arriba
  await run(
    `INSERT IGNORE INTO usuario (id_usuario, nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio)
     VALUES (?, 'Carla Muñoz (Jefa de Guardias)', 'jefeguardias1', ?, 5, ?)`,
    [idUsuarioJefeGuardias, passwordHash, CONDOMINIO_ID]
  );
  idUsuarioResidente = idUsuarioJefeGuardias + 1;

  // Mascotas: 1 de ejemplo en el depto demo multiresidente (101), registrada
  // por "residente101" (dueño que vive ahí, login ya activado).
  await run(
    `INSERT IGNORE INTO mascota (id_mascota, nombre, especie, raza, numero_chip, unidad_id_unidad, condominio_id_condominio, creado_por_usuario_id, fecha_creacion)
     VALUES (1, 'Firulais', 'Perro', 'Mestizo', 'CHIP-000456', ?, ?, ?, '2026-06-01 10:00:00')`,
    [deptoDemoMultiresidente.id, CONDOMINIO_ID, residenteIdPorUnidad[deptoDemoMultiresidente.id]]
  );

  console.log("Seed listo:");
  console.log(`- 6 torres, ${totalUnidades} unidades (datos reales del PDF), 1 residente placeholder por unidad`);
  console.log("- Cuentas de prueba: guardia1 / guardia2 / admin (password: 1234)");
  console.log(`- Residente de ${primeraUnidadTorre1.numero} registrado en residente_discapacitado (carnet CD-000123)`);
  console.log("- 11 cupos de visita (V-01..V-11) + 3 cupos de discapacitados (D-01..D-03)");
  console.log("- 2 patentes de ejemplo: AABB12 (propietario), CCDD34 (arrendatario)");
  console.log("- Visitas peatonales: sin cupo, gratis, sin límite de tiempo (tipo de visita 'Peatonal')");
  console.log(`- Paquetería: ${TIPOS_PAQUETE.length} tipos (incluye 'Bulto' por defecto) y ${ESTADOS_PAQUETE.length} estados`);
  console.log(`- Tipos de residente: ${TIPOS_RESIDENTE.join(", ")} — depto ${deptoDemoMultiresidente.numero} con 4 residentes de ejemplo (propietario + pareja + 2 roomies)`);
  console.log(`- Reservas de Espacios Comunes: ${TIPOS_ESPACIOCOMUN.length} tipos de espacio y ${ESTADOS_RESERVA.length} estados de reserva (sin espacios sembrados — Varoli no tiene ninguno hoy, se configuran desde la app)`);
  console.log(
    `- Dueños de depto (ronda 15): depto ${deptoDemoMultiresidente.numero} dueño-que-vive-ahí (residente101/1234, ya con flg_propietario); depto ${deptoArrendadoDemo.numero} arrendado — residente102/1234 vive ahí (Arrendatario), y dueno102/1234 es el dueño real que NO vive ahí y administra ese depto a distancia`
  );
  console.log(
    `- Notificaciones (ronda 16): ${TIPOS_NOTIFICACION.length} tipos (${TIPOS_NOTIFICACION.join(", ")}) — se disparan solas al registrar un paquete, marcarlo "En portería", pasar 7 días sin retirar, registrar una visita, cuando administrador/comité emite un comunicado, o cuando le asignan una tarea a personal externo`
  );
  console.log(
    `- Personal externo (ronda 18): ${TIPOS_PERSONAL.length} especialidades (${TIPOS_PERSONAL.join(", ")}) — cuentas de prueba con login ya activado: aseo1/1234 (Rosa González, Aseo), jardinero1/1234 (Juan Pérez, Jardinería), mantencion1/1234 (Luis Torres, Mantención)`
  );
  console.log(
    `- Mantenciones (ronda 19): ${TIPOS_ELEMENTO_MANTENCION.length} elementos de infraestructura (${TIPOS_ELEMENTO_MANTENCION.join(", ")}) y ${ESTADOS_MANTENCION.length} estados — sin mantenciones sembradas, se programan desde la app (Administrador/Comité)`
  );
  console.log(
    `- Ronda 20: cupos de residente R-01/102 (${CUPOS_RESIDENTE_DEMO[1].numero} ya "Disponible para arriendo" a $${CUPOS_RESIDENTE_DEMO[1].precio}); VETADOS con 1 registro de prueba (RUT 11111111-1, patente VETA11); bitácora con 1 entrada de ejemplo; JEFE_GUARDIAS: cuenta jefeguardias1/1234 + 3 bloques fijos (Mañana/Tarde/Noche) sin turnos asignados (guardia1/guardia2 quedan fail-open a propósito); mascota de ejemplo "Firulais" en depto ${deptoDemoMultiresidente.numero}`
  );

  // El pool queda abierto por defecto (mysql2 no termina el proceso solo);
  // como este script corre una vez y termina, cerramos el pool explícito.
  const { pool } = await import("./client");
  await pool.end();
}

main().catch((err) => {
  console.error("Error sembrando la base:", err);
  process.exit(1);
});
