import mysql, { Pool, PoolConnection } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";

// Conexión a MySQL/MariaDB (ronda 13: reemplaza al node:sqlite embebido que
// se usaba antes solo por la restricción de red de este entorno de
// desarrollo). El schema vive en docs/schema-mysql.sql (raíz del proyecto)
// — es la única fuente de verdad del DDL, tanto para desarrollo como para
// el hosting real.
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "mi_condominio";

// Ronda 36, a pedido explícito del usuario (revisión de encriptación): antes
// la conexión al motor de base de datos no forzaba TLS, así que si el
// proveedor no lo exige por su cuenta, todo lo que viaja entre el backend y
// la base (incluidas las contraseñas ya hasheadas, RUTs, patentes, etc.)
// podía ir sin cifrar por la red. Queda como variable de entorno — DB_SSL,
// apagado por defecto — porque en desarrollo local (MySQL/MariaDB en
// 127.0.0.1, sin certificado configurado) forzarlo rompería la conexión;
// en producción (Railway u otro proveedor) conviene prenderlo si el
// proveedor lo soporta. Ver backend/.env.example.
const DB_SSL = process.env.DB_SSL === "true";
// Algunos proveedores (incluido Railway en varios planes) usan un
// certificado que Node no puede validar contra una CA conocida — esta
// variable es el escape hatch si DB_SSL=true tira error de certificado; por
// defecto sí valida (más seguro).
const DB_SSL_REJECT_UNAUTHORIZED = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";

export const pool: Pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  ssl: DB_SSL ? { rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  // Las columnas VARCHAR con fechas ISO (ver la nota en schema-mysql.sql
  // sobre por qué son VARCHAR y no DATE/DATETIME) ya vuelven como string por
  // ser VARCHAR; este flag además evita que mysql2 intente convertir a
  // objeto Date cualquier columna que sí sea DATE/DATETIME/TIMESTAMP en el
  // futuro, para que el comportamiento sea siempre "string tal cual".
  dateStrings: true,
});

type Queryable = Pool | PoolConnection;

export interface PreparedStatement {
  get(...params: any[]): Promise<any>;
  all(...params: any[]): Promise<any[]>;
  run(...params: any[]): Promise<{ lastInsertRowid: number; changes: number }>;
}

// Interfaz común entre `db` (pool, autocommit) y el `tx` que entrega
// `withTransaction` (una conexión dedicada) — los servicios que necesitan
// funcionar tanto sueltos como dentro de una transacción reciben este tipo
// como parámetro (ver estacionamientoVisita.service.ts / paquetes.service.ts),
// en vez de importar `db` directamente, para no arriesgarse a mezclar
// conexiones distintas dentro de una misma transacción.
export interface DbLike {
  prepare(sql: string): PreparedStatement;
}

// Réplica mínima de la API síncrona de node:sqlite (`db.prepare(sql).get/
// .all/.run(...params)`) pero asíncrona, para que migrar cada servicio de
// SQLite a MySQL sea mecánico: agregar `await` antes de cada llamada y
// `async` en la función contenedora, sin reescribir cada consulta.
function prepareOn(conn: Queryable, sql: string): PreparedStatement {
  return {
    async get(...params: any[]): Promise<any> {
      const [rows] = await conn.query(sql, params);
      return (rows as any[])[0];
    },
    async all(...params: any[]): Promise<any[]> {
      const [rows] = await conn.query(sql, params);
      return rows as any[];
    },
    async run(...params: any[]): Promise<{ lastInsertRowid: number; changes: number }> {
      const [result] = (await conn.query(sql, params)) as any;
      return { lastInsertRowid: result.insertId, changes: result.affectedRows };
    },
  };
}

// Para el 90% de las consultas, que no necesitan una transacción explícita
// (cada una toma su propia conexión del pool, en autocommit).
export const db: DbLike = {
  prepare(sql: string) {
    return prepareOn(pool, sql);
  },
};

// Para las pocas operaciones que sí necesitan atomicidad real (registrar
// entrada/salida de visita, registrar/entregar un paquete — ver
// estacionamientoVisita.service.ts y paquetes.service.ts): reserva una
// conexión dedicada del pool, hace BEGIN, entrega un `tx: DbLike` con el
// mismo `.prepare()` pero atado a ESA conexión (así todas las consultas
// dentro del callback participan de la misma transacción), y hace COMMIT si
// el callback termina bien o ROLLBACK si lanza una excepción — mismo
// contrato que el `withTransaction` síncrono que reemplaza.
export async function withTransaction<T>(fn: (tx: DbLike) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tx: DbLike = { prepare: (sql: string) => prepareOn(connection, sql) };
    const result = await fn(tx);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Se prueban dos ubicaciones posibles del schema, en orden: (1)
// backend/docs/schema-mysql.sql — copia local pensada para despliegues
// donde el build solo incluye la carpeta backend/ (ej. Railway con "Root
// Directory" = backend, ronda 22), y (2) docs/schema-mysql.sql en la raíz
// del repo — usada cuando el build incluye el repo completo (ej. correr
// localmente). Evita que el arranque dependa de cuál de las dos formas de
// desplegar se esté usando.
const SCHEMA_CANDIDATES = [
  path.join(__dirname, "../../docs/schema-mysql.sql"),
  path.join(__dirname, "../../../docs/schema-mysql.sql"),
];
const schemaPath =
  SCHEMA_CANDIDATES.find((p) => fs.existsSync(p)) ?? SCHEMA_CANDIDATES[0];

// Aplica el schema (CREATE TABLE IF NOT EXISTS...) contra la base indicada
// en las variables de entorno. Se llama una vez al arrancar el backend (ver
// index.ts), antes de levantar el servidor HTTP. Usa una conexión aparte
// con `multipleStatements` habilitado (el pool normal de la app NO lo
// habilita, a propósito, para no exponer esa superficie en las consultas
// parametrizadas de todos los días).
export async function initSchema(): Promise<void> {
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  });
  try {
    await connection.query(schemaSql);
  } finally {
    await connection.end();
  }
}
