import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Ronda 16: registro del push token de Expo del teléfono, para que el
// backend pueda mandar un push real (además de dejarla siempre en la
// bandeja "Notificaciones" dentro de la app, que es lo único que no
// depende de nada de esto — ver NotificacionesScreen).
//
// IMPORTANTE — limitación conocida de este entorno de pruebas: desde el
// SDK 53 de Expo, el push REMOTO ya no funciona dentro de Expo Go (solo
// las notificaciones locales) — hace falta compilar una development build
// (`npx expo run:android` / EAS Build) para probarlo de verdad en un
// teléfono. Por eso esta función nunca lanza: si falla (permiso
// rechazado, corriendo en Expo Go, sin red), la app sigue funcionando
// igual — el residente simplemente no recibe el push al celular, pero
// sigue viendo todas sus notificaciones dentro de "Notificaciones" en la
// app en cuanto la abre.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function obtenerPushTokenExpo(): Promise<string | null> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const permisoActual = await Notifications.getPermissionsAsync();
    let status = permisoActual.status;
    if (status !== "granted") {
      const solicitado = await Notifications.requestPermissionsAsync();
      status = solicitado.status;
    }
    if (status !== "granted") return null;

    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : (undefined as any));
    return data ?? null;
  } catch {
    // Esperable en Expo Go (sin development build) o sin permiso — la app
    // sigue funcionando normal, solo sin push real al teléfono.
    return null;
  }
}
