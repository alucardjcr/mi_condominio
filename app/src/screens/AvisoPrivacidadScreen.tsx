import React from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, spacing, typography } from "../theme/theme";

function Titulo({ children }: { children: string }) {
  return <Text style={styles.titulo}>{children}</Text>;
}
function Parrafo({ children }: { children: React.ReactNode }) {
  return <Text style={styles.parrafo}>{children}</Text>;
}
function Item({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemVineta}>•</Text>
      <Text style={styles.itemTexto}>{children}</Text>
    </View>
  );
}

// Ronda 34, a pedido explícito del usuario: aviso de privacidad — Ley N°
// 21.719 de Protección de Datos Personales (Chile, vigente desde el 1 de
// diciembre de 2026). Este texto es contenido legal genérico y general;
// cada condominio/administración puede necesitar ajustarlo con su propio
// asesor legal antes de diciembre de 2026 (ej. el nombre exacto del
// responsable de datos). Accesible SIN sesión (desde Login) y también
// logeado (desde "Mis datos"), porque el aviso debe poder consultarse
// antes de entregar cualquier dato, no solo después.
export default function AvisoPrivacidadScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.encabezado}>Aviso de Privacidad</Text>
      <Text style={styles.actualizado}>Conforme a la Ley N° 21.719 de Protección de Datos Personales (Chile)</Text>

      <Titulo>¿Quién trata tus datos?</Titulo>
      <Parrafo>
        Mi Condominio es la aplicación que usa la administración de tu condominio para su operación diaria. El
        Administrador/Comité de tu condominio, junto con el proveedor de este software, tratan tus datos personales
        para los fines descritos en este aviso.
      </Parrafo>

      <Titulo>¿Qué datos recolectamos?</Titulo>
      <Item>Identidad: nombre, correo, usuario de acceso.</Item>
      <Item>Vivienda: depto/torre, si eres propietario o arrendatario.</Item>
      <Item>Vehículos: patentes registradas a tu unidad.</Item>
      <Item>Mascotas: nombre, especie, número de chip (si lo registras).</Item>
      <Item>Uso del condominio: paquetes recibidos, reservas de espacios comunes, visitas que registras.</Item>
      <Item>
        Datos sensibles, solo si aplica y con protección reforzada: información de discapacidad (para cupos
        reservados), o tu inclusión en el listado de control de acceso del condominio.
      </Item>
      <Item>Técnicos: registros de acceso a la app (ver "Registro de auditoría" para Administrador/Comité).</Item>

      <Titulo>¿Para qué los usamos?</Titulo>
      <Item>Operar el condominio: control de acceso, paquetería, reservas, gasto común, mantenciones.</Item>
      <Item>Cumplir obligaciones legales de la administración de condominios (Ley N° 21.442 de Copropiedad).</Item>
      <Item>Seguridad del condominio y sus residentes.</Item>
      <Item>Nunca se usan tus datos con fines de marketing ni se venden a terceros.</Item>

      <Titulo>¿Con quién se comparten?</Titulo>
      <Parrafo>
        Solo dentro del condominio: guardias, Administrador y Comité acceden a los datos necesarios para su rol,
        según lo definido en la app (ej. un guardia no ve tu correo, pero sí tu patente para control de acceso).
        No se comparten con terceros ajenos al condominio, salvo obligación legal.
      </Parrafo>

      <Titulo>¿Cuánto tiempo se guardan?</Titulo>
      <Parrafo>
        Mientras seas residente/usuario del condominio y por el plazo adicional que exija la ley para respaldar
        obligaciones del condominio (ej. registros de seguridad, gasto común). Puedes pedir la eliminación de datos
        puntuales desde "Mis datos" (ver más abajo).
      </Parrafo>

      <Titulo>Tus derechos (ARCO)</Titulo>
      <Parrafo>
        Tienes derecho a Acceder, Rectificar, Cancelar (eliminar) y Oponerte al uso de tus datos, además del derecho
        de Portabilidad. Puedes ejercerlos en cualquier momento, gratis, desde la sección{" "}
        <Text style={styles.destacado}>"Mis datos"</Text> de la app.
      </Parrafo>

      <Titulo>Seguridad</Titulo>
      <Parrafo>
        Tus fotos, firmas y comprobantes solo son accesibles con sesión iniciada. Todas las acciones sobre datos
        quedan registradas en un log de auditoría que Administrador/Comité puede revisar.
      </Parrafo>

      <Titulo>Contacto</Titulo>
      <Parrafo>
        Para consultas sobre tus datos, contacta a la administración de tu condominio directamente, o escribe a:
      </Parrafo>
      <TouchableOpacity onPress={() => Linking.openURL("mailto:privacidad@micondominio.cl")}>
        <Text style={styles.link}>privacidad@micondominio.cl</Text>
      </TouchableOpacity>

      <Text style={styles.nota}>
        Este es un aviso general — cada condominio puede ajustarlo con su propio asesor legal antes del 1 de
        diciembre de 2026.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.offWhite, gap: 2 },
  encabezado: { ...typography.title, color: colors.textDark, marginBottom: 2 },
  actualizado: { ...typography.small, color: colors.textMuted, marginBottom: spacing.lg },
  titulo: { ...typography.heading, color: colors.navy900, marginTop: spacing.lg, marginBottom: spacing.xs },
  parrafo: { ...typography.body, color: colors.textDark, lineHeight: 20 },
  item: { flexDirection: "row", marginTop: 4 },
  itemVineta: { color: colors.navy900, marginRight: 8, fontWeight: "800" },
  itemTexto: { ...typography.body, color: colors.textDark, flex: 1, lineHeight: 20 },
  destacado: { fontWeight: "800", color: colors.navy900 },
  link: { color: colors.info, fontWeight: "700", marginTop: 4 },
  nota: { ...typography.small, color: colors.textMuted, marginTop: spacing.xl, fontStyle: "italic" },
});
