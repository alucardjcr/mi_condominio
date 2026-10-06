// Ronda 79, a pedido explícito del usuario: en vez del ícono 🌎, mostrar la
// bandera del país de la nacionalidad del residente. El catálogo
// (tabla nacionalidad) guarda el nombre del país en español, así que se
// traduce a su código ISO 3166-1 y de ahí al emoji de bandera (dos letras
// "regionales" juntas). Si algún nombre no está en la tabla, cae a 🌎.

const ISO_POR_PAIS: Record<string, string> = {
  "Chile": "CL", "Argentina": "AR", "Perú": "PE", "Bolivia": "BO", "Colombia": "CO", "Ecuador": "EC",
  "Venezuela": "VE", "Paraguay": "PY", "Uruguay": "UY", "Brasil": "BR", "México": "MX",
  "Estados Unidos": "US", "Canadá": "CA", "Cuba": "CU", "República Dominicana": "DO", "Haití": "HT",
  "Jamaica": "JM", "Bahamas": "BS", "Trinidad y Tobago": "TT", "Barbados": "BB", "Granada": "GD",
  "San Vicente y las Granadinas": "VC", "Santa Lucía": "LC", "Dominica": "DM", "Antigua y Barbuda": "AG",
  "San Cristóbal y Nieves": "KN", "Belice": "BZ", "Guatemala": "GT", "Honduras": "HN", "El Salvador": "SV",
  "Nicaragua": "NI", "Costa Rica": "CR", "Panamá": "PA", "Guyana": "GY", "Surinam": "SR",
  "España": "ES", "Francia": "FR", "Alemania": "DE", "Italia": "IT", "Reino Unido": "GB", "Portugal": "PT",
  "Países Bajos": "NL", "Bélgica": "BE", "Suiza": "CH", "Austria": "AT", "Irlanda": "IE", "Suecia": "SE",
  "Noruega": "NO", "Dinamarca": "DK", "Finlandia": "FI", "Islandia": "IS", "Polonia": "PL",
  "República Checa": "CZ", "Eslovaquia": "SK", "Hungría": "HU", "Rumania": "RO", "Bulgaria": "BG",
  "Grecia": "GR", "Croacia": "HR", "Eslovenia": "SI", "Serbia": "RS", "Bosnia y Herzegovina": "BA",
  "Montenegro": "ME", "Macedonia del Norte": "MK", "Albania": "AL", "Kosovo": "XK", "Moldavia": "MD",
  "Ucrania": "UA", "Rusia": "RU", "Bielorrusia": "BY", "Lituania": "LT", "Letonia": "LV", "Estonia": "EE",
  "Luxemburgo": "LU", "Malta": "MT", "Chipre": "CY", "Mónaco": "MC", "Liechtenstein": "LI", "Andorra": "AD",
  "San Marino": "SM", "Vaticano": "VA",
  "China": "CN", "Japón": "JP", "Corea del Sur": "KR", "Corea del Norte": "KP", "India": "IN",
  "Pakistán": "PK", "Bangladés": "BD", "Sri Lanka": "LK", "Nepal": "NP", "Bután": "BT", "Maldivas": "MV",
  "Afganistán": "AF", "Irán": "IR", "Irak": "IQ", "Arabia Saudita": "SA", "Emiratos Árabes Unidos": "AE",
  "Catar": "QA", "Kuwait": "KW", "Baréin": "BH", "Omán": "OM", "Yemen": "YE", "Jordania": "JO",
  "Líbano": "LB", "Siria": "SY", "Israel": "IL", "Palestina": "PS", "Turquía": "TR", "Georgia": "GE",
  "Armenia": "AM", "Azerbaiyán": "AZ", "Kazajistán": "KZ", "Uzbekistán": "UZ", "Turkmenistán": "TM",
  "Kirguistán": "KG", "Tayikistán": "TJ", "Mongolia": "MN", "Taiwán": "TW", "Vietnam": "VN", "Laos": "LA",
  "Camboya": "KH", "Tailandia": "TH", "Myanmar": "MM", "Malasia": "MY", "Singapur": "SG", "Indonesia": "ID",
  "Filipinas": "PH", "Brunéi": "BN", "Timor Oriental": "TL",
  "Australia": "AU", "Nueva Zelanda": "NZ", "Papúa Nueva Guinea": "PG", "Fiyi": "FJ", "Islas Salomón": "SB",
  "Vanuatu": "VU", "Samoa": "WS", "Tonga": "TO", "Kiribati": "KI", "Micronesia": "FM", "Palaos": "PW",
  "Islas Marshall": "MH", "Nauru": "NR", "Tuvalu": "TV",
  "Egipto": "EG", "Libia": "LY", "Túnez": "TN", "Argelia": "DZ", "Marruecos": "MA", "Mauritania": "MR",
  "Malí": "ML", "Níger": "NE", "Chad": "TD", "Sudán": "SD", "Sudán del Sur": "SS", "Etiopía": "ET",
  "Eritrea": "ER", "Yibuti": "DJ", "Somalia": "SO", "Kenia": "KE", "Uganda": "UG", "Tanzania": "TZ",
  "Ruanda": "RW", "Burundi": "BI", "República Democrática del Congo": "CD", "República del Congo": "CG",
  "Gabón": "GA", "Guinea Ecuatorial": "GQ", "Camerún": "CM", "República Centroafricana": "CF",
  "Nigeria": "NG", "Benín": "BJ", "Togo": "TG", "Ghana": "GH", "Costa de Marfil": "CI", "Liberia": "LR",
  "Sierra Leona": "SL", "Guinea": "GN", "Guinea-Bisáu": "GW", "Senegal": "SN", "Gambia": "GM",
  "Cabo Verde": "CV", "Santo Tomé y Príncipe": "ST", "Angola": "AO", "Zambia": "ZM", "Malaui": "MW",
  "Mozambique": "MZ", "Zimbabue": "ZW", "Botsuana": "BW", "Namibia": "NA", "Sudáfrica": "ZA",
  "Lesoto": "LS", "Esuatini": "SZ", "Madagascar": "MG", "Mauricio": "MU", "Seychelles": "SC",
  "Comoras": "KM", "Burkina Faso": "BF",
};

export function banderaDePais(nombre: string | null | undefined): string {
  const iso = nombre ? ISO_POR_PAIS[nombre.trim()] : undefined;
  if (!iso) return "🌎";
  return String.fromCodePoint(...iso.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// "🇨🇱 Chile" — para las líneas de detalle de personas.
export function nacionalidadConBandera(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  return `${banderaDePais(nombre)} ${nombre}`;
}
