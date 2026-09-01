import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import {
  login as apiLogin,
  registrarPushToken,
  seleccionarCondominio as apiSeleccionarCondominio,
  setUnauthorizedHandler,
} from "../api/client";
import { CondominioOpcion } from "../api/types";
import { setCondominioIdActual } from "../config/api";
import { obtenerPushTokenExpo } from "../utils/notificaciones";

interface Guardia {
  id_usuario: number;
  nombre_usuario: string;
  condominio_id_condominio?: number;
  // Solo presentes cuando rol = 'Residente'.
  unidad_id_unidad?: number;
  numero_unidad?: string;
  nombre_torre?: string;
  // Solo puede venir en true cuando rol = 'Residente': es además miembro
  // del comité de administración, con los mismos permisos que un
  // Administrador en toda la app (sigue siendo Residente — conserva su
  // depto y su propia vista de "Mis paquetes").
  esComite?: boolean;
  // Solo puede venir en true cuando rol = 'Residente' (ronda 15): es el
  // dueño registrado de unidad_id_unidad, viva ahí o no — puede administrar
  // el listado de residentes de esa unidad desde "Mi hogar".
  esPropietario?: boolean;
}

type Rol = "Guardia" | "Administrador" | "Residente" | "Personal" | "JefeGuardias";

interface AuthContextValue {
  token: string | null;
  guardia: Guardia | null;
  rol: Rol | null;
  // true si rol === "Administrador" O si es un Residente del comité — usar
  // esto (no comparar rol === "Administrador" directamente) para decidir
  // qué pantallas/menús mostrar.
  esAdmin: boolean;
  // true si rol === "Residente" y además es el dueño registrado de su
  // depto (ronda 15) — da acceso a "Mi hogar" para administrar el listado
  // de residentes de su propia unidad, viva ahí o no.
  esPropietario: boolean;
  // true mientras se intenta restaurar la sesión guardada (ronda 17) al
  // abrir la app — App.tsx muestra una pantalla de carga en vez del login
  // mientras esto es true, para no hacer parpadear el login si ya había
  // una sesión guardada.
  restaurandoSesion: boolean;
  // Ronda 26: true entre que un Administrador con más de un condominio se
  // logea y elige a cuál entrar — App.tsx muestra SeleccionarCondominioScreen
  // en vez de Login/Home mientras esto es true.
  requiereSeleccionCondominio: boolean;
  condominiosDisponibles: CondominioOpcion[];
  // Ronda 26: token intermedio de la selección post-login — lo necesita
  // CrearCondominioScreen para poder crear un condominio ANTES de que
  // exista una sesión completa (cuando se llega a esa pantalla desde el
  // selector, no desde el menú de un admin ya logeado). Nunca sirve para
  // ninguna otra ruta que no sea /auth/seleccionar-condominio o
  // /admin-condominios (ambas aceptan un token de Administrador aunque
  // todavía no tenga condominio_id_condominio elegido).
  tokenIntermedio: string | null;
  // Ronda 26: nombre del condominio de la sesión actual (ver
  // guardia.condominio_id_condominio) — usarlo en vez de un nombre fijo en
  // el menú/header de Administrador.
  nombreCondominioActual: string | null;
  login: (usuariocol: string, password: string) => Promise<void>;
  seleccionarCondominio: (condominioId: number) => Promise<void>;
  // Ronda 26: para un Administrador YA logeado (sesión completa) que
  // quiere pasarse a otro de sus condominios desde el menú, sin
  // desloguearse — reutiliza el mismo endpoint que el selector post-login,
  // pero mandando el token de la sesión activa en vez del intermedio.
  cambiarCondominio: (condominioId: number) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Ronda 17: la sesión se persiste con expo-secure-store para que cerrar la
// app (o que el sistema operativo la mate en segundo plano) no obligue a
// loguearse de nuevo — antes se guardaba solo en memoria. Se guarda todo
// junto (token + datos del usuario + rol) bajo una sola clave, como un JSON
// chico (bien por debajo de los ~2KB que algunas versiones de iOS
// históricamente rechazaban). El token de Residente/Administrador ahora
// dura 30 días en vez de 12h (ver auth.service.ts) — si no, esta
// persistencia serviría de poco.
const CLAVE_SESION = "mi-condominio.sesion";

interface SesionGuardada {
  token: string;
  guardia: Guardia;
  rol: Rol;
  nombreCondominio?: string;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [guardia, setGuardia] = useState<Guardia | null>(null);
  const [rol, setRol] = useState<Rol | null>(null);
  const [restaurandoSesion, setRestaurandoSesion] = useState(true);
  // Ronda 26: mientras se resuelve la selección de condominio de un
  // Administrador con más de uno, se guarda acá el token intermedio (el
  // que solo sirve para POST /auth/seleccionar-condominio) — nunca se
  // persiste ni se usa para llamar a ninguna otra ruta.
  const [tokenIntermedio, setTokenIntermedio] = useState<string | null>(null);
  const [condominiosDisponibles, setCondominiosDisponibles] = useState<CondominioOpcion[]>([]);
  const [nombreCondominioActual, setNombreCondominioActual] = useState<string | null>(null);

