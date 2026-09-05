// Ronda 66, a pedido explícito del usuario: corre wipe.sql sin depender de
// tener el cliente `mysql` de línea de comandos instalado en Windows — usa
// la misma librería (mysql2) que ya usa el backend, así que no hace falta
// instalar nada nuevo.
//
// Uso (parado en backend/, con las mismas variables DB_HOST/DB_USER/etc.
// que ya usás para conectarte a Railway):
//
//   DB_HOST=... DB_PORT=... DB_USER=... DB_PASSWORD=... DB_NAME=... DB_SSL=true \
//     npx tsx src/db/wipe.ts
//
// O en PowerShell:
//   $env:DB_HOST="..."; $env:DB_PORT="..."; ...; npx tsx src/db/wipe.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

async function main() {
  const DB_HOST = process.env.DB_HOST || "127.0.0.1";
  const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const DB_USER = process.env.DB_USER || "root";
  const DB_PASSWORD = process.env.DB_PASSWORD || "";
  const DB_NAME = process.env.DB_NAME || "mi_condominio";
  const DB_SSL = process.env.DB_SSL === "true";
  const DB_SSL_REJECT_UNAUTHORIZED = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";

  const wipePath = path.join(__dirname, "../../wipe.sql");
  if (!fs.existsSync(wipePath)) {
    console.error(`No se encontró wipe.sql en ${wipePath} — ¿lo guardaste en la carpeta backend/?`);
    process.exit(1);
  }
  const sql = fs.readFileSync(wipePath, "utf-8");

  console.log(`Conectando a ${DB_HOST}:${DB_PORT}/${DB_NAME}...`);
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: DB_SSL ? { rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED } : undefined,
    multipleStatements: true,
  });

  try {
    await connection.query(sql);
    console.log("Listo — la base quedó vacía (excepto los catálogos globales).");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Error corriendo wipe.sql:", err);
  process.exit(1);
});
