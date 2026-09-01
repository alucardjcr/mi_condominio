import React from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { colors, navHeaderOptions } from "./src/theme/theme";
import AdminDrawerNavigator from "./src/navigation/AdminDrawerNavigator";
import SuperAdminStackNavigator from "./src/navigation/SuperAdminStackNavigator";
import PagoPendienteScreen from "./src/screens/PagoPendienteScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RecuperarPasswordScreen from "./src/screens/RecuperarPasswordScreen";
import SeleccionarCondominioScreen from "./src/screens/SeleccionarCondominioScreen";
import CrearCondominioScreen from "./src/screens/CrearCondominioScreen";
import CambiarCondominioScreen from "./src/screens/CambiarCondominioScreen";
import HomeScreen from "./src/screens/HomeScreen";
import EntradaScreen from "./src/screens/EntradaScreen";
import SalidaScreen from "./src/screens/SalidaScreen";
import ConsultaPatenteScreen from "./src/screens/ConsultaPatenteScreen";
import DisponibilidadScreen from "./src/screens/DisponibilidadScreen";
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
import MiHogarScreen from "./src/screens/MiHogarScreen";
import NotificacionesScreen from "./src/screens/NotificacionesScreen";
import PersonalTareasScreen from "./src/screens/PersonalTareasScreen";
import GuardiaMantencionesScreen from "./src/screens/GuardiaMantencionesScreen";
import EstacionamientosArriendoScreen from "./src/screens/EstacionamientosArriendoScreen";
import ConsultaVetadoScreen from "./src/screens/ConsultaVetadoScreen";
import BitacoraScreen from "./src/screens/BitacoraScreen";
import MascotasScreen from "./src/screens/MascotasScreen";
import JefeGuardiasTurnosScreen from "./src/screens/jefeguardias/JefeGuardiasTurnosScreen";
import JefeGuardiasGuardiasScreen from "./src/screens/jefeguardias/JefeGuardiasGuardiasScreen";

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { token, rol, esAdmin, restaurandoSesion, requiereSeleccionCondominio, pagoPendiente } = useAuth();
  const esSuperAdmin = rol === "SuperAdmin";
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={navHeaderOptions}>
      {!token && pagoPendiente ? (
        // Ronda 27, a pedido del usuario: todos los condominios de esta
        // cuenta tienen la mensualidad pendiente — ver
        // AuthContext.pagoPendiente. Se corta ANTES que Login/selector:
        // token sigue null (la cuenta y contraseña eran correctas, pero
        // login() no entrega sesión mientras no haya ningún condominio
        // disponible).
        <Stack.Screen name="PagoPendiente" component={PagoPendienteScreen} options={{ headerShown: false }} />
      ) : !token && requiereSeleccionCondominio ? (
        // Ronda 26: Administrador logeado pero con más de un condominio —
        // ver AuthContext.requiereSeleccionCondominio. Se corta acá ANTES
        // que la rama de Login: token sigue siendo null en este punto (la
        // sesión final todavía no existe), así que sin este chequeo caería
        // en la rama de abajo y mostraría el Login de nuevo.
        <>
          <Stack.Screen
            name="SeleccionarCondominio"
            component={SeleccionarCondominioScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CrearCondominio"
            component={CrearCondominioScreen}
            options={{ title: "Crear condominio" }}
          />
        </>
      ) : !token ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="RecuperarPassword"
            component={RecuperarPasswordScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : esSuperAdmin ? (
        // Ronda 27: panel del dueño del sistema — nada que ver con ningún
        // condominio en particular, por eso va antes que esAdmin.
        <Stack.Screen name="SuperAdminRoot" component={SuperAdminStackNavigator} options={{ headerShown: false }} />
      ) : esAdmin ? (
        // Ronda 24: Administrador (y Residente-comité) navega por su propio
        // Drawer con el menú de todos los módulos a la izquierda — ver
        // src/navigation/AdminDrawerNavigator.tsx. El header lo pinta el
        // stack anidado adentro del Drawer, por eso headerShown:false acá.
        <Stack.Screen name="AdminRoot" component={AdminDrawerNavigator} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Mi Condominio" }} />
          <Stack.Screen
            name="CambiarPassword"
            component={CambiarPasswordScreen}
            options={{ title: "Cambiar contraseña" }}
          />
          <Stack.Screen
            name="CambiarCondominio"
            component={CambiarCondominioScreen}
            options={{ title: "Cambiar de condominio" }}
          />
          <Stack.Screen
            name="CrearCondominio"
            component={CrearCondominioScreen}
            options={{ title: "Crear condominio" }}
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
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
