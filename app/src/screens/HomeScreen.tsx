import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import {
  getMascotas,
  getMiAdministrador,
  getMiPerfilGuardia,
  getMisResidentesDelHogar,
  getNotificaciones,
  getVacunasMascota,
  personalFinalizarTurno,
  personalGetTurnoActual,
  personalIniciarTurno,
} from "../api/client";
import { AdministradorCondominio, Mascota, PerfilGuardiaPropio, ResidenteAdmin, VacunaMascota } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { colors, radius, spacing, typography } from "../theme/theme";
import { fuenteImagenPrivada } from "../utils/imagenesPrivadas";
import { calcularEdad } from "../utils/validarRut";
import { nacionalidadConBandera } from "../utils/banderas";
import { textoEdadMascota } from "../utils/edadMascota";
import { formatearFecha } from "../utils/fechas";

// Ronda 78, a pedido explícito del usuario, con referencia visual: rediseño
// del Home del residente/propietario (dashboard con tarjeta "Mi hogar",
// accesos rápidos, personas/mascotas del hogar). La referencia que mandó
// tenía algunas cosas que hoy este sistema NO tiene como funcionalidad real
// (autorizar visita, listado de vehículos del residente, gastos comunes
// vistos por el residente) — se mapearon a pantallas que sí existen
// (paquetes, reservas, estacionamiento en arriendo, notificaciones) en vez
// de inventar botones que no llevan a ningún lado.

const PALETA_AVATAR = ["#DCEBFF", "#FFE8CC", "#E4F7D8", "#FBE0E8", "#EAE0FB", "#FFF3B0"];
function colorAvatar(id: number) {
  return PALETA_AVATAR[id % PALETA_AVATAR.length];
}
function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}
function saludoSegunHora(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}
function primerNombre(nombreCompleto?: string | null): string {
  if (!nombreCompleto) return "";
  return nombreCompleto.trim().split(/\s+/)[0];
}

// "Hola, Primer-nombre Apellido-paterno" del guardia. Si el guardia se creó
// antes de separar el nombre, se deduce del nombre completo.
function nombreCortoGuardia(p: PerfilGuardiaPropio | null, completo?: string | null): string {
  if (p?.nombres && p?.apellido_paterno) return `${p.nombres.trim().split(/\s+/)[0]} ${p.apellido_paterno.trim()}`;
  const w = (completo ?? "").trim().split(/\s+/).filter(Boolean);
  if (w.length <= 1) return w[0] ?? "";
  if (w.length === 2) return `${w[0]} ${w[1]}`;
  if (w.length === 3) return `${w[0]} ${w[1]}`;
  return `${w[0]} ${w[2]}`;
}

// Campanita chica con contador de notificaciones sin leer (como en Facebook).
// Si hay sin leer, parpadea para que se note. Al tocarla abre Notificaciones.
function CampanaNotificaciones({ cantidad, onPress }: { cantidad: number; onPress: () => void }) {
  const opacidad = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (cantidad <= 0) {
      opacidad.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacidad, { toValue: 0.25, duration: 550, useNativeDriver: true }),
        Animated.timing(opacidad, { toValue: 1, duration: 550, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [cantidad, opacidad]);
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.campana}>
      <Animated.Text style={[styles.campanaIcono, { opacity: opacidad }]}>🔔</Animated.Text>
      {cantidad > 0 && (
        <Animated.View style={[styles.campanaBadge, { opacity: opacidad }]}>
          <Text style={styles.campanaBadgeTexto}>{cantidad > 9 ? "9+" : cantidad}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

function CajaMenu({ icono, label, onPress }: { icono: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.cajaMenu, pressed && { opacity: 0.8 }]}>
      <Text style={styles.cajaMenuIcono}>{icono}</Text>
      <Text style={styles.cajaMenuTexto}>{label}</Text>
    </Pressable>
  );
}

function AccesoRapido({ icon, label, color, onPress }: { icon: string; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.accesoRapido, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
    >
      <View style={styles.accesoRapidoIcono}>
        <Text style={{ fontSize: 34 }}>{icon}</Text>
      </View>
      <Text style={styles.accesoRapidoLabel}>{label}</Text>
    </Pressable>
  );
}

// Botón de acción reutilizable — reemplaza los ~20 TouchableOpacity con
// estilos casi idénticos que había antes (ronda 24). El feedback al tocar
// (achicarse un poco) usa Pressable, que ya viene con React Native — no
// hacía falta sumar una librería de animaciones para algo tan chico.
function BotonAccion({
  label,
  color,
  onPress,
  disabled,
  chico,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  chico?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.boton,
        chico && styles.botonChico,
        { backgroundColor: color },
        pressed && styles.botonPresionado,
        disabled && styles.botonDeshabilitado,
      ]}
    >
      <Text style={styles.botonTexto}>{label}</Text>
    </Pressable>
  );
}

