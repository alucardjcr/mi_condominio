import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { superAdminActualizarAdministrador, superAdminGetAdministradores } from "../../api/client";
import { AdministradorCuenta } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { fuenteImagenPrivada } from "../../utils/imagenesPrivadas";
import { colors, radius, spacing, typography } from "../../theme/theme";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default function SuperAdminAdministradoresScreen() {
  const { token } = useAuth();
  const [administradores, setAdministradores] = useState<AdministradorCuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizandoId, setActualizandoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    superAdminGetAdministradores(token)
      .then(setAdministradores)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(cargar);

  const handleToggleVigencia = (a: AdministradorCuenta) => {
    const accion = a.flg_vigencia ? "desactivar" : "reactivar";
    Alert.alert(`¿${accion === "desactivar" ? "Desactivar" : "Reactivar"} cuenta?`, `"${a.nombre_usuario}" (${a.usuariocol})`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: accion === "desactivar" ? "Desactivar" : "Reactivar",
        style: accion === "desactivar" ? "destructive" : "default",
        onPress: async () => {
          if (!token) return;
          setActualizandoId(a.id_usuario);
          try {
            await superAdminActualizarAdministrador(token, a.id_usuario, { flg_vigencia: a.flg_vigencia ? 0 : 1 });
            cargar();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setActualizandoId(null);
          }
        },
      },
    ]);
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.navy900} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      {administradores.map((a) => {
        const fuenteFoto = fuenteImagenPrivada(a.foto_url, token);
        return (
          <View key={a.id_usuario} style={styles.tarjeta}>
            {fuenteFoto ? (
              <Image source={fuenteFoto} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarIniciales]}>
                <Text style={styles.avatarInicialesTexto}>{iniciales(a.nombre_usuario)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{a.nombre_usuario}</Text>
              <Text style={styles.detalle}>
                {a.usuariocol} · {a.condominio_home ?? "Sin condominio todavía"}
              </Text>
              {(a.rut || a.telefono) && (
                <Text style={styles.detalleChico}>
                  {[a.rut, a.telefono].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.badge, a.flg_vigencia ? styles.badgeActivo : styles.badgeInactivo]}
              onPress={() => handleToggleVigencia(a)}
              disabled={actualizandoId === a.id_usuario}
            >
              {actualizandoId === a.id_usuario ? (
                <ActivityIndicator size="small" color={colors.textDark} />
              ) : (
                <Text style={styles.badgeTexto}>{a.flg_vigencia ? "Activo" : "Inactivo"}</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.offWhite },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.offWhite },
  error: { color: colors.danger, textAlign: "center", fontWeight: "600", marginBottom: spacing.md },
  tarjeta: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  nombre: { ...typography.heading, color: colors.textDark },
  detalle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  detalleChico: { color: colors.textMuted, marginTop: 2, fontSize: 11 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: spacing.sm, backgroundColor: colors.offWhite },
  avatarIniciales: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  avatarInicialesTexto: { fontWeight: "800", color: colors.navy900 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginLeft: spacing.sm, minWidth: 70, alignItems: "center" },
  badgeActivo: { backgroundColor: "#DCFCE7" },
  badgeInactivo: { backgroundColor: "#FEE2E2" },
  badgeTexto: { fontSize: 12, fontWeight: "800", color: colors.textDark },
});
