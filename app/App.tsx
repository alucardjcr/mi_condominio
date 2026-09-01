import React from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import EntradaScreen from "./src/screens/EntradaScreen";
import SalidaScreen from "./src/screens/SalidaScreen";
import ConsultaPatenteScreen from "./src/screens/ConsultaPatenteScreen";
import DisponibilidadScreen from "./src/screens/DisponibilidadScreen";
import AdminGuardiasScreen from "./src/screens/admin/AdminGuardiasScreen";
import AdminResidentesScreen from "./src/screens/admin/AdminResidentesScreen";
import AdminPatentesScreen from "./src/screens/admin/AdminPatentesScreen";
import AdminAuditoriaScreen from "./src/screens/admin/AdminAuditoriaScreen";
import AdminReporteGastoComunScreen from "./src/screens/admin/AdminReporteGastoComunScreen";
import PaqueteRegistrarScreen from "./src/screens/PaqueteRegistrarScreen";
import PaquetePendientesScreen from "./src/screens/PaquetePendientesScreen";
import PaqueteEntregaScreen from "./src/screens/PaqueteEntregaScreen";
import PaqueteBusquedaScreen from "./src/screens/PaqueteBusquedaScreen";
import MisPaquetesScreen from "./src/screens/MisPaquetesScreen";
import CambiarPasswordScreen from "./src/screens/CambiarPasswordScreen";
import ReservasEspaciosScreen from "./src/screens/ReservasEspaciosScreen";
import ReservaCrearScreen from "./src/screens/ReservaCrearScreen";
import MisReservasScreen from "./src/screens/MisReservasScreen";
import GuardiaReservasScreen from "./src/screens/GuardiaReservasScreen";
import AdminEspaciosScreen from "./src/screens/admin/AdminEspaciosScreen";
import AdminReservasScreen from "./src/screens/admin/AdminReservasScreen";
import MiHogarScreen from "./src/screens/MiHogarScreen";
import NotificacionesScreen from "./src/screens/NotificacionesScreen";
import AdminComunicadosScreen from "./src/screens/admin/AdminComunicadosScreen";
import AdminGastoComunScreen from "./src/screens/admin/AdminGastoComunScreen";
import AdminPersonalScreen from "./src/screens/admin/AdminPersonalScreen";
import AdminAsignarTareaScreen from "./src/screens/admin/AdminAsignarTareaScreen";
import AdminPersonalDetalleScreen from "./src/screens/admin/AdminPersonalDetalleScreen";
import PersonalTareasScreen from "./src/screens/PersonalTareasScreen";
import AdminMantencionesScreen from "./src/screens/admin/AdminMantencionesScreen";
import AdminElementosMantencionScreen from "./src/screens/admin/AdminElementosMantencionScreen";
import AdminMantencionDetalleScreen from "./src/screens/admin/AdminMantencionDetalleScreen";
import GuardiaMantencionesScreen from "./src/screens/GuardiaMantencionesScreen";
import EstacionamientosArriendoScreen from "./src/screens/EstacionamientosArriendoScreen";
import ConsultaVetadoScreen from "./src/screens/ConsultaVetadoScreen";
import AdminVetadosScreen from "./src/screens/admin/AdminVetadosScreen";
import BitacoraScreen from "./src/screens/BitacoraScreen";
import MascotasScreen from "./src/screens/MascotasScreen";
import JefeGuardiasTurnosScreen from "./src/screens/jefeguardias/JefeGuardiasTurnosScreen";
import JefeGuardiasGuardiasScreen from "./src/screens/jefeguardias/JefeGuardiasGuardiasScreen";

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { token, rol, esAdmin, restaurandoSesion } = useAuth();
  // Un residente del comité (esAdmin=true aunque rol="Residente") navega
  // igual que Administrador, no por la rama de Residente.
  const esResidente = rol === "Residente" && !esAdmin;
  // Ronda 18: Personal externo (aseo, jardinería, mantención) navega por su
  // propia rama — no es Residente, Administrador ni Guardia.
  const esPersonal = rol === "Personal";
  // Ronda 20: JEFE_GUARDIAS navega por su propia rama, aparte — a pedido
  // explícito del usuario, este perfil SOLO tiene acceso al calendario de
  // turnos y al CRUD de guardias (ver JefeGuardiasTurnosScreen /
  // JefeGuardiasGuardiasScreen), nada más de lo que ve Guardia/Administrador.
  const esJefeGuardias = rol === "JefeGuardias";

  // Ronda 17: mientras se intenta restaurar una sesión guardada, se muestra
  // un loading en vez del login — si no, alguien con sesión ya guardada
  // vería un parpadeo del login antes de entrar directo al Home.
  if (restaurandoSesion) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerTitleAlign: "center" }}>
      {!token ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Mi Condominio" }} />
          <Stack.Screen
            name="CambiarPassword"
            component={CambiarPasswordScreen}
            options={{ title: "Cambiar contraseña" }}
          />
          {esResidente ? (
            <>
              <Stack.Screen
                name="MisPaquetes"
                component={MisPaquetesScreen}
                options={{ title: "Mis paquetes" }}
              />
              <Stack.Screen
                name="ReservasEspacios"
                component={ReservasEspaciosScreen}
                options={{ title: "Espacios comunes" }}
              />
              <Stack.Screen
                name="ReservaCrear"
                component={ReservaCrearScreen}
                options={{ title: "Reservar" }}
              />
              <Stack.Screen
                name="MisReservas"
                component={MisReservasScreen}
                options={{ title: "Mis reservas" }}
              />
              <Stack.Screen
                name="MiHogar"
                component={MiHogarScreen}
                options={{ title: "Mi hogar" }}
              />
              <Stack.Screen
                name="EstacionamientosArriendo"
                component={EstacionamientosArriendoScreen}
                options={{ title: "Estacionamientos en arriendo" }}
              />
              <Stack.Screen
                name="Mascotas"
                component={MascotasScreen}
                options={{ title: "Mis mascotas" }}
              />
              <Stack.Screen
                name="Notificaciones"
                component={NotificacionesScreen}
                options={{ title: "Notificaciones" }}
              />
            </>
          ) : esPersonal ? (
            <>
              <Stack.Screen
                name="PersonalTareas"
                component={PersonalTareasScreen}
                options={{ title: "Mis tareas" }}
              />
              <Stack.Screen
                name="Notificaciones"
                component={NotificacionesScreen}
                options={{ title: "Notificaciones" }}
              />
            </>
          ) : esJefeGuardias ? (
            <>
              <Stack.Screen
                name="JefeGuardiasTurnos"
                component={JefeGuardiasTurnosScreen}
                options={{ title: "Turnos de la semana" }}
              />
              <Stack.Screen
                name="JefeGuardiasGuardias"
                component={JefeGuardiasGuardiasScreen}
                options={{ title: "Guardias" }}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Disponibilidad"
                component={DisponibilidadScreen}
                options={{ title: "Disponibilidad" }}
              />
              <Stack.Screen
                name="PaqueteBusqueda"
                component={PaqueteBusquedaScreen}
                options={{ title: "Buscar paquetes" }}
              />
              {esAdmin ? (
                <>
                  <Stack.Screen
                    name="AdminGuardias"
                    component={AdminGuardiasScreen}
                    options={{ title: "Guardias" }}
                  />
                  <Stack.Screen
                    name="AdminResidentes"
                    component={AdminResidentesScreen}
                    options={{ title: "Residentes" }}
                  />
                  <Stack.Screen
                    name="AdminPatentes"
                    component={AdminPatentesScreen}
                    options={{ title: "Patentes de residentes" }}
                  />
                  <Stack.Screen
                    name="AdminAuditoria"
                    component={AdminAuditoriaScreen}
                    options={{ title: "Auditoría por patente" }}
                  />
                  <Stack.Screen
                    name="AdminReporteGastoComun"
                    component={AdminReporteGastoComunScreen}
                    options={{ title: "Reporte gasto común" }}
                  />
                  <Stack.Screen
                    name="AdminEspacios"
                    component={AdminEspaciosScreen}
                    options={{ title: "Espacios comunes" }}
                  />
                  <Stack.Screen
                    name="AdminReservas"
                    component={AdminReservasScreen}
                    options={{ title: "Reservas" }}
                  />
                  <Stack.Screen
                    name="ReservasEspacios"
                    component={ReservasEspaciosScreen}
                    options={{ title: "Espacios comunes" }}
                  />
                  <Stack.Screen
                    name="ReservaCrear"
                    component={ReservaCrearScreen}
                    options={{ title: "Reservar" }}
                  />
                  <Stack.Screen
                    name="AdminComunicados"
                    component={AdminComunicadosScreen}
                    options={{ title: "Enviar comunicado" }}
                  />
                  <Stack.Screen
                    name="AdminGastoComun"
                    component={AdminGastoComunScreen}
                    options={{ title: "Gasto común" }}
                  />
                  <Stack.Screen
                    name="AdminPersonal"
                    component={AdminPersonalScreen}
                    options={{ title: "Personal externo" }}
                  />
                  <Stack.Screen
                    name="AdminAsignarTarea"
                    component={AdminAsignarTareaScreen}
                    options={{ title: "Asignar tarea" }}
                  />
                  <Stack.Screen
                    name="AdminPersonalDetalle"
                    component={AdminPersonalDetalleScreen}
                    options={{ title: "Historial" }}
                  />
                  <Stack.Screen
                    name="AdminMantenciones"
                    component={AdminMantencionesScreen}
                    options={{ title: "Mantenciones" }}
                  />
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
                  <Stack.Screen
                    name="AdminVetados"
                    component={AdminVetadosScreen}
                    options={{ title: "VETADOS" }}
                  />
                  <Stack.Screen
                    name="Bitacora"
                    component={BitacoraScreen}
                    options={{ title: "Bitácora de guardias" }}
                  />
                  <Stack.Screen
                    name="Mascotas"
                    component={MascotasScreen}
                    options={{ title: "Mascotas" }}
                  />
                  <Stack.Screen
                    name="Notificaciones"
                    component={NotificacionesScreen}
                    options={{ title: "Notificaciones" }}
                  />
                </>
              ) : (
                <>
                  <Stack.Screen name="Entrada" component={EntradaScreen} options={{ title: "Registrar entrada" }} />
                  <Stack.Screen name="Salida" component={SalidaScreen} options={{ title: "Registrar salida" }} />
                  <Stack.Screen
                    name="ConsultaPatente"
                    component={ConsultaPatenteScreen}
                    options={{ title: "Consulta de patente" }}
                  />
                  <Stack.Screen
                    name="PaquetePendientes"
                    component={PaquetePendientesScreen}
                    options={{ title: "Paquetes en portería" }}
                  />
                  <Stack.Screen
                    name="PaqueteRegistrar"
                    component={PaqueteRegistrarScreen}
                    options={{ title: "Registrar paquete" }}
                  />
                  <Stack.Screen
                    name="PaqueteEntrega"
                    component={PaqueteEntregaScreen}
                    options={{ title: "Entregar paquete" }}
                  />
                  <Stack.Screen
                    name="GuardiaReservas"
                    component={GuardiaReservasScreen}
                    options={{ title: "Reserva área común" }}
                  />
                  <Stack.Screen
                    name="GuardiaMantenciones"
                    component={GuardiaMantencionesScreen}
                    options={{ title: "Mantenciones" }}
                  />
                  <Stack.Screen
                    name="EstacionamientosArriendo"
                    component={EstacionamientosArriendoScreen}
                    options={{ title: "Estacionamientos en arriendo" }}
                  />
                  <Stack.Screen
                    name="ConsultaVetado"
                    component={ConsultaVetadoScreen}
                    options={{ title: "Consulta VETADOS" }}
                  />
                  <Stack.Screen
                    name="Bitacora"
                    component={BitacoraScreen}
                    options={{ title: "Bitácora" }}
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