function EnlaceSecundario({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.enlace, pressed && { opacity: 0.6 }]}>
      <Text style={styles.enlaceTexto}>{label}</Text>
    </Pressable>
  );
}

// Ronda 79, a pedido explícito del usuario: bajo el nombre de cada persona
// del hogar, "RUT · edad · nacionalidad" (lo que haya cargado — todo es
// opcional por persona).
function detallePersona(r: ResidenteAdmin): string | null {
  const edad = calcularEdad(r.fecha_nacimiento);
  // Dos líneas: "RUT · edad" y debajo "nacionalidad · profesión" (un país
  // de nombre largo ya no empuja la bandera a otra línea).
  const linea1 = [r.rut ? `👤 ${r.rut}` : null, edad !== null ? `${edad} años` : null].filter(Boolean).join("  ·  ");
  const linea2 = [nacionalidadConBandera(r.gls_nacionalidad), r.profesion ? `💼 ${r.profesion}` : null]
    .filter(Boolean)
    .join("  ·  ");
  return [linea1, linea2].filter(Boolean).join("\n") || null;
}

// Ronda 79: bajo el nombre de cada mascota — N° de chip, luego "raza · edad"
// y una línea por vacuna (nombre · fecha · vigente/vencida).
function detalleMascota(m: Mascota, vacunas: VacunaMascota[]): string | null {
  const edad = textoEdadMascota(m.fecha_nacimiento);
  const lineas = [
    m.numero_chip ? `Chip: ${m.numero_chip}` : null,
    [m.raza, edad ? `🎂 ${edad}` : null].filter(Boolean).join("  ·  ") || null,
    ...vacunas.map((v) => `💉 ${v.nombre_vacuna} · ${formatearFecha(v.fecha_aplicacion)} · ${v.vigente ? "Vigente" : "Vencida"}`),
  ].filter(Boolean);
  return lineas.length > 0 ? lineas.join("\n") : null;
}

