import { db, withTransaction } from "../db/client";

// Ronda 26: asistente de creación de condominio — lo usa un Administrador
// para dar de alta un condominio nuevo que él mismo va a administrar (ver
// SeleccionarCondominioScreen / CrearCondominioScreen en la app). Queda
// automáticamente vinculado a él vía usuario_condominio (ver
// auth.service.ts), sin tocar a ningún otro usuario.
export interface TorreInput {
  nombre_torre: string;
  cantidad_pisos?: number;
  // Números de depto de ESA torre (ej. ["101","102","201","202"]) — ya
  // vienen separados/limpios desde el cliente (ver CrearCondominioScreen:
  // acepta tanto una lista pegada tipo CSV como generación automática por
  // patrón "pisos x deptos por piso").
  numeros_unidad: string[];
}

export interface CrearCondominioInput {
  nombre_condominio: string;
  // false = condominio de casas, sin torres/blocks (ver AGENTS.md/README:
  // a pedido del usuario, esta parte es opcional para ese caso).
  tiene_torres: boolean;
  torres?: TorreInput[];
  // Solo cuando tiene_torres = false: números/nombres de cada casa.
  numeros_unidad_casas?: string[];
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

export async function crearCondominioConEstructura(idUsuarioAdmin: number, input: CrearCondominioInput) {
  const nombre = input.nombre_condominio?.trim();
  if (!nombre) {
    throw new Error("Falta el nombre del condominio.");
  }

  if (input.tiene_torres) {
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
  } else {
    if (limpiarNumeros(input.numeros_unidad_casas).length === 0) {
      throw new Error("Agrega al menos un número/nombre de casa.");
    }
  }

  return withTransaction(async (tx) => {
    const insertCondominio = await tx
      .prepare(`INSERT INTO condominio (gls_condominio) VALUES (?)`)
      .run(nombre);
    const condominioId = Number(insertCondominio.lastInsertRowid);

    let torresCreadas = 0;
    let unidadesCreadas = 0;

    if (input.tiene_torres) {
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
    } else {
      // Condominio de casas: no hay torres reales, pero la tabla `unidad`
      // exige sí o sí una torre_block (columna NOT NULL) — se crea una
      // torre "invisible" para la UI, solo para satisfacer esa relación.
      // Ninguna pantalla actual muestra el nombre de torre para pedirle al
      // guardia/residente que lo escoja cuando el condominio no tiene
      // torres reales, así que este nombre nunca se le muestra a nadie.
      const insertTorre = await tx
        .prepare(`INSERT INTO torre_block (nombre_torre, condominio_id_condominio) VALUES (?, ?)`)
        .run("Casas", condominioId);
      const torreId = Number(insertTorre.lastInsertRowid);
      torresCreadas = 0; // no se cuenta como torre real hacia el usuario

      for (const numero of limpiarNumeros(input.numeros_unidad_casas)) {
        await tx
          .prepare(
            `INSERT INTO unidad (numero_unidad, condominio_id_condominio, torre_block_id_torreblock) VALUES (?, ?, ?)`
          )
          .run(numero, condominioId, torreId);
        unidadesCreadas += 1;
      }
    }

    // El administrador que lo creó queda vinculado automáticamente — sin
    // esto, habría creado un condominio al que ni siquiera él podría
    // entrar después (ver usuario_condominio / auth.service.ts).
    await tx
      .prepare(`INSERT INTO usuario_condominio (usuario_id_usuario, condominio_id_condominio) VALUES (?, ?)`)
      .run(idUsuarioAdmin, condominioId);

    return {
      id_condominio: condominioId,
      nombre,
      torres_creadas: torresCreadas,
      unidades_creadas: unidadesCreadas,
    };
  });
}

export async function listarCondominiosDeUsuario(idUsuario: number) {
  return db
    .prepare(
      `SELECT c.id_condominio, c.gls_condominio AS nombre
       FROM usuario_condominio uc
       JOIN condominio c ON c.id_condominio = uc.condominio_id_condominio
       WHERE uc.usuario_id_usuario = ? AND uc.flg_vigencia = 1 AND c.flg_vigencia = 1
       ORDER BY c.gls_condominio`
    )
    .all(idUsuario);
}
