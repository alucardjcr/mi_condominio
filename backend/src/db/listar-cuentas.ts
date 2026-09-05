// Lista todas las cuentas que existen en el sistema en este momento —
// útil para confirmar el estado real de la base después de un wipe.
import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "mi_condominio",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
  });

  try {
    const [rows] = await connection.query(
      `SELECT u.id_usuario, u.nombre_usuario, u.usuariocol, tu.gls_tipousuario AS rol, u.condominio_id_condominio
       FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       ORDER BY u.id_usuario`
    );
    console.log(`Total de cuentas: ${(rows as any[]).length}\n`);
    console.table(rows);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
