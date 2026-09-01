import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import AdminStackNavigator from "./AdminStackNavigator";
import AdminDrawerContent from "./AdminDrawerContent";
import { colors } from "../theme/theme";

const Drawer = createDrawerNavigator();

// Ronda 24: el menú de todos los módulos, a la izquierda, para el modo
// Administrador (a pedido del usuario). El Drawer tiene una única pantalla
// (el stack con todo lo demás) — el header real lo pinta ese stack interno,
// por eso acá se oculta el header propio del Drawer.
export default function AdminDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <AdminDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: { backgroundColor: colors.navy800, width: 300 },
        overlayColor: "rgba(10, 19, 48, 0.55)",
      }}
    >
      <Drawer.Screen name="AdminApp" component={AdminStackNavigator} />
    </Drawer.Navigator>
  );
}
