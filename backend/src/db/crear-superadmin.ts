import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, initSchema } from "./client";

// Ronda 27: crea la cuenta SuperAdmin (dueño del sistema) — a propósito
// NUNCA se crea automáticamente en el seed ni en el schema, y NUNCA con
// una contraseña hardcodeada en el código: sería un hueco de seguridad
// gigante si alguien mirara el repo. Se corre a mano, UNA vez, pasando las
// credenciales por variables de entorno:
//
//   SUPERADMIN_USUARIO=tu_usuario SUPERADMIN_PASSWORD=tu_clave_segura SUPERADMIN_NOMBRE="Tu Nombre" \
//     npx tsx src/db/crear-superadmin.ts
//
// (parado en backend/, con las mismas variables DB_HOST/DB_USER/etc. que
// usa el backend normalmente — contra la base de producción si quieres que
// tu SuperAdmin exista ahí).
async function main() {
  await initSchema(); // asegura que exista tipo_usuario 'SuperAdmin' (ver schema-mysql.sql)

  const usuariocol = process.env.SUPERADMIN_USUARIO;
  const password = process.env.SUPERADMIN_PASSWORD;
  const nombre = process.env.SUPERADMIN_NOMBRE || "Super Admin";

  if (!usuariocol || !password) {
    console.error(
      "Faltan variables de entorno. Uso:\n" +
        '  SUPERADMIN_USUARIO=tu_usuario SUPERADMIN_PASSWORD=tu_clave_segura SUPERADMIN_NOMBRE="Tu Nombre" \\\n' +
        "    npx tsx src/db/crear-superadmin.ts"
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("La contraseña del SuperAdmin debe tener al menos 8 caracteres — es la cuenta más sensible del sistema.");
    process.exit(1);
  }

  const yaExiste = await db.prepare(`SELECT id_usuario FROM usuario WHERE usuariocol = ?`).get(usuariocol);
  if (yaExiste) {
    console.error(`Ya existe una cuenta con usuario "${usuariocol}". Elige otro, o edítala directamente en la base.`);
    process.exit(1);
  }

  const tipoSuperAdmin = (await db
    .prepare(`SELECT id_tipousuario FROM tipo_usuario WHERE gls_tipousuario = 'SuperAdmin'`)
    .get()) as { id_tipousuario: number } | undefined;
  if (!tipoSuperAdmin) {
    console.error('No se encontró el tipo de usuario "SuperAdmin" — ¿corriste initSchema()/el backend al menos una vez con el schema de esta ronda?');
    process.exit(1);
  }

  // `usuario.condominio_id_condominio` es NOT NULL por diseño (columna
  // heredada de antes del rol SuperAdmin) pero SuperAdmin no administra
  // ningún condominio en particular — login() lo detecta por su rol y
  // nunca lee este campo para él (ver auth.service.ts). Se usa cualquier
  // condominio existente solo para satisfacer la restricción de la
  // columna; si no hay ninguno todavía, se avisa en vez de fallar feo.
  const primerCondominio = (await db.prepare(`SELECT id_condominio FROM condominio LIMIT 1`).get()) as
    | { id_condominio: number }
    | undefined;
  if (!primerCondominio) {
    console.error(
      "No hay ningún condominio creado todavía en la base — crea al menos uno primero (ej. corriendo el seed, o desde la app una vez que exista otro Administrador)."
    );
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 10);
  await db
    .prepare(
      `INSERT INTO usuario (nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(nombre, usuariocol, hash, tipoSuperAdmin.id_tipousuario, primerCondominio.id_condominio);

  console.log(`Cuenta SuperAdmin "${usuariocol}" creada correctamente.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error creando la cuenta SuperAdmin:", err);
  process.exit(1);
});
