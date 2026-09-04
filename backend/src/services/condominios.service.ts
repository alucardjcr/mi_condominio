import { db, withTransaction } from "../db/client";
import { sembrarCatalogosAmonestacionMulta } from "./catalogos-default.service";

// Ronda 26: asistente de creación de condominio — lo usa un Administrador
// para dar de alta un condominio nuevo que él mismo va a administrar (ver
// SeleccionarCondominioScreen / CrearCondominioScreen en la app). Queda
// automáticamente vinculado a él vía `membresia` (ver auth.service.ts),
// sin tocar a ningún otro usuario.
export interface TorreInput {
  nombre_torre: string;
  cantidad_pisos?: number;
  // Números de depto de ESA torre (ej. ["101","102","201","202"]) — ya
  // vienen separados/limpios desde el cliente (ver CrearCondominioScreen:
  // acepta tanto una lista pegada tipo CSV como generación automática por
  // patrón "pisos x deptos por piso").
  numeros_unidad: string[];
}

export interface EdificioInput {
  cantidad_pisos?: number;
  numeros_unidad: string[];
}

// Ronda 26 (fase 2, a pedido del usuario): 3 formas de estructura, no 2 —
// "torres" (varias torres/blocks con nombre propio, ej. el condominio de
// Talca del usuario), "edificio" (un solo edificio sin nombres de torre,
// solo pisos y deptos por piso, ej. su edificio de Santiago) y "casas"
// (condominio cerrado de casas, sin pisos ni torres).
export type EstructuraCondominio = "torres" | "edificio" | "casas";

export interface CrearCondominioInput {
  nombre_condominio: string;
  estructura: EstructuraCondominio;
  torres?: TorreInput[]; // solo si estructura = "torres"
  edificio?: EdificioInput; // solo si estructura = "edificio"
  numeros_unidad_casas?: string[]; // solo si estructura = "casas"
  // Ronda 56, a pedido explícito del usuario: comuna del condominio,
  // opcional (se muestra en el selector de condominios del administrador).
  comuna?: string;
  // Ronda 57, a pedido explícito del usuario: región, junto a la comuna.
  region?: string;
}

function limpiarNumeros(lista: string[] | undefined): string[] {
  if (!lista) return [];
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const raw of lista) {
    const n = String(raw).trim();
    if (!n || vistos.has(n)) continue;
    vistos.add(n);
    resultado.push(n);
  }
  return resultado;
}

async function idTipoUsuarioAdministrador(): Promise<number> {
  const row = (await db
    .prepare(`SELECT id_tipousuario FROM tipo_usuario WHERE gls_tipousuario = 'Administrador'`)
    .get()) as { id_tipousuario: number } | undefined;
  if (!row) throw new Error('No se encontró el tipo de usuario "Administrador".');
  return row.id_tipousuario;
}

