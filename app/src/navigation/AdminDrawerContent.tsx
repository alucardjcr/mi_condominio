import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DrawerContentComponentProps, DrawerContentScrollView } from "@react-navigation/drawer";
import { useNavigationState } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme/theme";
import { SECCIONES_MENU_ADMIN } from "./adminMenu";

// Encuentra el nombre de la pantalla actualmente activa DENTRO del stack
// anidado que cuelga de este Drawer (el Drawer en sí solo tiene una única
// Drawer.Screen — todo lo demás vive en AdminStackNavigator) — así el ítem
// correspondiente del menú queda resaltado.
function useRutaActivaAnidada(): string | undefined {
  return useNavigationState((state) => {
    const rutaDrawer = state?.routes?.[state.index ?? 0];
    const estadoAnidado = rutaDrawer?.state;
    if (!estadoAnidado) return undefined;
    const indice = estadoAnidado.index ?? estadoAnidado.routes.length - 1;
    return estadoAnidado.routes?.[indice]?.name;
  });
}

// Ronda 39, a pedido explícito del usuario (bug reportado: TODO el menú
// tiraba "The action 'NAVIGATE' with payload {name:...}' was not handled").
// El motivo: `props.navigation` acá es la navegación del DRAWER, que
// registra una única pantalla llamada "AdminApp" (ver AdminDrawerNavigator
// -> <Drawer.Screen name="AdminApp" component={AdminStackNavigator} />).
// Llamar `.navigate("CambiarCondominio")` directo sobre esa navegación
// buscaba una pantalla con ese nombre EN EL DRAWER, no la encontraba (vive
// adentro del stack anidado), y fallaba — a menos que esa pantalla ya
// hubiera sido visitada antes en la sesión (por eso el bug podía
// "aparentar" funcionar a veces y no otras, según qué se hubiera abierto
// antes). La forma correcta de navegar a una pantalla de un navegador
// anidado desde un ancestro es nombrando explícitamente el navegador
// contenedor + la pantalla destino.
function navegarEnStack(navigation: DrawerContentComponentProps["navigation"], pantalla: string) {
  (navigation as any).navigate("AdminApp", { screen: pantalla });
}

export default function AdminDrawerContent(props: DrawerContentComponentProps) {
  const { guardia, logout, nombreCondominioActual, rol } = useAuth();
  const rutaActiva = useRutaActivaAnidada();

  return (
    <View style={styles.contenedor}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Image source={require("../../assets/icon.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.nombreCondominio}>{nombreCondominioActual ?? "Mi Condominio"}</Text>
          <Text style={styles.nombreUsuario}>{guardia?.nombre_usuario}</Text>
        </View>

        <TouchableOpacity
          style={[styles.item, rutaActiva === "Home" && styles.itemActivo]}
          onPress={() => navegarEnStack(props.navigation, "Home")}
          activeOpacity={0.7}
        >
          <Text style={styles.itemIcono}>🏡</Text>
          <Text style={[styles.itemTexto, rutaActiva === "Home" && styles.itemTextoActivo]}>Inicio</Text>
        </TouchableOpacity>

        {SECCIONES_MENU_ADMIN.map((seccion) => (
          <View key={seccion.titulo} style={styles.seccion}>
            <Text style={styles.seccionTitulo}>{seccion.titulo}</Text>
            {seccion.items.map((item) => {
              const activo = rutaActiva === item.route;
              return (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.item, activo && styles.itemActivo]}
                  onPress={() => navegarEnStack(props.navigation, item.route)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.itemIcono}>{item.icon}</Text>
                  <Text style={[styles.itemTexto, activo && styles.itemTextoActivo]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </DrawerContentScrollView>

      <View style={styles.footer}>
        {rol === "Administrador" && (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navegarEnStack(props.navigation, "CambiarCondominio")}
            activeOpacity={0.7}
          >
            <Text style={styles.itemIcono}>🏘️</Text>
            <Text style={styles.itemTexto}>Cambiar de condominio</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.item}
          onPress={() => navegarEnStack(props.navigation, "CambiarPassword")}
          activeOpacity={0.7}
        >
          <Text style={styles.itemIcono}>🔑</Text>
          <Text style={styles.itemTexto}>Cambiar contraseña</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={logout} activeOpacity={0.7}>
          <Text style={styles.itemIcono}>🚪</Text>
          <Text style={[styles.itemTexto, { color: colors.textOnNavy }]}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.navy800 },
  scroll: { paddingTop: 0 },
  header: {
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.navy600,
    marginBottom: spacing.sm,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    marginBottom: spacing.sm,
  },
  nombreCondominio: { ...typography.heading, color: colors.textOnNavy },
  nombreUsuario: { ...typography.small, color: colors.textMutedOnNavy, marginTop: 2 },
  seccion: { marginTop: spacing.md },
  seccionTitulo: {
    ...typography.small,
    color: colors.textMutedOnNavy,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  itemActivo: { backgroundColor: colors.navy600 },
  itemIcono: { fontSize: 16, width: 26 },
  itemTexto: { ...typography.body, color: colors.textMutedOnNavy },
  itemTextoActivo: { color: colors.gold, fontWeight: "700" },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.navy600,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.lg,
  },
});
