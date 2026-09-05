// Cambia la contraseña de cualquier cuenta del sistema, buscándola por su
// usuariocol — útil para resetear cuentas administrativas (SuperAdmin,
// Administrador, etc.) sin tener que pasar por el flujo normal de
// "recuperar contraseña" (que depende de tener un correo configurado).
//
// Uso (parado en backend/, con las mismas variables DB_HOST/DB_USER/etc.
// de siempre):
//
//   USUARIO=admin_MI PASSWORD_NUEVA="Matimania1500!" npx tsx src/db/cambiar-password.ts
//
// En PowerShell:
//   $env:USUARIO="admin_MI"; $env:PASSWORD_NUEVA="Matimania1500!"; npx tsx src/db/cambiar-password.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

async function main() {
  const usuario = process.env.USUARIO;
  const passwordNueva = process.env.PASSWORD_NUEVA;

  if (!usuario || !passwordNueva) {
    console.error("Faltan variables: USUARIO y PASSWORD_NUEVA.");
    process.exit(1);
  }
  if (passwordNueva.length < 8) {
    console.error("La contraseña nueva debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "mi_condominio",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
  });

  try {
    const [filas] = (await connection.query(`SELECT id_usuario, nombre_usuario FROM usuario WHERE usuariocol = ?`, [usuario])) as any;
    if (filas.length === 0) {
      console.error(`No existe ninguna cuenta con usuario "${usuario}".`);
      process.exit(1);
    }
    const hash = bcrypt.hashSync(passwordNueva, 10);
    await connection.query(`UPDATE usuario SET password_usuario = ? WHERE usuariocol = ?`, [hash, usuario]);
    console.log(`Contraseña de "${usuario}" (${filas[0].nombre_usuario}) actualizada correctamente.`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
