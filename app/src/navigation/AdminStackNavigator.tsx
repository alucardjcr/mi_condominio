import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "../screens/HomeScreen";
import CambiarPasswordScreen from "../screens/CambiarPasswordScreen";
import DisponibilidadScreen from "../screens/DisponibilidadScreen";
import PaqueteBusquedaScreen from "../screens/PaqueteBusquedaScreen";
import AdminGuardiasScreen from "../screens/admin/AdminGuardiasScreen";
import AdminResidentesScreen from "../screens/admin/AdminResidentesScreen";
import AdminPatentesScreen from "../screens/admin/AdminPatentesScreen";
import AdminAuditoriaScreen from "../screens/admin/AdminAuditoriaScreen";
import AdminReporteGastoComunScreen from "../screens/admin/AdminReporteGastoComunScreen";
import ReservasEspaciosScreen from "../screens/ReservasEspaciosScreen";
import ReservaCrearScreen from "../screens/ReservaCrearScreen";
import AdminEspaciosScreen from "../screens/admin/AdminEspaciosScreen";
import AdminReservasScreen from "../screens/admin/AdminReservasScreen";
import AdminComunicadosScreen from "../screens/admin/AdminComunicadosScreen";
import AdminGastoComunScreen from "../screens/admin/AdminGastoComunScreen";
import AdminPersonalScreen from "../screens/admin/AdminPersonalScreen";
import AdminAsignarTareaScreen from "../screens/admin/AdminAsignarTareaScreen";
import AdminPersonalDetalleScreen from "../screens/admin/AdminPersonalDetalleScreen";
import AdminMantencionesScreen from "../screens/admin/AdminMantencionesScreen";
import AdminElementosMantencionScreen from "../screens/admin/AdminElementosMantencionScreen";
import AdminMantencionDetalleScreen from "../screens/admin/AdminMantencionDetalleScreen";
import EstacionamientosArriendoScreen from "../screens/EstacionamientosArriendoScreen";
import AdminVetadosScreen from "../screens/admin/AdminVetadosScreen";
import BitacoraScreen from "../screens/BitacoraScreen";
import MascotasScreen from "../screens/MascotasScreen";
import NotificacionesScreen from "../screens/NotificacionesScreen";
import { colors, navHeaderOptions } from "../theme/theme";

const Stack = createNativeStackNavigator();

// Botón ☰ que abre el menú lateral — solo se muestra en Inicio (la raíz de
// este stack, la única pantalla sin flecha de "atrás" que pueda chocar con
// este botón). En el resto de las pantallas de administrador el menú sigue
// alcanzable arrastrando desde el borde izquierdo (gesto nativo del Drawer).
//
// Importante: headerLeft NO recibe `navigation` como prop (a diferencia de
// un componente de pantalla normal) — hay que pedirlo con el hook
// useNavigation(). Este era el bug de la ronda 24 ("Cannot read property
// 'getParent' of undefined"): se esperaba `navigation` por props y nunca
// llegaba, así que `navigation` era undefined.
function BotonMenu() {
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      onPress={() => navigation.getParent()?.dispatch(DrawerActions.openDrawer())}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{ paddingHorizontal: 4 }}
    >
      <Text style={{ fontSize: 22, color: colors.textOnNavy }}>☰</Text>
    </TouchableOpacity>
  );
}

// Ronda 24: todo lo que antes vivía directo dentro del branch `esAdmin` del
// Stack.Navigator único de App.tsx, ahora anidado adentro de
// AdminDrawerNavigator (Drawer > este Stack). El menú lateral navega acá por
// nombre de pantalla (React Navigation resuelve nombres de pantallas
// anidadas automáticamente, sin necesitar rutas compuestas).
export default function AdminStackNavigator() {
  return (
    <Stack.Navigator screenOptions={navHeaderOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "Mi Condominio", headerLeft: () => <BotonMenu /> }}
      />
      <Stack.Screen name="CambiarPassword" component={CambiarPasswordScreen} options={{ title: "Cambiar contraseña" }} />
      <Stack.Screen name="Disponibilidad" component={DisponibilidadScreen} options={{ title: "Disponibilidad" }} />
      <Stack.Screen name="PaqueteBusqueda" component={PaqueteBusquedaScreen} options={{ title: "Buscar paquetes" }} />
      <Stack.Screen name="AdminGuardias" component={AdminGuardiasScreen} options={{ title: "Guardias" }} />
      <Stack.Screen name="AdminResidentes" component={AdminResidentesScreen} options={{ title: "Residentes" }} />
      <Stack.Screen name="AdminPatentes" component={AdminPatentesScreen} options={{ title: "Patentes de residentes" }} />
      <Stack.Screen name="AdminAuditoria" component={AdminAuditoriaScreen} options={{ title: "Auditoría por patente" }} />
      <Stack.Screen
        name="AdminReporteGastoComun"
        component={AdminReporteGastoComunScreen}
        options={{ title: "Reporte gasto común" }}
      />
      <Stack.Screen name="AdminEspacios" component={AdminEspaciosScreen} options={{ title: "Espacios comunes" }} />
      <Stack.Screen name="AdminReservas" component={AdminReservasScreen} options={{ title: "Reservas" }} />
      <Stack.Screen name="ReservasEspacios" component={ReservasEspaciosScreen} options={{ title: "Espacios comunes" }} />
      <Stack.Screen name="ReservaCrear" component={ReservaCrearScreen} options={{ title: "Reservar" }} />
      <Stack.Screen name="AdminComunicados" component={AdminComunicadosScreen} options={{ title: "Enviar comunicado" }} />
      <Stack.Screen name="AdminGastoComun" component={AdminGastoComunScreen} options={{ title: "Gasto común" }} />
      <Stack.Screen name="AdminPersonal" component={AdminPersonalScreen} options={{ title: "Personal externo" }} />
      <Stack.Screen name="AdminAsignarTarea" component={AdminAsignarTareaScreen} options={{ title: "Asignar tarea" }} />
      <Stack.Screen name="AdminPersonalDetalle" component={AdminPersonalDetalleScreen} options={{ title: "Historial" }} />
      <Stack.Screen name="AdminMantenciones" component={AdminMantencionesScreen} options={{ title: "Mantenciones" }} />
      <Stack.Screen
        name="AdminElementosMantencion"
        component={AdminElementosMantencionScreen}
        options={{ title: "Catálogo de infraestructura" }}
      />
      <Stack.Screen
        name="AdminMantencionDetalle"
        component={AdminMantencionDetalleScreen}
        options={{ title: "Detalle mantención" }}
      />
      <Stack.Screen
        name="EstacionamientosArriendo"
        component={EstacionamientosArriendoScreen}
        options={{ title: "Estacionamientos en arriendo" }}
      />
      <Stack.Screen name="AdminVetados" component={AdminVetadosScreen} options={{ title: "Vetados" }} />
      <Stack.Screen name="Bitacora" component={BitacoraScreen} options={{ title: "Bitácora de guardias" }} />
      <Stack.Screen name="Mascotas" component={MascotasScreen} options={{ title: "Mascotas" }} />
      <Stack.Screen name="Notificaciones" component={NotificacionesScreen} options={{ title: "Notificaciones" }} />
    </Stack.Navigator>
  );
}
