import ExcelJS from "exceljs";
import { db } from "../db/client";

// ---------------------------------------------------------------------------
// Reporte de gasto común: todos los cobros generados por el módulo de
// estacionamientos de visita (exceso de tiempo y permisos especiales) en un
// rango de fechas, agrupados por depto, listos para pasar al gasto común de
// fin de mes. El permiso "Discapacitado" nunca genera filas en
// constancia_exceso_tiempo, así que nunca aparece acá (no corresponde).
// ---------------------------------------------------------------------------

export interface ReporteGastoComunFiltro {
  condominioId: number;
  fechaInicio: string; // "YYYY-MM-DD"
  fechaTermino: string; // "YYYY-MM-DD"
}

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

// Cobros por exceso de horario en Reservas de Espacios Comunes (ronda 14,
// regla 11: "ese monto se carga como cargo en el gasto común del depto",
// mismo patrón que el exceso de tiempo en estacionamientos). Se guarda
// aparte de ReporteGastoComunDetalleItem (columnas de visita) en vez de
// forzar una forma común, porque son conceptualmente distintos — el
// resumen por depto y el total general sí los suman juntos.
export interface ReporteGastoComunReservaItem {
  id_reserva: number;
  nombre_espacio: string;
  fecha_reserva: string;
  hora_termino: string;
  minutos_exceso: number;
  monto_cobrar: number;
  fecha_movimiento: string; // fecha_hora_salida (cuándo se generó el cobro)
  unidad_id_unidad: number;
  numero_unidad: string;
  nombre_torre: string;
}

export async function reporteGastoComun(filtro: ReporteGastoComunFiltro) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filtro.fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(filtro.fechaTermino)) {
    throw new Error("fecha_inicio y fecha_termino deben tener formato YYYY-MM-DD.");
  }
  if (filtro.fechaInicio > filtro.fechaTermino) {
    throw new Error("fecha_inicio no puede ser posterior a fecha_termino.");
  }

  const desde = `${filtro.fechaInicio}T00:00:00.000`;
  const hasta = `${filtro.fechaTermino}T23:59:59.999`;

  const detalle = (await db
    .prepare(
      `SELECT
         c.id_constancia, c.concepto, c.minutos_extras, c.monto_cobrar, c.fecha_movimiento,
         v.id_visita, v.fecha_entrada, v.hora_entrada, v.fecha_salida, v.hora_salida,
         v.nombre_visita, v.patente,
         un.id_unidad as unidad_id_unidad, un.numero_unidad, tb.nombre_torre
       FROM constancia_exceso_tiempo c
       JOIN visita v ON v.id_visita = c.visita_id_visita
       JOIN unidad un ON un.id_unidad = v.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       WHERE v.condominio_id_condominio = ?
         AND c.fecha_movimiento >= ? AND c.fecha_movimiento <= ?
       ORDER BY tb.nombre_torre ASC, un.numero_unidad ASC, c.fecha_movimiento ASC`
    )
    .all(filtro.condominioId, desde, hasta)) as unknown as ReporteGastoComunDetalleItem[];

  // fecha_hora_salida es un DATETIME real (a diferencia de fecha_movimiento
  // arriba, que es VARCHAR ISO) — se compara contra límites "YYYY-MM-DD
  // HH:MM:SS", que MySQL interpreta igual sin importar el formato exacto.
  const desdeDateTime = `${filtro.fechaInicio} 00:00:00`;
  const hastaDateTime = `${filtro.fechaTermino} 23:59:59`;

  const detalleReservas = (await db
    .prepare(
      `SELECT
         r.id_reserva, e.nombre AS nombre_espacio, r.fecha_reserva, r.hora_termino,
         r.minutos_exceso, r.monto_cobro_exceso AS monto_cobrar, r.fecha_hora_salida AS fecha_movimiento,
         un.id_unidad AS unidad_id_unidad, un.numero_unidad, tb.nombre_torre
       FROM reserva_espaciocomun r
       JOIN espacio_comun e ON e.id_espaciocomun = r.espacio_comun_id_espaciocomun
       JOIN unidad un ON un.id_unidad = r.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       WHERE r.condominio_id_condominio = ? AND r.monto_cobro_exceso > 0
         AND r.fecha_hora_salida >= ? AND r.fecha_hora_salida <= ?
       ORDER BY tb.nombre_torre ASC, un.numero_unidad ASC, r.fecha_hora_salida ASC`
    )
    .all(filtro.condominioId, desdeDateTime, hastaDateTime)) as unknown as ReporteGastoComunReservaItem[];

  const resumenMap = new Map<number, ReporteGastoComunResumenDepto>();
  const acumular = (unidadId: number, numeroUnidad: string, nombreTorre: string, monto: number) => {
    const existente = resumenMap.get(unidadId);
    if (existente) {
      existente.total_cobrar += monto;
      existente.cantidad_cobros += 1;
    } else {
      resumenMap.set(unidadId, {
        unidad_id_unidad: unidadId,
        numero_unidad: numeroUnidad,
        nombre_torre: nombreTorre,
        cantidad_cobros: 1,
        total_cobrar: monto,
      });
    }
  };
  for (const item of detalle) {
    acumular(item.unidad_id_unidad, item.numero_unidad, item.nombre_torre, item.monto_cobrar);
  }
  for (const item of detalleReservas) {
    acumular(item.unidad_id_unidad, item.numero_unidad, item.nombre_torre, item.monto_cobrar);
  }

  const resumenPorDepto = Array.from(resumenMap.values());
  const totalGeneral =
    detalle.reduce((acc, item) => acc + item.monto_cobrar, 0) + detalleReservas.reduce((acc, item) => acc + item.monto_cobrar, 0);

  return { detalle, detalleReservas, resumenPorDepto, totalGeneral };
}