export async function crearCondominioConEstructura(idUsuarioAdmin: number, input: CrearCondominioInput) {
  const nombre = input.nombre_condominio?.trim();
  if (!nombre) {
    throw new Error("Falta el nombre del condominio.");
  }
  // Ronda 59, a pedido explícito del usuario: región y comuna pasan a ser
  // obligatorias, igual que el nombre (antes eran opcionales).
  if (!input.region?.trim()) {
    throw new Error("Falta la región del condominio.");
  }
  if (!input.comuna?.trim()) {
    throw new Error("Falta la comuna del condominio.");
  }

  if (input.estructura === "torres") {
    if (!input.torres || input.torres.length === 0) {
      throw new Error("Agrega al menos una torre o block.");
    }
    for (const t of input.torres) {
      if (!t.nombre_torre?.trim()) {
        throw new Error("Cada torre necesita un nombre.");
      }
      if (limpiarNumeros(t.numeros_unidad).length === 0) {
        throw new Error(`La torre "${t.nombre_torre}" no tiene ningún número de depto cargado.`);
      }
    }
  } else if (input.estructura === "edificio") {
    if (!input.edificio || limpiarNumeros(input.edificio.numeros_unidad).length === 0) {
      throw new Error("Agrega los números de depto del edificio.");
    }
  } else {
    if (limpiarNumeros(input.numeros_unidad_casas).length === 0) {
      throw new Error("Agrega al menos un número/nombre de casa.");
    }
  }

  const tipoAdminId = await idTipoUsuarioAdministrador();

  return withTransaction(async (tx) => {
    const insertCondominio = await tx.prepare(`INSERT INTO condominio (gls_condominio) VALUES (?)`).run(nombre);
    const condominioId = Number(insertCondominio.lastInsertRowid);

    if (input.comuna?.trim()) {
      await tx.prepare(`INSERT INTO condominio_detalle (condominio_id_condominio, comuna) VALUES (?, ?)`).run(condominioId, input.comuna.trim());
    }
    if (input.region?.trim()) {
      await tx.prepare(`INSERT INTO condominio_region (condominio_id_condominio, region) VALUES (?, ?)`).run(condominioId, input.region.trim());
    }

    let torresCreadas = 0;
    let unidadesCreadas = 0;

    if (input.estructura === "torres") {
      for (const t of input.torres!) {
        const numeros = limpiarNumeros(t.numeros_unidad);
        const insertTorre = await tx
          .prepare(
            `INSERT INTO torre_block (nombre_torre, cantidad_pisos, condominio_id_condominio) VALUES (?, ?, ?)`
          )
          .run(t.nombre_torre.trim(), t.cantidad_pisos ?? null, condominioId);
        const torreId = Number(insertTorre.lastInsertRowid);
        torresCreadas += 1;

        for (const numero of numeros) {
          await tx
            .prepare(
              `INSERT INTO unidad (numero_unidad, condominio_id_condominio, torre_block_id_torreblock) VALUES (?, ?, ?)`
            )
            .run(numero, condominioId, torreId);
          unidadesCreadas += 1;
        }
      }
    } else if (input.estructura === "edificio") {
      // Un solo edificio: internamente sigue siendo una torre_block (la
      // tabla `unidad` lo exige, columna NOT NULL), pero es UNA sola y sin
      // nombre propio que pedirle al usuario — se usa el mismo nombre del
      // condominio, aunque ninguna pantalla actual se lo muestra a nadie
      // (mismo criterio que la torre "Casas" del caso de abajo).
      const numeros = limpiarNumeros(input.edificio!.numeros_unidad);
      const insertTorre = await tx
        .prepare(
          `INSERT INTO torre_block (nombre_torre, cantidad_pisos, condominio_id_condominio) VALUES (?, ?, ?)`
        )
        .run(nombre, input.edificio!.cantidad_pisos ?? null, condominioId);
      const torreId = Number(insertTorre.lastInsertRowid);
      torresCreadas = 0; // es un solo edificio, no se cuenta como "torres"

      for (const numero of numeros) {
        await tx
          .prepare(
            `INSERT INTO unidad (numero_unidad, condominio_id_condominio, torre_block_id_torreblock) VALUES (?, ?, ?)`
          )
          .run(numero, condominioId, torreId);
        unidadesCreadas += 1;
      }
    } else {
      // Condominio de casas: no hay torres reales, pero la tabla `unidad`
      // exige sí o sí una torre_block (columna NOT NULL) — se crea una
      // torre "invisible" para la UI, solo para satisfacer esa relación.
      const insertTorre = await tx
        .prepare(`INSERT INTO torre_block (nombre_torre, condominio_id_condominio) VALUES (?, ?)`)
        .run("Casas", condominioId);
      const torreId = Number(insertTorre.lastInsertRowid);
      torresCreadas = 0;

      for (const numero of limpiarNumeros(input.numeros_unidad_casas)) {
        await tx
          .prepare(
            `INSERT INTO unidad (numero_unidad, condominio_id_condominio, torre_block_id_torreblock) VALUES (?, ?, ?)`
          )
          .run(numero, condominioId, torreId);
        unidadesCreadas += 1;
      }
    }

    // Ronda 41, a pedido explícito del usuario: todo condominio nuevo
    // arranca con los catálogos por defecto de amonestaciones/multas
    // (11 y 20 tipos respectivamente) — cada condominio puede después
    // agregar los suyos propios o desactivar los que no use (ver
    // catalogos-default.service.ts).
    await sembrarCatalogosAmonestacionMulta(condominioId, tx);

    // El administrador que lo creó queda vinculado automáticamente vía
    // `membresia` — sin esto, habría creado un condominio al que ni
    // siquiera él podría entrar después (ver auth.service.ts).
    await tx
      .prepare(
        `INSERT INTO membresia (usuario_id_usuario, condominio_id_condominio, tipo_usuario_id_tipousuario) VALUES (?, ?, ?)`
      )
      .run(idUsuarioAdmin, condominioId, tipoAdminId);

    return {
      id_condominio: condominioId,
      nombre,
      torres_creadas: torresCreadas,
      unidades_creadas: unidadesCreadas,
    };
  });
}