  const logout = () => {
    setToken(null);
    setGuardia(null);
    setRol(null);
    setTokenIntermedio(null);
    setCondominiosDisponibles([]);
    setNombreCondominioActual(null);
    SecureStore.deleteItemAsync(CLAVE_SESION).catch(() => {});
  };

  const aplicarSesion = (resultado: { token: string; guardia: Guardia; rol: string; condominio_nombre?: string }) => {
    setToken(resultado.token);
    setGuardia(resultado.guardia);
    setRol(resultado.rol as Rol);
    setTokenIntermedio(null);
    setCondominiosDisponibles([]);
    setNombreCondominioActual(resultado.condominio_nombre ?? null);
    // Ver la nota en config/api.ts: esto es lo que hace que las ~20
    // pantallas existentes (Paquetes, Reservas, etc.) empiecen a trabajar
    // con el condominio correcto sin tener que tocarlas una por una.
    if (resultado.guardia.condominio_id_condominio) {
      setCondominioIdActual(resultado.guardia.condominio_id_condominio);
    }
    SecureStore.setItemAsync(
      CLAVE_SESION,
      JSON.stringify({
        token: resultado.token,
        guardia: resultado.guardia,
        rol: resultado.rol,
        nombreCondominio: resultado.condominio_nombre,
      })
    ).catch(() => {
      // Si no se pudo persistir, la sesión igual funciona en memoria para
      // este uso de la app — solo no sobrevivirá a cerrarla.
    });

    // Ronda 16: registrar el push token del teléfono para notificaciones
    // reales — best-effort, nunca debe frenar ni fallar el login. En Expo
    // Go (sin development build) obtenerPushTokenExpo() devuelve null y no
    // pasa nada: las notificaciones igual quedan disponibles dentro de la
    // app en "Notificaciones".
    obtenerPushTokenExpo()
      .then((pushToken) => {
        if (pushToken) return registrarPushToken(resultado.token, pushToken);
      })
      .catch(() => {});
  };

  // Al abrir la app: intenta restaurar la sesión guardada. Si el token
  // guardado ya no sirve (expiró, o el administrador quitó el acceso), la
  // primera llamada a la API que haga cualquier pantalla va a devolver 401
  // y el handler de abajo cierra sesión automáticamente — acá no hace
  // falta validar el token contra el backend antes de restaurar.
  useEffect(() => {
    SecureStore.getItemAsync(CLAVE_SESION)
      .then((guardado) => {
        if (guardado) {
          const sesion = JSON.parse(guardado) as SesionGuardada;
          setToken(sesion.token);
          setGuardia(sesion.guardia);
          setRol(sesion.rol);
          setNombreCondominioActual(sesion.nombreCondominio ?? null);
          if (sesion.guardia.condominio_id_condominio) {
            setCondominioIdActual(sesion.guardia.condominio_id_condominio);
          }
        }
      })
      .catch(() => {
        // Si el storage seguro falla o el JSON quedó corrupto, simplemente
        // no se restaura nada y el usuario ve el login — no es un error
        // que deba interrumpir el arranque de la app.
      })
      .finally(() => setRestaurandoSesion(false));

    // Se suscribe una sola vez: cualquier 401 de cualquier request cierra
    // sesión y vuelve al login (ver client.ts).
    setUnauthorizedHandler(() => logout());
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      guardia,
      rol,
      esAdmin: rol === "Administrador" || guardia?.esComite === true,
      esPropietario: rol === "Residente" && guardia?.esPropietario === true,
      restaurandoSesion,
      requiereSeleccionCondominio: tokenIntermedio !== null,
      condominiosDisponibles,
      tokenIntermedio,
      nombreCondominioActual,
      login: async (usuariocol: string, password: string) => {
        const resultado = await apiLogin(usuariocol, password);
        if ("requiereSeleccionCondominio" in resultado) {
          setTokenIntermedio(resultado.token);
          setCondominiosDisponibles(resultado.condominios);
          return;
        }
        aplicarSesion(resultado);
      },
      seleccionarCondominio: async (condominioId: number) => {
        if (!tokenIntermedio) return;
        const resultado = await apiSeleccionarCondominio(tokenIntermedio, condominioId);
        aplicarSesion(resultado);
      },
      cambiarCondominio: async (condominioId: number) => {
        if (!token) return;
        const resultado = await apiSeleccionarCondominio(token, condominioId);
        aplicarSesion(resultado);
      },
      logout,
    }),
    [token, guardia, rol, restaurandoSesion, tokenIntermedio, condominiosDisponibles, nombreCondominioActual]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
