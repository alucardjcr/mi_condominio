import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { getNotificaciones, personalFinalizarTurno, personalGetTurnoActual, personalIniciarTurno } from "../api/client";
import { CONDOMINIO_ID } from "../config/api";
import { colors, radius, spacing, typography } from "../theme/theme";

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
  const { token, guardia, rol, esAdmin, esPropietario, logout } = useAuth();
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
      <Text style={styles.saludo}>Hola, {guardia?.nombre_usuario}</Text>
      {(esResidente || esComite) && guardia?.nombre_torre && (
        <Text style={styles.subtitulo}>
          {guardia.nombre_torre} · Depto {guardia.numero_unidad}
          {esComite ? " · Comité" : ""}
        </Text>
      )}

      {esAdmin ? (
        // Ronda 24: en modo Administrador los módulos se navegan desde el
        // menú lateral (☰, arriba a la izquierda) — acá solo queda un
        // resumen rápido, no la lista de ~19 botones que había antes.
        <View style={styles.card}>
          <Text style={styles.tipHint}>Usa el menú ☰ (arriba a la izquierda) para ir a cualquier módulo.</Text>
          <Pressable
            onPress={() => navigation.navigate("Notificaciones")}
            style={({ pressed }) => [styles.filaResumen, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.filaResumenTexto}>Notificaciones</Text>
            <View style={[styles.badge, noLeidas === 0 && styles.badgeVacio]}>
              <Text style={styles.badgeTexto}>{noLeidas}</Text>
            </View>
          </Pressable>
        </View>
      ) : esResidente ? (
        <>
          <BotonAccion label="MIS PAQUETES" color={colors.navy500} onPress={() => navigation.navigate("MisPaquetes")} />
          <BotonAccion
            label="RESERVAR ESPACIO COMÚN"
            color={colors.warning}
            onPress={() => navigation.navigate("ReservasEspacios")}
          />
          <EnlaceSecundario label="Ver mis reservas" onPress={() => navigation.navigate("MisReservas")} />

          {esPropietario && (
            <BotonAccion
              label="ADMINISTRAR MI HOGAR"
              color={colors.navy600}
              onPress={() => navigation.navigate("MiHogar")}
            />
          )}

          <BotonAccion
            label="ESTACIONAMIENTO EN ARRIENDO"
            color={colors.info}
            onPress={() => navigation.navigate("EstacionamientosArriendo")}
          />
          <EnlaceSecundario label="Mis mascotas" onPress={() => navigation.navigate("Mascotas")} />
          <EnlaceSecundario
            label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas})` : ""}`}
            onPress={() => navigation.navigate("Notificaciones")}
          />
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

      {!esAdmin && (
        <EnlaceSecundario label="Cambiar de condominio" onPress={() => navigation.navigate("CambiarCondominio")} />
      )}
      {!esAdmin && <EnlaceSecundario label="Cambiar contraseña" onPress={() => navigation.navigate("CambiarPassword")} />}

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
});