// ---------------------------------------------------------------------------
// Exportación a Excel del reporte de gasto común — ronda 20, pedido del
// usuario ("comunidad feliz usamos pero solo para el tema del gasto comun").
//
// ComunidadFeliz no ofrece hoy una API pública para empujar cargos
// automáticamente (se investigó antes de construir esto), pero sí trae, en
// su módulo Cobranza y recaudación → Cargos, un botón "Importar desde
// Excel" para cargar cargos masivamente. Esta función arma un .xlsx
// pensado para subirse ahí, con las columnas que corresponden a los campos
// del formulario manual de creación de cargos de ComunidadFeliz (fecha,
// unidad, tipo/nombre de cargo, monto, descripción) — es la mejor
// aproximación posible sin tener acceso a la plantilla real de "Importar
// desde Excel" de esa cuenta. LA PRIMERA VEZ que se use, hay que comparar
// estas columnas con la plantilla real (se descarga desde ese mismo botón
// dentro de ComunidadFeliz) y avisar si los nombres de columna no calzan,
// para ajustarlos — ver la hoja "Instrucciones" del propio archivo.
// ---------------------------------------------------------------------------

function formatFechaCorta(valor: string | Date): string {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor).slice(0, 10);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function generarExcelGastoComun(filtro: ReporteGastoComunFiltro): Promise<ExcelJS.Buffer> {
  const { detalle, detalleReservas, resumenPorDepto, totalGeneral } = await reporteGastoComun(filtro);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Mi Condominio";
  workbook.created = new Date();

  // --- Hoja 1: Instrucciones -------------------------------------------
  const hojaInstrucciones = workbook.addWorksheet("Instrucciones");
  hojaInstrucciones.columns = [{ width: 100 }];
  const lineas = [
    "Cargos de gasto común — Mi Condominio",
    `Período: ${filtro.fechaInicio} a ${filtro.fechaTermino}`,
    "",
    "Cómo usar este archivo en ComunidadFeliz:",
    "1. Entra a Cobranza y recaudación → Cargos.",
    '2. Usa el botón "Importar desde Excel".',
    "3. Antes de subir este archivo la primera vez, descarga la plantilla real desde ese mismo botón",
    "   y compárala con la hoja \"Cargos\" de este archivo — si los nombres de columna no calzan",
    "   exactamente, avísale a Claude para ajustar el formato de esta exportación.",
    "",
    "Este archivo se generó como una aproximación al formato de importación de ComunidadFeliz",
    "(no existe una API pública para empujar cargos automáticamente, así que este Excel es el",
    "puente entre Mi Condominio y ComunidadFeliz).",
  ];
  lineas.forEach((linea, i) => {
    const fila = hojaInstrucciones.getRow(i + 1);
    fila.getCell(1).value = linea;
    if (i === 0) fila.getCell(1).font = { bold: true, size: 14 };
  });

  // --- Hoja 2: Cargos (una fila por cobro, para importar) ---------------
  const hojaCargos = workbook.addWorksheet("Cargos");
  hojaCargos.columns = [
    { header: "Unidad", key: "unidad", width: 12 },
    { header: "Torre", key: "torre", width: 16 },
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Tipo de cargo", key: "tipo", width: 28 },
    { header: "Monto", key: "monto", width: 14 },
    { header: "Descripción", key: "descripcion", width: 50 },
  ];
  hojaCargos.getRow(1).font = { bold: true };

  for (const item of detalle) {
    hojaCargos.addRow({
      unidad: item.numero_unidad,
      torre: item.nombre_torre,
      fecha: formatFechaCorta(item.fecha_movimiento),
      tipo: "Estacionamiento de visita",
      monto: item.monto_cobrar,
      descripcion: `${item.concepto}${item.minutos_extras ? ` · ${item.minutos_extras} min de exceso` : ""}${
        item.nombre_visita ? ` · Visita: ${item.nombre_visita}` : ""
      }${item.patente ? ` · Patente ${item.patente}` : ""}`,
    });
  }
  for (const item of detalleReservas) {
    hojaCargos.addRow({
      unidad: item.numero_unidad,
      torre: item.nombre_torre,
      fecha: formatFechaCorta(item.fecha_movimiento),
      tipo: "Reserva de espacio común (exceso de horario)",
      monto: item.monto_cobrar,
      descripcion: `${item.nombre_espacio} · ${item.minutos_exceso} min de exceso (hora término ${item.hora_termino})`,
    });
  }
  hojaCargos.getColumn("monto").numFmt = "#,##0";

  // --- Hoja 3: Resumen por depto (solo referencia interna) --------------
  const hojaResumen = workbook.addWorksheet("Resumen por depto");
  hojaResumen.columns = [
    { header: "Torre", key: "torre", width: 16 },
    { header: "Unidad", key: "unidad", width: 12 },
    { header: "Cantidad de cobros", key: "cantidad", width: 20 },
    { header: "Total a cobrar", key: "total", width: 16 },
  ];
  hojaResumen.getRow(1).font = { bold: true };
  for (const r of resumenPorDepto) {
    hojaResumen.addRow({
      torre: r.nombre_torre,
      unidad: r.numero_unidad,
      cantidad: r.cantidad_cobros,
      total: r.total_cobrar,
    });
  }
  hojaResumen.addRow({});
  const filaTotal = hojaResumen.addRow({ torre: "", unidad: "", cantidad: "TOTAL GENERAL", total: totalGeneral });
  filaTotal.font = { bold: true };
  hojaResumen.getColumn("total").numFmt = "#,##0";

  return workbook.xlsx.writeBuffer();
}