// ---------------------------------------------------------------------------
// Ronda 56/59, a pedido explícito del usuario: permitir deshacer un
// condominio creado por error (ej. nombre mal escrito), pero SOLO si
// todavía no se agregó nada real — ni un residente, guardia, personal,
// vetado, mascota, patente, pago, incidente, solicitud ARCO, o bitácora
// real de guardia. La idea es cubrir exactamente el caso de "me equivoqué
// en el nombre, quiero rehacerlo de cero" sin abrir la puerta a borrar un
// condominio que ya tiene datos reales de gente (para eso, dar de baja el
// condominio es otra conversación — no se implementa acá).
//
// Ronda 59: encontrado un bug real probando la eliminación — la primera
// versión de esta función no contemplaba `log_auditoria` (se registra
// automáticamente con CUALQUIER request, incluso solo mirar la pantalla
// del condominio, sin que el admin haga nada) — daba error de FK
// constraint al intentar borrar. Se revisaron TODAS las tablas con FK a
// `condominio` en el schema para no toparse con otra sorpresa después:
// separadas en "datos reales de gente" (bloquean el borrado) vs.
// "configuración/catálogos/logs del sistema" (se limpian solas, sin
// bloquear nada, porque no son datos de terceros).
// ---------------------------------------------------------------------------
export async function eliminarCondominioVacio(condominioId: number, solicitanteUsuarioId: number) {
  return withTransaction(async (tx) => {
    // El solicitante tiene que tener realmente una membresía en ese
    // condominio (evita que alguien intente borrar un condominio ajeno
    // adivinando el id — mismo criterio IDOR de siempre).
    const propia = await tx
      .prepare(`SELECT id_membresia FROM membresia WHERE condominio_id_condominio = ? AND usuario_id_usuario = ?`)
      .get(condominioId, solicitanteUsuarioId);
    if (!propia) {
      throw new Error("No tienes acceso a ese condominio.");
    }

    // --- Datos REALES de gente — si hay algo acá, no se puede borrar. ---
    const tablasBloqueantes = [
      "vetado",
      "mascota",
      "patente_condominio",
      "pago_condominio",
      "incidente_seguridad",
      "solicitud_arco",
      "bitacora_guardia",
      "turno_asignado_guardia",
      "condominio_facturacion",
    ];
    const conteos = await Promise.all([
      tx
        .prepare(`SELECT COUNT(*) AS n FROM membresia WHERE condominio_id_condominio = ? AND usuario_id_usuario != ?`)
        .get(condominioId, solicitanteUsuarioId) as Promise<{ n: number }>,
      ...tablasBloqueantes.map(
        (tabla) => tx.prepare(`SELECT COUNT(*) AS n FROM ${tabla} WHERE condominio_id_condominio = ?`).get(condominioId) as Promise<{ n: number }>
      ),
    ]);
    if (conteos.some((c) => c.n > 0)) {
      throw new Error(
        "Este condominio ya no se puede eliminar — tiene residentes, guardias, personal, vetados, mascotas u otros datos reales cargados. Si te equivocaste en el nombre, puedes cambiarlo desde Ajustes en vez de borrar el condominio."
      );
    }

    // --- Configuración/catálogos/logs del sistema — se limpian solos,
    //     sin bloquear nada (no son datos de otras personas). ---
    const tablasParaLimpiar = [
      "membresia", // la propia del solicitante, la única que puede quedar
      "tipo_multa",
      "tipo_amonestacion",
      "tipo_notificacion",
      "tipo_elemento_mantencion",
      "tipo_espaciocomun",
      "tipo_paquete",
      "estado_paquete",
      "tipo_personal",
      "turno_bloque",
      "turno_personal",
      "politica_retencion",
      "log_auditoria",
      "usuario_condominio", // tabla vieja, previa a `membresia` (ronda 26 fase 2)
      "unidad",
      "torre_block",
      "condominio_detalle",
      "condominio_region",
    ];
    for (const tabla of tablasParaLimpiar) {
      await tx.prepare(`DELETE FROM ${tabla} WHERE condominio_id_condominio = ?`).run(condominioId);
    }
    await tx.prepare(`DELETE FROM condominio WHERE id_condominio = ?`).run(condominioId);
  });
}
