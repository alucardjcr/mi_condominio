import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { navHeaderOptions } from "../theme/theme";
import SuperAdminHomeScreen from "../screens/superadmin/SuperAdminHomeScreen";
import SuperAdminFacturacionScreen from "../screens/superadmin/SuperAdminFacturacionScreen";
import SuperAdminFacturacionDetalleScreen from "../screens/superadmin/SuperAdminFacturacionDetalleScreen";
import SuperAdminCrearAdminScreen from "../screens/superadmin/SuperAdminCrearAdminScreen";
import SuperAdminAdministradoresScreen from "../screens/superadmin/SuperAdminAdministradoresScreen";

const Stack = createNativeStackNavigator();

// Ronda 27: panel exclusivo del rol SuperAdmin (el dueño del sistema) — a
// diferencia del Administrador de condominio, no necesita un menú lateral
// con ~19 módulos, así que es un Stack simple (sin Drawer).
export default function SuperAdminStackNavigator() {
  return (
    <Stack.Navigator screenOptions={navHeaderOptions}>
      <Stack.Screen name="SuperAdminHome" component={SuperAdminHomeScreen} options={{ title: "Mi Condominio" }} />
      <Stack.Screen
        name="SuperAdminFacturacion"
        component={SuperAdminFacturacionScreen}
        options={{ title: "Facturación" }}
      />
      <Stack.Screen
        name="SuperAdminFacturacionDetalle"
        component={SuperAdminFacturacionDetalleScreen}
        options={{ title: "Facturación" }}
      />
      <Stack.Screen
        name="SuperAdminCrearAdmin"
        component={SuperAdminCrearAdminScreen}
        options={{ title: "Crear administrador" }}
      />
      <Stack.Screen
        name="SuperAdminAdministradores"
        component={SuperAdminAdministradoresScreen}
        options={{ title: "Administradores" }}
      />
    </Stack.Navigator>
  );
}
