import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { getNotificaciones, personalFinalizarTurno, personalGetTurnoActual, personalIniciarTurno } from "../api/client";
import { CONDOMINIO_ID } from "../config/api";

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
      <Text
        style={[styles.saludo, (esResidente || esComite) && guardia?.nombre_torre ? { marginBottom: 4 } : null]}
      >
        Hola, {guardia?.nombre_usuario}
      </Text>
      {(esResidente || esComite) && guardia?.nombre_torre && (
        <Text style={styles.subtituloDepto}>
          {guardia.nombre_torre} · Depto {guardia.numero_unidad}
          {esComite ? " · Comité" : ""}
        </Text>
      )}

      {esResidente ? (
        <>
          <TouchableOpacity
            style={[styles.boton, styles.botonPaquetes]}
            onPress={() => navigation.navigate("MisPaquetes")}
          >
            <Text style={styles.botonTexto}>MIS PAQUETES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonReservas]}
            onPress={() => navigation.navigate("ReservasEspacios")}
          >
            <Text style={styles.botonTexto}>RESERVAR ESPACIO COMÚN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enlaceDisponibilidad}
            onPress={() => navigation.navigate("MisReservas")}
          >
            <Text style={styles.enlaceDisponibilidadTexto}>Ver mis reservas</Text>
          </TouchableOpacity>

          {esPropietario && (
            <TouchableOpacity
              style={[styles.boton, styles.botonHogar]}
              onPress={() => navigation.navigate("MiHogar")}
            >
              <Text style={styles.botonTexto}>ADMINISTRAR MI HOGAR</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.boton, styles.botonArriendo]}
            onPress={() => navigation.navigate("EstacionamientosArriendo")}
          >
            <Text style={styles.botonTexto}>ESTACIONAMIENTO EN ARRIENDO</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enlaceDisponibilidad}
            onPress={() => navigation.navigate("Mascotas")}
          >
            <Text style={styles.enlaceDisponibilidadTexto}>Mis mascotas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enlaceDisponibilidad}
            onPress={() => navigation.navigate("Notificaciones")}
          >
            <Text style={styles.enlaceDisponibilidadTexto}>
              Notificaciones{noLeidas > 0 ? ` (${noLeidas})` : ""}
            </Text>
          </TouchableOpacity>
        </>
      ) : esAdmin ? (
        <>
          <TouchableOpacity
            style={[styles.boton, styles.botonAdmin]}
            onPress={() => navigation.navigate("AdminGuardias")}
          >
            <Text style={styles.botonTexto}>GUARDIAS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonAdmin]}
            onPress={() => navigation.navigate("AdminResidentes")}
          >
            <Text style={styles.botonTexto}>RESIDENTES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonAdmin]}
            onPress={() => navigation.navigate("AdminPatentes")}
          >
            <Text style={styles.botonTexto}>PATENTES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonAdmin]}
            onPress={() => navigation.navigate("AdminAuditoria")}
          >
            <Text style={styles.botonTexto}>AUDITORÍA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonAdmin]}
            onPress={() => navigation.navigate("AdminReporteGastoComun")}
          >
            <Text style={styles.botonTexto}>REPORTE GASTO COMÚN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonAdmin]}
            onPress={() => navigation.navigate("PaqueteBusqueda")}
          >
            <Text style={styles.botonTexto}>PAQUETES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonAdmin]}
            onPress={() => navigation.navigate("AdminReservas")}
          >
            <Text style={styles.botonTexto}>RESERVAS ESPACIOS COMUNES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonAdmin]}
            onPress={() => navigation.navigate("AdminEspacios")}
          >
            <Text style={styles.botonTexto}>CONFIGURAR ESPACIOS COMUNES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonComunicados]}
            onPress={() => navigation.navigate("AdminComunicados")}
          >
            <Text style={styles.botonTexto}>ENVIAR COMUNICADO</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonGastoComun]}
            onPress={() => navigation.navigate("AdminGastoComun")}
          >
            <Text style={styles.botonTexto}>GASTO COMÚN POR DEPTO</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonPersonal]}
            onPress={() => navigation.navigate("AdminPersonal")}
          >
            <Text style={styles.botonTexto}>PERSONAL EXTERNO</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonMantenciones]}
            onPress={() => navigation.navigate("AdminMantenciones")}
          >
            <Text style={styles.botonTexto}>MANTENCIONES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonArriendo]}
            onPress={() => navigation.navigate("EstacionamientosArriendo")}
          >
            <Text style={styles.botonTexto}>ESTACIONAMIENTOS EN ARRIENDO</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonVetados]}
            onPress={() => navigation.navigate("AdminVetados")}
          >
            <Text style={styles.botonTexto}>VETADOS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enlaceDisponibilidad}
            onPress={() => navigation.navigate("Bitacora")}
          >
            <Text style={styles.enlaceDisponibilidadTexto}>Bitácora de guardias</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enlaceDisponibilidad}
            onPress={() => navigation.navigate("Mascotas")}
          >
            <Text style={styles.enlaceDisponibilidadTexto}>Mascotas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enlaceDisponibilidad}
            onPress={() => navigation.navigate("Disponibilidad")}
          >
            <Text style={styles.enlaceDisponibilidadTexto}>Ver disponibilidad de cupos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enlaceDisponibilidad}
            onPress={() => navigation.navigate("Notificaciones")}
          >
            <Text style={styles.enlaceDisponibilidadTexto}>
              Notificaciones{noLeidas > 0 ? ` (${noLeidas})` : ""}
            </Text>
          </TouchableOpacity>
        </>
      ) : esPersonal ? (
        <>
          {cargandoTurno ? (
            <ActivityIndicator size="small" style={{ marginBottom: 18 }} />
          ) : turnoActual ? (
            <TouchableOpacity
              style={[styles.boton, styles.botonSalida]}
              onPress={handleMarcarSalida}
              disabled={marcandoTurno}
            >
              <Text style={styles.botonTexto}>{marcandoTurno ? "..." : "MARCAR SALIDA"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.boton, styles.botonEntrada]}
              onPress={handleEmpezarTurno}
              disabled={marcandoTurno}
            >
              <Text style={styles.botonTexto}>{marcandoTurno ? "..." : "EMPEZAR TURNO"}</Text>
            </TouchableOpacity>
          )}
          {turnoActual && <Text style={styles.subtituloDepto}>Turno en curso</Text>}

          <TouchableOpacity
            style={[styles.boton, styles.botonPaquetes]}
            onPress={() => navigation.navigate("PersonalTareas")}
          >
            <Text style={styles.botonTexto}>MIS TAREAS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enlaceDisponibilidad}
            onPress={() => navigation.navigate("Notificaciones")}
          >
            <Text style={styles.enlaceDisponibilidadTexto}>
              Notificaciones{noLeidas > 0 ? ` (${noLeidas})` : ""}
            </Text>
          </TouchableOpacity>
        </>
      ) : esJefeGuardias ? (
        <>
          <TouchableOpacity
            style={[styles.boton, styles.botonArriendo]}
            onPress={() => navigation.navigate("JefeGuardiasTurnos")}
          >
            <Text style={styles.botonTexto}>TURNOS DE LA SEMANA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonAdmin]}
            onPress={() => navigation.navigate("JefeGuardiasGuardias")}
          >
            <Text style={styles.botonTexto}>GUARDIAS</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.boton, styles.botonEntrada]}
            onPress={() => navigation.navigate("Entrada")}
          >
            <Text style={styles.botonTexto}>ENTRADA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonSalida]}
            onPress={() => navigation.navigate("Salida")}
          >
            <Text style={styles.botonTexto}>SALIDA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonConsulta]}
            onPress={() => navigation.navigate("ConsultaPatente")}
          >
            <Text style={styles.botonTexto}>CONSULTA PATENTE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonPaquetes]}
            onPress={() => navigation.navigate("PaquetePendientes")}
          >
            <Text style={styles.botonTexto}>PAQUETES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonReservas]}
            onPress={() => navigation.navigate("GuardiaReservas")}
          >
            <Text style={styles.botonTexto}>RESERVA ÁREA COMÚN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonMantenciones, { paddingVertical: 26 }]}
            onPress={() => navigation.navigate("GuardiaMantenciones")}
          >
            <Text style={styles.botonTexto}>MANTENCIONES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, styles.botonVetados, { paddingVertical: 26 }]}
            onPress={() => navigation.navigate("ConsultaVetado")}
          >
            <Text style={styles.botonTexto}>CONSULTA VETADOS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enlaceDisponibilidad}
            onPress={() => navigation.navigate("EstacionamientosArriendo")}
          >
            <Text style={styles.enlaceDisponibilidadTexto}>Estacionamientos en arriendo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enlaceDisponibilidad}
            onPress={() => navigation.navigate("Bitacora")}
          >
            <Text style={styles.enlaceDisponibilidadTexto}>Bitácora</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enlaceDisponibilidad}
            onPress={() => navigation.navigate("Disponibilidad")}
          >
            <Text style={styles.enlaceDisponibilidadTexto}>Ver disponibilidad de cupos</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={styles.enlaceDisponibilidad}
        onPress={() => navigation.navigate("CambiarPassword")}
      >
        <Text style={styles.enlaceDisponibilidadTexto}>Cambiar contraseña</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cerrarSesion} onPress={logout}>
        <Text style={styles.cerrarSesionTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff" },
  saludo: { fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 32, color: "#333" },
  subtituloDepto: { fontSize: 14, textAlign: "center", marginBottom: 28, color: "#888" },
  boton: { borderRadius: 14, paddingVertical: 26, alignItems: "center", marginBottom: 18 },
  botonEntrada: { backgroundColor: "#1a9d5c" },
  botonSalida: { backgroundColor: "#c0392b" },
  botonConsulta: { backgroundColor: "#1a6fc4" },
  botonPaquetes: { backgroundColor: "#8e44ad" },
  botonReservas: { backgroundColor: "#d97706" },
  botonHogar: { backgroundColor: "#0f766e" },
  botonAdmin: { backgroundColor: "#333", paddingVertical: 20 },
  botonComunicados: { backgroundColor: "#b0730a", paddingVertical: 20 },
  botonGastoComun: { backgroundColor: "#5a5a8f", paddingVertical: 20 },
  botonPersonal: { backgroundColor: "#2e7d32", paddingVertical: 20 },
  botonMantenciones: { backgroundColor: "#795548", paddingVertical: 20 },
  botonArriendo: { backgroundColor: "#0e7490", paddingVertical: 20 },
  botonVetados: { backgroundColor: "#7f1d1d", paddingVertical: 20 },
  botonTexto: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 0.5 },
  enlaceDisponibilidad: { marginTop: 8, alignItems: "center" },
  enlaceDisponibilidadTexto: { color: "#1a6fc4", fontSize: 14, fontWeight: "600" },
  cerrarSesion: { marginTop: 24, alignItems: "center" },
  cerrarSesionTexto: { color: "#999", fontSize: 13 },
});
