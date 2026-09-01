import { db, withTransaction } from "../db/client";

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