export default function HomeScreen({ navigation }: any) {
  const { token, guardia, rol, esAdmin, esPropietario, logout, nombreCondominioActual } = useAuth();
  // Un residente del comité (esAdmin=true aunque rol="Residente") navega
  // igual que Administrador, no por la rama de Residente.
  const esResidente = rol === "Residente" && !esAdmin;
  // Misma deducción que en Mi hogar: la torre "Casas" = condominio de casas;
  // torre con el nombre del condominio = un solo edificio (no se repite).
  const normNombre = (t?: string | null) => (t ?? "").trim().toLowerCase();
  const esCasas = normNombre(guardia?.nombre_torre) === "casas";
  const esEdificioUnico = !esCasas && normNombre(guardia?.nombre_torre) === normNombre(nombreCondominioActual);
  const etiquetaUnidad = `${esCasas ? "Casa" : "Departamento"} ${guardia?.numero_unidad ?? ""}`;
  const torreVisible = guardia?.nombre_torre && !esCasas && !esEdificioUnico ? guardia.nombre_torre : null;
  const esComite = rol === "Residente" && esAdmin;
  const esPersonal = rol === "Personal";
  const esJefeGuardias = rol === "JefeGuardias";

  // Perfil propio del guardia (foto + nombre corto) para el encabezado del Inicio.
  const esGuardiaRol = rol === "Guardia";
  const [perfilGuardia, setPerfilGuardia] = useState<PerfilGuardiaPropio | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!token || !esGuardiaRol) return;
      getMiPerfilGuardia(token).then(setPerfilGuardia).catch(() => {});
    }, [token, esGuardiaRol])
  );

  // Ronda 16: contador de notificaciones sin leer, para el enlace
  // "Notificaciones" del Home — se refresca cada vez que se vuelve a esta
  // pantalla (ej. después de leerlas), no solo al montar.
  const [noLeidas, setNoLeidas] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      getNotificaciones(token)
        .then((lista) => setNoLeidas(lista.filter((n) => !n.flg_leido).length))
        .catch(() => {});
    }, [token])
  );

  // Ronda 78: personas y mascotas del hogar, para las tarjetas de vista
  // previa del dashboard — mismos endpoints que ya usaba MiHogarScreen
  // (/mi-depto/residentes y /mascotas), solo que acá se muestran resumidos.
  const [residentesHogar, setResidentesHogar] = useState<ResidenteAdmin[]>([]);
  const [mascotasHogar, setMascotasHogar] = useState<Mascota[]>([]);
  const [vacunasHogar, setVacunasHogar] = useState<Record<number, VacunaMascota[]>>({});
  useFocusEffect(
    useCallback(() => {
      if (!token || !esResidente) return;
      Promise.all([getMisResidentesDelHogar(token), getMascotas(token)])
        .then(([r, m]) => {
          setResidentesHogar(r);
          setMascotasHogar(m);
          // Vacunas de cada mascota (si una falla, esa queda sin lista).
          Promise.all(m.map((x) => getVacunasMascota(token, x.id_mascota).catch(() => [] as VacunaMascota[])))
            .then((listas) => {
              const mapa: Record<number, VacunaMascota[]> = {};
              m.forEach((x, i) => (mapa[x.id_mascota] = listas[i]));
              setVacunasHogar(mapa);
            })
            .catch(() => {});
        })
        .catch(() => {});
    }, [token, esResidente])
  );
  // "Mi administrador": se carga al abrir el módulo por primera vez.
  const [adminAbierto, setAdminAbierto] = useState(false);
  const [adminCondo, setAdminCondo] = useState<AdministradorCondominio | null>(null);
  const [adminCargado, setAdminCargado] = useState(false);
  const [adminError, setAdminError] = useState(false);
  const toggleAdmin = () => {
    const abrir = !adminAbierto;
    setAdminAbierto(abrir);
    if (abrir && !adminCargado && token) {
      setAdminError(false);
      getMiAdministrador(token)
        .then((a) => {
          setAdminCondo(a);
          setAdminError(false);
          setAdminCargado(true);
        })
        .catch(() => {
          // No se marca como cargado: al volver a tocar, reintenta.
          setAdminError(true);
        });
    }
  };
  // El propietario siempre va primero; el resto conserva su orden.
  const residentesHogarActivos = residentesHogar
    .filter((r) => r.flg_vigencia)
    .sort((a, b) => Number(!!b.flg_propietario) - Number(!!a.flg_propietario));
  // Ronda 79, a pedido explícito del usuario: la propia foto en el hero del
  // Home — se busca dentro de lo que ya trae /mi-depto/residentes (la
  // misma lista de "Personas del hogar"), no hace falta un endpoint nuevo.
  const yo = residentesHogar.find((r) => r.id_usuario === guardia?.id_usuario);

  const handleAbrirAjustes = () => {
    Alert.alert("Ajustes", undefined, [
      { text: "Mis datos", onPress: () => navigation.navigate("MisDatos") },
      { text: "Cambiar contraseña", onPress: () => navigation.navigate("CambiarPassword") },
      { text: "Cambiar de condominio", onPress: () => navigation.navigate("CambiarCondominio") },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  // Ronda 18: turno del propio Personal — "Empezar turno"/"Marcar salida" es
  // autoservicio (el trabajador lo marca él mismo, no el guardia), así queda
  // registrada la fecha/horario en que estuvo en el condominio. Se refresca
  // al volver a esta pantalla por si se marcó desde otro lado.
  const [turnoActual, setTurnoActual] = useState<{ id_turnopersonal: number } | null>(null);
  const [cargandoTurno, setCargandoTurno] = useState(false);
  const [marcandoTurno, setMarcandoTurno] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!token || !esPersonal) return;
      setCargandoTurno(true);
      personalGetTurnoActual(token)
        .then(setTurnoActual)
        .catch(() => {})
        .finally(() => setCargandoTurno(false));
    }, [token, esPersonal])
  );

  const handleEmpezarTurno = async () => {
    if (!token) return;
    setMarcandoTurno(true);
    try {
      await personalIniciarTurno(token, CONDOMINIO_ID);
      const actual = await personalGetTurnoActual(token);
      setTurnoActual(actual);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setMarcandoTurno(false);
    }
  };

  const handleMarcarSalida = () => {
    Alert.alert("Marcar salida", "¿Confirmas que terminaste tu turno ahora?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Marcar salida",
        onPress: async () => {
          if (!token) return;
          setMarcandoTurno(true);
          try {
            await personalFinalizarTurno(token);
            setTurnoActual(null);
          } catch (e: any) {
            Alert.alert("Error", e.message);
          } finally {
            setMarcandoTurno(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Ronda 78: para el residente el saludo ya va adentro del hero de
          "Mi hogar" (más abajo) — acá arriba solo se muestra para el resto
          de los roles, que no tienen ese hero. */}
      {esGuardiaRol ? (
        <View style={styles.encabezadoGuardia}>
          {fuenteImagenPrivada(perfilGuardia?.foto_url, token) ? (
            <Image source={fuenteImagenPrivada(perfilGuardia?.foto_url, token)!} style={styles.encabezadoGuardiaFoto} />
          ) : (
            <View style={[styles.encabezadoGuardiaFoto, styles.encabezadoGuardiaIniciales]}>
              <Text style={styles.encabezadoGuardiaInicialesTexto}>
                {iniciales(nombreCortoGuardia(perfilGuardia, guardia?.nombre_usuario))}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.encabezadoGuardiaSaludo} numberOfLines={2}>
              Hola, {nombreCortoGuardia(perfilGuardia, guardia?.nombre_usuario)}
            </Text>
            <Text style={styles.encabezadoGuardiaDato}>
              Curso OS10:{" "}
              <Text style={perfilGuardia?.os10_vigente ? styles.datoOk : perfilGuardia?.os10_vigente === 0 || perfilGuardia?.os10_vigente === false ? styles.datoMal : undefined}>
                {perfilGuardia?.os10_vigente === null || perfilGuardia?.os10_vigente === undefined
                  ? "sin definir"
                  : perfilGuardia.os10_vigente
                  ? "Vigente"
                  : "No vigente"}
              </Text>
            </Text>
            <Text style={styles.encabezadoGuardiaDato}>
              {perfilGuardia?.flg_interno === null || perfilGuardia?.flg_interno === undefined
                ? "Interno/externo: sin definir"
                : perfilGuardia.flg_interno
                ? `Interno — ${nombreCondominioActual ?? "condominio"}`
                : `Externo${perfilGuardia.empresa_externa ? ` — ${perfilGuardia.empresa_externa}` : ""}`}
            </Text>
          </View>
        </View>
      ) : (
        !esResidente && <Text style={styles.saludo}>Hola, {guardia?.nombre_usuario}</Text>
      )}
      {esComite && guardia?.nombre_torre && (
        <Text style={styles.subtitulo}>
          {guardia.nombre_torre} · Depto {guardia.numero_unidad} · Comité
        </Text>
      )}

      {esResidente ? (
        <>
          {/* Ronda 78 — hero con saludo + tarjeta "Mi hogar" (rediseño a
              pedido explícito del usuario, con referencia visual) */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroCaption} numberOfLines={1}>{nombreCondominioActual ?? "Mi condominio"}</Text>
              <Pressable style={styles.heroGearPos} onPress={handleAbrirAjustes} hitSlop={10}>
                <Text style={styles.heroGear}>⚙️</Text>
              </Pressable>
            </View>
            <View style={styles.heroRow}>
              {/* Ronda 79, a pedido explícito del usuario: la propia foto
                  (o iniciales si todavía no tiene una cargada) en vez del
                  dibujo de edificios que había antes acá. */}
              {fuenteImagenPrivada(yo?.foto_url, token) ? (
                <Image source={fuenteImagenPrivada(yo?.foto_url, token)!} style={styles.heroAvatarFoto} />
              ) : (
                <View style={[styles.heroAvatar, { backgroundColor: colorAvatar(guardia?.id_usuario ?? 0) }]}>
                  <Text style={styles.heroAvatarTexto}>{iniciales(guardia?.nombre_usuario ?? "")}</Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: spacing.md, justifyContent: "center" }}>
                <Text style={styles.heroSaludo} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {saludoSegunHora()}, {primerNombre(guardia?.nombre_usuario)} 👋
                </Text>
                {guardia?.nombre_torre && (
                  <Text style={styles.heroDepto}>
                    {torreVisible ? `${torreVisible} · ` : ""}
                    {etiquetaUnidad}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.hogarCard, pressed && { opacity: 0.9 }]}
            onPress={() => navigation.navigate("MiHogar")}
          >
            <View style={styles.hogarCardTop}>
              <View style={styles.hogarIconBadge}>
                <Text style={{ fontSize: 20 }}>🏠</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hogarTitulo}>Mi hogar</Text>
                {guardia?.nombre_torre && (
                  <Text style={styles.hogarSubtitulo}>
                    {torreVisible ? `${torreVisible} · ` : ""}
                    {etiquetaUnidad}
                  </Text>
                )}
              </View>
              <Text style={styles.chevronGrande}>›</Text>
            </View>
            <View style={styles.hogarStats}>
              <View style={styles.hogarStat}>
                <View style={[styles.hogarStatBadge, { backgroundColor: "#DCEAFD" }]}>
                  <Text>👥</Text>
                </View>
                <Text style={styles.hogarStatNumero}>{residentesHogarActivos.length}</Text>
                <Text style={styles.hogarStatLabel}>Residentes</Text>
              </View>
              <View style={styles.hogarStat}>
                <View style={[styles.hogarStatBadge, { backgroundColor: "#DCFCE7" }]}>
                  <Text>🐾</Text>
                </View>
                <Text style={styles.hogarStatNumero}>{mascotasHogar.length}</Text>
                <Text style={styles.hogarStatLabel}>
                  Mascota{mascotasHogar.length === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
          </Pressable>

          <Text style={styles.seccionTitulo}>Accesos rápidos</Text>
          <View style={styles.accesosGrid}>
            <AccesoRapido icon="📦" color="#FDE9C8" label="Ver paquetes" onPress={() => navigation.navigate("MisPaquetes")} />
            <AccesoRapido
              icon="📅"
              color="#E4D9FB"
              label="Reservar espacios"
              onPress={() => navigation.navigate("ReservasEspacios")}
            />
            <AccesoRapido
              icon="🅿️"
              color="#DCEAFD"
              label="Estac. en arriendo"
              onPress={() => navigation.navigate("EstacionamientosArriendo")}
            />
            <AccesoRapido icon="🚶" color="#FDE9C8" label="Visitas" onPress={() => navigation.navigate("MisVisitas")} />
            <AccesoRapido icon="📋" color="#E4D9FB" label="Quién viene hoy" onPress={() => navigation.navigate("QuienVieneHoy")} />
            <AccesoRapido
              icon="🔔"
              color="#DCFCE7"
              label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas})` : ""}`}
              onPress={() => navigation.navigate("Notificaciones")}
            />
          </View>

          <View style={styles.filaSeccionConBoton}>
            <Text style={[styles.seccionTitulo, { marginBottom: 0 }]}>Personas del hogar</Text>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <CampanaNotificaciones cantidad={noLeidas} onPress={() => navigation.navigate("Notificaciones")} />
              {esPropietario && (
                <Pressable style={styles.botonAgregarChico} onPress={() => navigation.navigate("MiHogar")}>
                  <Text style={styles.botonAgregarChicoTexto}>+ Agregar integrante</Text>
                </Pressable>
              )}
            </View>
          </View>
          <View style={styles.cardBlanca}>
            {residentesHogarActivos.map((r, i) => (
              <Pressable
                key={r.id_usuario}
                onPress={() => navigation.navigate("MiHogar")}
                style={[styles.filaPersona, i > 0 && styles.filaPersonaConLinea]}
              >
                {fuenteImagenPrivada(r.foto_url, token) ? (
                  <Image source={fuenteImagenPrivada(r.foto_url, token)!} style={styles.avatarFoto} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colorAvatar(r.id_usuario) }]}>
                    <Text style={styles.avatarTexto}>{iniciales(r.nombre_usuario)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.filaPersonaNombre} numberOfLines={1}>
                    {r.nombre_usuario}
                    {r.id_usuario === guardia?.id_usuario ? " (tú)" : ""}
                  </Text>
                  <View style={styles.filaBadges}>
                    {!!r.flg_propietario && (
                      <View style={[styles.badgeChico, { backgroundColor: "#DBEAFE" }]}>
                        <Text style={styles.badgeChicoTexto}>Propietario/a</Text>
                      </View>
                    )}
                    <View style={[styles.badgeChico, { backgroundColor: "#E4F7D8" }]}>
                      <Text style={styles.badgeChicoTexto}>{r.gls_tiporesidente ?? "Sin tipo asignado"}</Text>
                    </View>
                  </View>
                  {detallePersona(r) && <Text style={styles.filaPersonaDetalle}>{detallePersona(r)}</Text>}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.seccionTitulo}>Mascotas del hogar</Text>
          {mascotasHogar.length === 0 ? (
            <View style={styles.cardVacia}>
              <Text style={{ fontSize: 40 }}>🐶 🐱</Text>
              <Text style={styles.vacioTitulo}>Aún no tienes mascotas registradas</Text>
              <Text style={styles.vacioSubtitulo}>
                Registra a tus mascotas para tener un mejor control en el condominio.
              </Text>
              <Pressable style={styles.botonAgregarGrande} onPress={() => navigation.navigate("Mascotas")}>
                <Text style={styles.botonAgregarGrandeTexto}>+ Agregar mascota</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cardBlanca}>
              {mascotasHogar.map((m, i) => (
                <Pressable
                  key={m.id_mascota}
                  onPress={() => navigation.navigate("MascotaDetalle", { mascota: m })}
                  style={[styles.filaPersona, i > 0 && styles.filaPersonaConLinea]}
                >
                  {fuenteImagenPrivada(m.foto_url, token) ? (
                    <Image source={fuenteImagenPrivada(m.foto_url, token)!} style={styles.avatarFoto} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: colorAvatar(m.id_mascota) }]}>
                      <Text style={{ fontSize: 18 }}>🐾</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filaPersonaNombre}>{m.nombre}</Text>
                    {m.especie && (
                      <View style={styles.filaBadges}>
                        <View style={[styles.badgeChico, { backgroundColor: "#FFE8CC" }]}>
                          <Text style={styles.badgeChicoTexto}>{m.especie}</Text>
                        </View>
                      </View>
                    )}
                    {detalleMascota(m, vacunasHogar[m.id_mascota] ?? []) && (
                      <Text style={styles.filaPersonaDetalle}>{detalleMascota(m, vacunasHogar[m.id_mascota] ?? [])}</Text>
                    )}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.banner}>
            <Text style={styles.bannerTexto}>
              ℹ️ Cada persona del hogar puede tener su propio usuario para entrar a la app. Pídele al Administrador
              que le active el acceso.
            </Text>
          </View>

          <View style={styles.modulosFila}>
            <Pressable
              onPress={() => navigation.navigate("MisReservas")}
              style={({ pressed }) => [styles.modulo, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.moduloIcono}>📅</Text>
              <Text style={styles.moduloTitulo}>Ver mis reservas</Text>
            </Pressable>
            <Pressable onPress={toggleAdmin} style={({ pressed }) => [styles.modulo, pressed && { opacity: 0.7 }]}>
              <Text style={styles.moduloIcono}>🛡️</Text>
              <Text style={styles.moduloTitulo}>Mi administrador</Text>
            </Pressable>
          </View>
          {adminAbierto && (
            <View style={styles.adminCard}>
              {adminError ? (
                <Text style={styles.adminDato}>No se pudo cargar la información. Cierra y vuelve a tocar para reintentar.</Text>
              ) : !adminCargado ? (
                <ActivityIndicator color="#000" />
              ) : !adminCondo ? (
                <Text style={styles.adminDato}>Este condominio aún no tiene un administrador asignado.</Text>
              ) : (
                <>
                  {fuenteImagenPrivada(adminCondo.foto_url, token) ? (
                    <Image source={fuenteImagenPrivada(adminCondo.foto_url, token)!} style={styles.adminFoto} />
                  ) : (
                    <View style={[styles.adminFoto, { alignItems: "center", justifyContent: "center" }]}>
                      <Text style={{ fontSize: 40 }}>👤</Text>
                    </View>
                  )}
                  <Text style={styles.adminNombre}>{adminCondo.nombre_usuario}</Text>
                  {adminCondo.numero_registro_rnac ? (
                    <Text style={styles.adminDato}>N° RNAC: {adminCondo.numero_registro_rnac}</Text>
                  ) : null}
                  {adminCondo.telefono ? <Text style={styles.adminDato}>📞 {adminCondo.telefono}</Text> : null}
                  {adminCondo.correo_usuario ? <Text style={styles.adminDato}>✉️ {adminCondo.correo_usuario}</Text> : null}
                </>
              )}
            </View>
          )}
        </>
      ) : esPersonal ? (
        <>
          {cargandoTurno ? (
            <ActivityIndicator size="small" color={colors.gold} style={{ marginBottom: 18 }} />
          ) : turnoActual ? (
            <BotonAccion
              label={marcandoTurno ? "..." : "MARCAR SALIDA"}
              color={colors.danger}
              onPress={handleMarcarSalida}
              disabled={marcandoTurno}
            />
          ) : (
            <BotonAccion
              label={marcandoTurno ? "..." : "EMPEZAR TURNO"}
              color={colors.success}
              onPress={handleEmpezarTurno}
              disabled={marcandoTurno}
            />
          )}
          {turnoActual && <Text style={styles.subtitulo}>Turno en curso</Text>}

          <BotonAccion label="MIS TAREAS" color={colors.navy500} onPress={() => navigation.navigate("PersonalTareas")} />
          <EnlaceSecundario
            label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas})` : ""}`}
            onPress={() => navigation.navigate("Notificaciones")}
          />
        </>
      ) : esJefeGuardias ? (
        <>
          <BotonAccion
            label="TURNOS DE LA SEMANA"
            color={colors.info}
            onPress={() => navigation.navigate("JefeGuardiasTurnos")}
          />
          <BotonAccion
            label="GUARDIAS"
            color={colors.navy500}
            onPress={() => navigation.navigate("JefeGuardiasGuardias")}
          />
        </>
      ) : (
        <>
          <View style={styles.gridMenu}>
            <CajaMenu icono="🚪" label="Visitas" onPress={() => navigation.navigate("VisitasMenu")} />
            <CajaMenu icono="🔎" label="Consulta patente" onPress={() => navigation.navigate("ConsultaPatente")} />
            <CajaMenu icono="📦" label="Paquetes" onPress={() => navigation.navigate("PaquetePendientes")} />
            <CajaMenu icono="📅" label="Reserva área común" onPress={() => navigation.navigate("GuardiaReservas")} />
            <CajaMenu icono="🛠️" label="Mantenciones" onPress={() => navigation.navigate("GuardiaMantenciones")} />
            <CajaMenu icono="🚫" label="Consulta vetados" onPress={() => navigation.navigate("ConsultaVetado")} />
            <CajaMenu icono="🅿️" label="Estacionamientos en arriendo" onPress={() => navigation.navigate("EstacionamientosArriendo")} />
            <CajaMenu icono="📒" label="Bitácora" onPress={() => navigation.navigate("Bitacora")} />
            <CajaMenu icono="🚗" label="Ver disponibilidad de cupos" onPress={() => navigation.navigate("Disponibilidad")} />
            <CajaMenu icono="🏢" label="Cambiar de condominio" onPress={() => navigation.navigate("CambiarCondominio")} />
            <CajaMenu icono="👤" label="Mis datos" onPress={() => navigation.navigate("MisDatos")} />
            <CajaMenu icono="🔑" label="Cambiar contraseña" onPress={() => navigation.navigate("CambiarPassword")} />
          </View>
        </>
      )}

      {/* Ronda 78: para el residente, estos 3 quedaron dentro del ícono de
          ajustes ⚙️ del hero de arriba — se ocultan acá para no duplicarlos.
          Guardia/Personal/JefeGuardias (que no tienen ese ⚙️) los siguen
          viendo igual que antes. */}
      {!esAdmin && !esResidente && !esGuardiaRol && (
        <EnlaceSecundario label="Cambiar de condominio" onPress={() => navigation.navigate("CambiarCondominio")} />
      )}
      {!esAdmin && !esResidente && !esGuardiaRol && <EnlaceSecundario label="Mis datos" onPress={() => navigation.navigate("MisDatos")} />}
      {!esAdmin && !esResidente && !esGuardiaRol && (
        <EnlaceSecundario label="Cambiar contraseña" onPress={() => navigation.navigate("CambiarPassword")} />
      )}

      {!esAdmin && (
        <Pressable onPress={logout} style={({ pressed }) => [styles.cerrarSesion, pressed && { opacity: 0.6 }]}>
          <Text style={styles.cerrarSesionTexto}>Cerrar sesión</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.navy900 },
  saludo: { ...typography.heading, textAlign: "center", marginTop: spacing.sm, marginBottom: 4, color: colors.textOnNavy },
  subtitulo: { ...typography.small, textAlign: "center", marginBottom: spacing.lg, color: colors.textMutedOnNavy },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  tipHint: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  filaResumen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  filaResumenTexto: { ...typography.body, color: colors.textDark },
  badge: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    minWidth: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeVacio: { backgroundColor: colors.border },
  badgeTexto: { color: colors.navy900, fontWeight: "800", fontSize: 12 },
  boton: { borderRadius: radius.lg, paddingVertical: 22, alignItems: "center", marginTop: spacing.md },
  botonChico: { paddingVertical: 16 },
  botonPresionado: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: colors.textOnNavy, fontSize: 17, fontWeight: "800", letterSpacing: 0.4 },
  modulosFila: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  modulo: {
    flex: 1,
    backgroundColor: colors.cardBlue,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  moduloIcono: { fontSize: 26, marginBottom: 6 },
  moduloTitulo: { color: "#000", fontSize: 14, fontWeight: "700", textAlign: "center" },
  adminCard: {
    backgroundColor: colors.cardBlue,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    alignItems: "center",
  },
  adminFoto: { width: 110, height: 110, borderRadius: 55, marginBottom: spacing.md, backgroundColor: colors.cardBlueBorder },
  adminNombre: { color: "#000", fontSize: 18, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  adminDato: { color: "#000", fontSize: 14, marginTop: 3, textAlign: "center" },
  enlace: { marginTop: spacing.md, alignItems: "center" },
  enlaceTexto: { color: colors.goldSoft, fontSize: 14, fontWeight: "600" },
  encabezadoGuardia: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  encabezadoGuardiaFoto: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.navy700 },
  encabezadoGuardiaIniciales: { alignItems: "center", justifyContent: "center", backgroundColor: colors.gold },
  encabezadoGuardiaInicialesTexto: { fontWeight: "800", fontSize: 24, color: colors.navy900 },
  encabezadoGuardiaSaludo: { ...typography.heading, color: colors.textOnNavy },
  encabezadoGuardiaDato: { color: colors.textMutedOnNavy, fontSize: 13, marginTop: 3 },
  datoOk: { color: "#4ADE80", fontWeight: "700" },
  datoMal: { color: "#F87171", fontWeight: "700" },
  gridMenu: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cajaMenu: {
    width: "48.5%",
    minHeight: 96,
    backgroundColor: colors.navy800,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  cajaMenuIcono: { fontSize: 28 },
  cajaMenuTexto: { color: colors.textOnNavy, fontSize: 13, fontWeight: "700", textAlign: "center" },
  cerrarSesion: { marginTop: spacing.lg, alignItems: "center" },
  cerrarSesionTexto: { color: colors.textMutedOnNavy, fontSize: 13 },

  // Ronda 78 — hero "Mi Condominio" + saludo, con referencia visual
  heroCard: { marginBottom: spacing.lg },
  heroTopRow: { alignItems: "center", justifyContent: "center", marginBottom: spacing.sm, minHeight: 24 },
  heroCaption: { color: colors.textMutedOnNavy, fontSize: 12, fontWeight: "700", textAlign: "center", marginHorizontal: 32 },
  heroGearPos: { position: "absolute", right: 0, top: 0 },
  heroGear: { fontSize: 20 },
  heroRow: { flexDirection: "row", alignItems: "center" },
  heroAvatar: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center" },
  heroAvatarTexto: { fontWeight: "800", fontSize: 30, color: colors.navy900 },
  heroAvatarFoto: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.navy700 },
  heroCondominio: { ...typography.title, color: colors.textOnNavy },
  heroSaludo: { color: colors.textOnNavy, fontSize: 20, fontWeight: "800" },
  heroDepto: { color: colors.textMutedOnNavy, fontSize: 17, fontWeight: "700", marginTop: 6 },

  // Tarjeta "Mi hogar" tappable, con stats de residentes/mascotas
  hogarCard: { backgroundColor: colors.cardBlue, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  hogarCardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  hogarIconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  hogarTitulo: { fontSize: 17, fontWeight: "800", color: colors.textDark },
  hogarSubtitulo: { color: colors.textMuted, fontSize: 13, marginTop: 1 },
  chevronGrande: { color: colors.textMuted, fontSize: 26, fontWeight: "300" },
  hogarStats: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBlueBorder,
  },
  hogarStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  hogarStatBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hogarStatNumero: { fontSize: 16, fontWeight: "800", color: colors.textDark },
  hogarStatLabel: { fontSize: 12, color: colors.textMuted },

  // Accesos rápidos (grilla 2x2)
  seccionTitulo: { ...typography.heading, color: colors.textOnNavy, fontSize: 16, marginBottom: spacing.sm },
  filaSeccionConBoton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  accesosGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  accesoRapido: {
    width: "47%",
    backgroundColor: colors.cardBlue,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  accesoRapidoIcono: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  accesoRapidoLabel: { color: colors.textDark, fontWeight: "800", fontSize: 14, textAlign: "center" },

  // Personas / mascotas del hogar (preview, se edita entrando a "Mi hogar")
  campana: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.navy800, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.navy600 },
  campanaIcono: { fontSize: 16 },
  campanaBadge: { position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#E11D48", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  campanaBadgeTexto: { color: "#fff", fontSize: 10, fontWeight: "800" },
  botonAgregarChico: { backgroundColor: colors.botonNaranja, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.botonNaranjaBorde, elevation: 3, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  botonAgregarChicoTexto: { color: colors.botonNaranjaTexto, fontWeight: "800", fontSize: 12 },
  cardBlanca: { backgroundColor: colors.cardBlue, borderRadius: radius.lg, marginBottom: spacing.md, overflow: "hidden" },
  filaPersona: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  filaPersonaConLinea: { borderTopWidth: 1, borderTopColor: colors.cardBlueBorder },
  filaPersonaNombre: { fontSize: 14, fontWeight: "700", color: colors.textDark },
  filaPersonaDetalle: { fontSize: 12, fontWeight: "700", color: "#344054", marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarTexto: { fontWeight: "800", fontSize: 15, color: colors.navy900 },
  avatarFoto: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.offWhite },
  filaBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  badgeChico: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 },
  badgeChicoTexto: { fontSize: 10, fontWeight: "700", color: colors.textDark },
  chevron: { color: colors.textMuted, fontSize: 18, fontWeight: "300" },

  cardVacia: {
    backgroundColor: colors.cardBlue,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  vacioTitulo: { fontSize: 15, fontWeight: "800", color: colors.textDark, marginTop: spacing.sm, textAlign: "center" },
  vacioSubtitulo: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  botonAgregarGrande: {
    backgroundColor: colors.botonNaranja,
    borderWidth: 1,
    borderColor: colors.botonNaranjaBorde,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: spacing.md,
  },
  botonAgregarGrandeTexto: { color: colors.botonNaranjaTexto, fontWeight: "800", fontSize: 13 },

  banner: { backgroundColor: colors.navy700, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  bannerTexto: { color: colors.textOnNavy, fontSize: 12, lineHeight: 18 },
});
