import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { eliminarCondominio, getMisCondominios } from "../api/client";
import { CondominioOpcion } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme/theme";

// Ronda 26 (fase 2): para CUALQUIER usuario ya logeado (Guardia, Residente,
// Personal, JefeGuardias o Administrador) que quiere pasarse a OTRO de sus
// condominios sin desloguearse — a diferencia de SeleccionarCondominioScreen
// (que se ve solo en el login inicial, con la lista que ya trajo el login),
// acá la lista se pide de nuevo porque puede haber cambiado (ej. recién
// creó un condominio nuevo). El botón "+ Crear nuevo condominio" solo se
// muestra a un Administrador real (ver soloAdministradorReal en
// routes/condominios.ts — los demás roles recibirían 403 si lo intentaran).
export default function CambiarCondominioScreen({ navigation }: any) {
  const { token, guardia, rol, cambiarCondominio, nombreCondominioActual } = useAuth();
  const [condominios, setCondominios] = useState<CondominioOpcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cambiandoId, setCambiandoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);

  const cargar = () => {
    if (!token) return;
    getMisCondominios(token)
      .then(setCondominios)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Ronda 56, a pedido explícito del usuario: deshacer un condominio
  // creado por error (ej. nombre mal escrito) — el backend valida que
  // todavía no tenga nada real cargado (residentes, guardias, personal,
  // vetados, mascotas) y rechaza con un mensaje claro si no corresponde,
  // así que acá solo hace falta mostrar ese mensaje si llega a fallar.
  const handleEliminar = (c: CondominioOpcion) => {
    Alert.alert(
      "Eliminar condominio",
      `¿Eliminar "${c.nombre}"? Esta acción no se puede deshacer. Solo funciona si todavía no se agregó nada (residentes, guardias, etc.).`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setEliminandoId(c.id_condominio);
            try {
              await eliminarCondominio(token, c.id_condominio);
              cargar();
            } catch (e: any) {
              Alert.alert("No se pudo eliminar", e.message);
            } finally {
              setEliminandoId(null);
            }
          },
        },
      ]
    );
  };

  const handleElegir = async (id: number) => {
    setError(null);
    setCambiandoId(id);
    try {
      await cambiarCondominio(id);
      // Vuelve al Home: cualquier pantalla que hubiera quedado atrás en la
      // pila de navegación tendría datos cargados del condominio anterior.
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (e: any) {
      setError(e.message);
      setCambiandoId(null);
    }
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.navy900} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitulo}>Condominio actual: {nombreCondominioActual ?? "—"}</Text>

      {condominios.map((c) => {
        const esActual = c.id_condominio === guardia?.condominio_id_condominio;
        return (
          <View key={c.id_condominio} style={[styles.tarjeta, esActual && styles.tarjetaActiva]}>
            <TouchableOpacity
              style={styles.tarjetaContenido}
              onPress={() => handleElegir(c.id_condominio)}
              disabled={cambiandoId !== null || eliminandoId !== null || esActual}
              activeOpacity={0.8}
            >
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.tarjetaTexto}>{c.nombre}</Text>
                {c.comuna && <Text style={styles.tarjetaComuna}>📍 {c.comuna}</Text>}
                {c.rol && <Text style={styles.tarjetaRol}>{c.rol}</Text>}
              </View>
              {cambiandoId === c.id_condominio ? (
                <ActivityIndicator color={colors.navy900} />
              ) : esActual ? (
                <Text style={styles.actualEtiqueta}>Actual</Text>
              ) : (
                <Text style={styles.tarjetaFlecha}>›</Text>
              )}
            </TouchableOpacity>

            {!esActual && rol === "Administrador" && (
              <TouchableOpacity
                style={styles.botonEliminar}
                onPress={() => handleEliminar(c)}
                disabled={cambiandoId !== null || eliminandoId !== null}
              >
                {eliminandoId === c.id_condominio ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Text style={styles.botonEliminarTexto}>🗑 Eliminar</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {rol === "Administrador" && (
        <TouchableOpacity
          style={styles.tarjetaNueva}
          onPress={() => navigation.navigate("CrearCondominio")}
          disabled={cambiandoId !== null}
          activeOpacity={0.8}
        >
          <Text style={styles.tarjetaNuevaTexto}>+ Crear nuevo condominio</Text>
        </TouchableOpacity>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.offWhite, gap: spacing.sm },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.offWhite },
  subtitulo: { ...typography.body, color: colors.textMuted, marginBottom: spacing.sm },
  tarjeta: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tarjetaContenido: {
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tarjetaActiva: { borderColor: colors.navy900 },
  tarjetaTexto: { ...typography.heading, color: colors.textDark, flexShrink: 1 },
  tarjetaComuna: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tarjetaRol: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  tarjetaFlecha: { fontSize: 24, color: colors.textMuted, fontWeight: "700" },
  actualEtiqueta: { color: colors.navy900, fontWeight: "700", fontSize: 12 },
  botonEliminar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  botonEliminarTexto: { color: colors.danger, fontWeight: "700", fontSize: 12 },
  tarjetaNueva: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  tarjetaNuevaTexto: { color: colors.info, fontWeight: "800", fontSize: 15 },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
});
