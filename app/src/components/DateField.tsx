import React, { useState } from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors, radius, spacing, typography } from "../theme/theme";

interface Props {
  label: string;
  value: string; // "YYYY-MM-DD" (formato que se guarda), o "" si no hay fecha
  onChange: (isoDate: string) => void;
  maximumDate?: Date;
  separador?: "/" | "-"; // por defecto "/" (DD/MM/AAAA); "-" para DD-MM-AAAA
  opcional?: boolean; // si es true, borrar el texto deja la fecha vacía ("")
}

// Ronda 71, a pedido explícito del usuario: campo de fecha con dos formas
// de completarlo — escribiéndola a mano en formato DD/MM/AAAA (con las
// barras puestas solas mientras se escribe), o tocando el ícono de
// calendario para elegirla de un selector nativo. Por dentro siempre
// trabaja en ISO "YYYY-MM-DD" (lo que ya esperaba el backend) — la
// conversión de ida y vuelta queda encapsulada acá para no tocar cada
// pantalla que use fechas.

function isoADdMmYyyy(iso: string, sep = "/"): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}${sep}${m}${sep}${y}`;
}

// Solo devuelve un ISO cuando el texto ya es una fecha DD/MM/AAAA completa
// y real (ej. rechaza 31/02/2026) — mientras la persona sigue escribiendo,
// devuelve null y no se actualiza nada todavía.
function ddMmYyyyAIso(texto: string): string | null {
  const match = texto.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const dia = Number(d);
  const mes = Number(m);
  const anio = Number(y);
  if (mes < 1 || mes > 12) return null;
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null;
  return `${y}-${m}-${d}`;
}

// Inserta las barras "/" solas mientras se escriben dígitos
// (18091990 -> 18/09/1990), sin dejar escribir nada que no sea número.
function formatearMientrasEscribe(texto: string, sep = "/"): string {
  const soloDigitos = texto.replace(/\D/g, "").slice(0, 8);
  const partes = [soloDigitos.slice(0, 2), soloDigitos.slice(2, 4), soloDigitos.slice(4, 8)].filter(Boolean);
  return partes.join(sep);
}

export default function DateField({ label, value, onChange, maximumDate, separador = "/", opcional = false }: Props) {
  const [texto, setTexto] = useState(isoADdMmYyyy(value, separador));
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  const handleChangeTexto = (t: string) => {
    const formateado = formatearMientrasEscribe(t, separador);
    setTexto(formateado);
    if (opcional && formateado === "") {
      onChange("");
      return;
    }
    const iso = ddMmYyyyAIso(formateado);
    if (iso) onChange(iso);
  };

  const handleSeleccionarFecha = (_event: any, fecha?: Date) => {
    setMostrarCalendario(Platform.OS === "ios"); // en iOS el picker queda abierto hasta cerrarlo a mano
    if (fecha) {
      const iso = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
      setTexto(isoADdMmYyyy(iso, separador));
      onChange(iso);
    }
  };

  const fechaParaElPicker = (() => {
    const iso = ddMmYyyyAIso(texto) ?? value;
    if (!iso) return new Date(2000, 0, 1);
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.fila}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={texto}
          onChangeText={handleChangeTexto}
          placeholder={`DD${separador}MM${separador}AAAA`}
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={10}
        />
        <TouchableOpacity style={styles.botonCalendario} onPress={() => setMostrarCalendario(true)} activeOpacity={0.8}>
          <Text style={styles.botonCalendarioTexto}>📅</Text>
        </TouchableOpacity>
      </View>
      {mostrarCalendario && (
        <View style={styles.calendarioWrap}>
          <DateTimePicker
            value={fechaParaElPicker}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={maximumDate}
            onChange={handleSeleccionarFecha}
            locale="es-ES"
          />
          {/* Ronda 75, a pedido explícito del usuario ("gira el calendario
              pero no deja guardar la fecha"): en iOS el picker es tipo
              "spinner" — no tiene ningún botón propio para cerrarse, así
              que quedaba abierto para siempre (cada vuelta de rueda SÍ
              actualizaba la fecha por dentro, pero visualmente parecía que
              nunca "guardaba" nada porque el selector nunca se cerraba). En
              Android el propio diálogo nativo ya trae sus botones
              Aceptar/Cancelar, así que este botón extra solo hace falta acá. */}
          {Platform.OS === "ios" && (
            <TouchableOpacity style={styles.botonListo} onPress={() => setMostrarCalendario(false)} activeOpacity={0.8}>
              <Text style={styles.botonListoTexto}>Listo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  label: { ...typography.label, color: colors.textDark },
  fila: { flexDirection: "row", gap: spacing.xs, marginTop: 6, alignItems: "stretch" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 16,
    color: colors.textDark,
    backgroundColor: colors.offWhite,
  },
  botonCalendario: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.offWhite,
  },
  botonCalendarioTexto: { fontSize: 20 },
  calendarioWrap: { alignItems: "center" },
  botonListo: {
    backgroundColor: colors.navy900,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    marginTop: 4,
    marginBottom: spacing.xs,
    alignSelf: "center",
  },
  botonListoTexto: { color: colors.gold, fontWeight: "700", fontSize: 14 },
});
