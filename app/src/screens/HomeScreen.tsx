import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import {
  getMascotas,
  getMisResidentesDelHogar,
  getNotificaciones,
  personalFinalizarTurno,
  personalGetTurnoActual,
  personalIniciarTurno,
} from "../api/client";
import { Mascota, ResidenteAdmin } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { colors, radius, spacing, typography } from "../theme/theme";
import IlustracionEdificios from "../components/IlustracionEdificios";
import { fuenteImagenPrivada } from "../utils/imagenesPrivadas";

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

function AccesoRapido({ icon, label, color, onPress }: { icon: string; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.accesoRapido, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
    >
      <View style={[styles.accesoRapidoIcono, { backgroundColor: color }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
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

export default function HomeScreen({ navigation }: any) {
  const { token, guardia, rol, esAdmin, esPropietario, logout, nombreCondominioActual } = useAuth();
  // Un residente del comité (esAdmin=true aunque rol="Residente") navega
  // igual que Administrador, no por la rama de Residente.
  const esResidente = rol === "Residente" && !esAdmin;
  const esComite = rol === "Residente" && esAdmin;
  const esPersonal = rol === "Personal";
  const esJefeGuardias = rol === "JefeGuardias";

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
  useFocusEffect(
    useCallback(() => {
      if (!token || !esResidente) return;
      Promise.all([getMisResidentesDelHogar(token), getMascotas(token)])
        .then(([r, m]) => {
          setResidentesHogar(r);
          setMascotasHogar(m);
        })
        .catch(() => {});
    }, [token, esResidente])
  );
  const residentesHogarActivos = residentesHogar.filter((r) => r.flg_vigencia);

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
      {!esResidente && <Text style={styles.saludo}>Hola, {guardia?.nombre_usuario}</Text>}
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
              <Text style={styles.heroCaption}>🏢 Mi Condominio</Text>
              <Pressable onPress={handleAbrirAjustes} hitSlop={10}>
                <Text style={styles.heroGear}>⚙️</Text>
              </Pressable>
            </View>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroCondominio}>{nombreCondominioActual ?? "Mi condominio"}</Text>
                <Text style={styles.heroSaludo}>
                  {saludoSegunHora()}, {primerNombre(guardia?.nombre_usuario)} 👋
                </Text>
                {guardia?.nombre_torre && (
                  <Text style={styles.heroDepto}>
                    {guardia.nombre_torre} · Departamento {guardia.numero_unidad}
                  </Text>
                )}
              </View>
              <IlustracionEdificios size={84} />
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
                <Text style={styles.hogarSubtitulo}>{nombreCondominioActual ?? "Mi condominio"}</Text>
                {guardia?.nombre_torre && (
                  <Text style={styles.hogarSubtitulo}>
                    {guardia.nombre_torre} · Departamento {guardia.numero_unidad}
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
            <AccesoRapido
              icon="🔔"
              color="#DCFCE7"
              label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas})` : ""}`}
              onPress={() => navigation.navigate("Notificaciones")}
            />
          </View>

          <View style={styles.filaSeccionConBoton}>
            <Text style={styles.seccionTitulo}>Personas del hogar</Text>
            {esPropietario && (
              <Pressable style={styles.botonAgregarChico} onPress={() => navigation.navigate("MiHogar")}>
                <Text style={styles.botonAgregarChicoTexto}>+ Agregar integrante</Text>
              </Pressable>
            )}
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
                  <View style={[styles.avatar, { backgroundColor: colorAvatar(m.id_mascota) }]}>
                    <Text style={{ fontSize: 18 }}>🐾</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filaPersonaNombre}>{m.nombre}</Text>
                    {m.especie && (
                      <View style={styles.filaBadges}>
                        <View style={[styles.badgeChico, { backgroundColor: "#FFE8CC" }]}>
                          <Text style={styles.badgeChicoTexto}>{m.especie}</Text>
                        </View>
                      </View>
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

          <EnlaceSecundario label="Ver mis reservas" onPress={() => navigation.navigate("MisReservas")} />
          <EnlaceSecundario label="Quién viene hoy" onPress={() => navigation.navigate("QuienVieneHoy")} />
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
          <BotonAccion label="VISITAS" color={colors.success} onPress={() => navigation.navigate("VisitasMenu")} />
          <BotonAccion
            label="CONSULTA PATENTE"
            color={colors.info}
            onPress={() => navigation.navigate("ConsultaPatente")}
          />
          <BotonAccion
            label="PAQUETES"
            color={colors.navy500}
            onPress={() => navigation.navigate("PaquetePendientes")}
          />
          <BotonAccion
            label="RESERVA ÁREA COMÚN"
            color={colors.warning}
            onPress={() => navigation.navigate("GuardiaReservas")}
          />
          <BotonAccion
            label="MANTENCIONES"
            color={colors.navy600}
            onPress={() => navigation.navigate("GuardiaMantenciones")}
          />
          <BotonAccion
            label="CONSULTA VETADOS"
            color={colors.danger}
            onPress={() => navigation.navigate("ConsultaVetado")}
          />
          <EnlaceSecundario
            label="Estacionamientos en arriendo"
            onPress={() => navigation.navigate("EstacionamientosArriendo")}
          />
          <EnlaceSecundario label="Bitácora" onPress={() => navigation.navigate("Bitacora")} />
          <EnlaceSecundario label="Ver disponibilidad de cupos" onPress={() => navigation.navigate("Disponibilidad")} />
        </>
      )}

      {/* Ronda 78: para el residente, estos 3 quedaron dentro del ícono de
          ajustes ⚙️ del hero de arriba — se ocultan acá para no duplicarlos.
          Guardia/Personal/JefeGuardias (que no tienen ese ⚙️) los siguen
          viendo igual que antes. */}
      {!esAdmin && !esResidente && (
        <EnlaceSecundario label="Cambiar de condominio" onPress={() => navigation.navigate("CambiarCondominio")} />
      )}
      {!esAdmin && !esResidente && <EnlaceSecundario label="Mis datos" onPress={() => navigation.navigate("MisDatos")} />}
      {!esAdmin && !esResidente && (
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
  enlace: { marginTop: spacing.md, alignItems: "center" },
  enlaceTexto: { color: colors.goldSoft, fontSize: 14, fontWeight: "600" },
  cerrarSesion: { marginTop: spacing.lg, alignItems: "center" },
  cerrarSesionTexto: { color: colors.textMutedOnNavy, fontSize: 13 },

  // Ronda 78 — hero "Mi Condominio" + saludo, con referencia visual
  heroCard: { marginBottom: spacing.sm },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  heroCaption: { color: colors.textMutedOnNavy, fontSize: 12, fontWeight: "700" },
  heroGear: { fontSize: 20 },
  heroRow: { flexDirection: "row", alignItems: "center" },
  heroCondominio: { ...typography.title, color: colors.textOnNavy },
  heroSaludo: { color: colors.textOnNavy, fontSize: 15, fontWeight: "600", marginTop: 4 },
  heroDepto: { color: colors.textMutedOnNavy, fontSize: 13, marginTop: 4 },

  // Tarjeta "Mi hogar" tappable, con stats de residentes/mascotas
  hogarCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  hogarCardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  hogarIconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.skyBadge,
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
    borderTopColor: colors.border,
  },
  hogarStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  hogarStatBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hogarStatNumero: { fontSize: 16, fontWeight: "800", color: colors.textDark },
  hogarStatLabel: { fontSize: 12, color: colors.textMuted },

  // Accesos rápidos (grilla 2x2)
  seccionTitulo: { ...typography.heading, color: colors.textOnNavy, fontSize: 16, marginBottom: spacing.sm },
  filaSeccionConBoton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  accesosGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  accesoRapido: {
    width: "47%",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "flex-start",
  },
  accesoRapidoIcono: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  accesoRapidoLabel: { color: colors.textDark, fontWeight: "700", fontSize: 13 },

  // Personas / mascotas del hogar (preview, se edita entrando a "Mi hogar")
  botonAgregarChico: { backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  botonAgregarChicoTexto: { color: colors.navy900, fontWeight: "800", fontSize: 11 },
  cardBlanca: { backgroundColor: colors.white, borderRadius: radius.lg, marginBottom: spacing.md, overflow: "hidden" },
  filaPersona: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  filaPersonaConLinea: { borderTopWidth: 1, borderTopColor: colors.border },
  filaPersonaNombre: { fontSize: 14, fontWeight: "700", color: colors.textDark },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarTexto: { fontWeight: "800", fontSize: 15, color: colors.navy900 },
  avatarFoto: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.offWhite },
  filaBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  badgeChico: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 },
  badgeChicoTexto: { fontSize: 10, fontWeight: "700", color: colors.textDark },
  chevron: { color: colors.textMuted, fontSize: 18, fontWeight: "300" },

  cardVacia: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  vacioTitulo: { fontSize: 15, fontWeight: "800", color: colors.textDark, marginTop: spacing.sm, textAlign: "center" },
  vacioSubtitulo: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  botonAgregarGrande: {
    borderWidth: 1.5,
    borderColor: colors.navy900,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: spacing.md,
  },
  botonAgregarGrandeTexto: { color: colors.navy900, fontWeight: "800", fontSize: 13 },

  banner: { backgroundColor: colors.navy700, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  bannerTexto: { color: colors.textOnNavy, fontSize: 12, lineHeight: 18 },
});
