// Ronda 78, a pedido explícito del usuario ("la idea es que tengamos en la
// bd las razas y las especies"): catálogo de especies y razas de mascotas
// domésticas — mismo patrón que "profesion"/"nacionalidad" (rondas 74 y 77):
// dos tablas de catálogo que alimentan un combobox (ver GET
// /especies-mascota y MascotasScreen/MascotaDetalleScreen). Antes esta
// lista vivía hardcodeada en el código de la app
// (app/src/utils/catalogoMascotas.ts, de esta misma ronda) — se reemplaza
// por estas tablas para que quede en la base, como en el resto de los
// catálogos del sistema.
//
// `raza_mascota` depende de la especie (fk_idespeciemascota), para el
// combobox en cascada: se listan solo las razas de la especie elegida.
//
// IMPORTANTE, igual que profesion/nacionalidad: `mascota.especie` y
// `mascota.raza` SIGUEN siendo VARCHAR — no se tocan esas columnas ni los
// datos ya cargados. Se sigue guardando el NOMBRE elegido (no el id), así
// que una mascota con una especie/raza que no está en este catálogo (dato
// viejo, o el dueño escribió "Otra") sigue funcionando igual: solo no
// aparece preseleccionada en el combobox.
exports.up = async function (knex) {
  await knex.schema.createTable("especie_mascota", (table) => {
    table.increments("id_especiemascota").primary();
    table.string("gls_especie", 100).notNullable().unique();
    table.integer("flg_vigencia").notNullable().defaultTo(1);
  });

  await knex.schema.createTable("raza_mascota", (table) => {
    table.increments("id_razamascota").primary();
    table.integer("fk_idespeciemascota").unsigned().notNullable().references("id_especiemascota").inTable("especie_mascota");
    table.string("gls_raza", 150).notNullable();
    table.integer("flg_vigencia").notNullable().defaultTo(1);
    table.unique(["fk_idespeciemascota", "gls_raza"]);
  });

  await knex("especie_mascota").insert([
    { id_especiemascota: 1, gls_especie: "Perro" },
    { id_especiemascota: 2, gls_especie: "Gato" },
    { id_especiemascota: 3, gls_especie: "Ave" },
    { id_especiemascota: 4, gls_especie: "Conejo" },
    { id_especiemascota: 5, gls_especie: "Hámster" },
    { id_especiemascota: 6, gls_especie: "Cobayo" },
    { id_especiemascota: 7, gls_especie: "Pez" },
    { id_especiemascota: 8, gls_especie: "Tortuga" },
    { id_especiemascota: 9, gls_especie: "Reptil" },
  ]);

  await knex("raza_mascota").insert([
    // Perro (1)
    { fk_idespeciemascota: 1, gls_raza: "Mestizo" },
    { fk_idespeciemascota: 1, gls_raza: "Labrador Retriever" },
    { fk_idespeciemascota: 1, gls_raza: "Golden Retriever" },
    { fk_idespeciemascota: 1, gls_raza: "Pastor Alemán" },
    { fk_idespeciemascota: 1, gls_raza: "Bulldog Francés" },
    { fk_idespeciemascota: 1, gls_raza: "Chihuahua" },
    { fk_idespeciemascota: 1, gls_raza: "Poodle / Caniche" },
    { fk_idespeciemascota: 1, gls_raza: "Beagle" },
    { fk_idespeciemascota: 1, gls_raza: "Schnauzer" },
    { fk_idespeciemascota: 1, gls_raza: "Yorkshire Terrier" },
    { fk_idespeciemascota: 1, gls_raza: "Cocker Spaniel" },
    { fk_idespeciemascota: 1, gls_raza: "Boxer" },
    { fk_idespeciemascota: 1, gls_raza: "Husky Siberiano" },
    { fk_idespeciemascota: 1, gls_raza: "Pug" },
    { fk_idespeciemascota: 1, gls_raza: "Shih Tzu" },
    { fk_idespeciemascota: 1, gls_raza: "Dálmata" },
    { fk_idespeciemascota: 1, gls_raza: "Rottweiler" },
    // Gato (2)
    { fk_idespeciemascota: 2, gls_raza: "Mestizo / Común europeo" },
    { fk_idespeciemascota: 2, gls_raza: "Siamés" },
    { fk_idespeciemascota: 2, gls_raza: "Persa" },
    { fk_idespeciemascota: 2, gls_raza: "Maine Coon" },
    { fk_idespeciemascota: 2, gls_raza: "Bengalí" },
    { fk_idespeciemascota: 2, gls_raza: "Angora" },
    { fk_idespeciemascota: 2, gls_raza: "Ragdoll" },
    { fk_idespeciemascota: 2, gls_raza: "Esfinge (Sphynx)" },
    { fk_idespeciemascota: 2, gls_raza: "British Shorthair" },
    { fk_idespeciemascota: 2, gls_raza: "Himalayo" },
    // Ave (3)
    { fk_idespeciemascota: 3, gls_raza: "Canario" },
    { fk_idespeciemascota: 3, gls_raza: "Periquito" },
    { fk_idespeciemascota: 3, gls_raza: "Ninfa (Cockatiel)" },
    { fk_idespeciemascota: 3, gls_raza: "Loro" },
    { fk_idespeciemascota: 3, gls_raza: "Agapornis" },
    { fk_idespeciemascota: 3, gls_raza: "Cacatúa" },
    // Conejo (4)
    { fk_idespeciemascota: 4, gls_raza: "Mestizo" },
    { fk_idespeciemascota: 4, gls_raza: "Holandés" },
    { fk_idespeciemascota: 4, gls_raza: "Cabeza de León" },
    { fk_idespeciemascota: 4, gls_raza: "Mini Lop" },
    { fk_idespeciemascota: 4, gls_raza: "Angora" },
    // Hámster (5)
    { fk_idespeciemascota: 5, gls_raza: "Sirio" },
    { fk_idespeciemascota: 5, gls_raza: "Ruso / Enano" },
    { fk_idespeciemascota: 5, gls_raza: "Roborovski" },
    // Cobayo (6)
    { fk_idespeciemascota: 6, gls_raza: "Común" },
    { fk_idespeciemascota: 6, gls_raza: "Peruano" },
    { fk_idespeciemascota: 6, gls_raza: "Abisinio" },
    // Pez (7)
    { fk_idespeciemascota: 7, gls_raza: "Betta" },
    { fk_idespeciemascota: 7, gls_raza: "Goldfish (Pez dorado)" },
    { fk_idespeciemascota: 7, gls_raza: "Guppy" },
    { fk_idespeciemascota: 7, gls_raza: "Koi" },
    { fk_idespeciemascota: 7, gls_raza: "Disco" },
    // Tortuga (8)
    { fk_idespeciemascota: 8, gls_raza: "Terrestre" },
    { fk_idespeciemascota: 8, gls_raza: "De agua / Acuática" },
    // Reptil (9)
    { fk_idespeciemascota: 9, gls_raza: "Iguana" },
    { fk_idespeciemascota: 9, gls_raza: "Gecko" },
    { fk_idespeciemascota: 9, gls_raza: "Serpiente" },
  ]);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("raza_mascota");
  await knex.schema.dropTableIfExists("especie_mascota");
};
