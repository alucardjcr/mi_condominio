import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { superAdminCrearAdministrador, superAdminGetCondominios } from "../../api/client";
import { CondominioSimple } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import FotoCapture from "../../components/FotoCapture";
import DateField from "../../components/DateField";
import { esRutValido, formatearRut, formatearRutConPuntos } from "../../utils/validarRut";
import { AYUDA_PASSWORD, validarPassword } from "../../utils/validarPassword";
import { colors, radius, spacing, typography } from "../../theme/theme";

// Ronda 27, a pedido explícito del usuario: "solo yo podré crear el rol de
// administrador" — esta pantalla es exclusiva del SuperAdmin (backend la
// rechaza con 403 para cualquier otro rol, ver requireSuperAdmin).
//
// Ronda 67, a pedido explícito del usuario: perfil completo del
// administrador (foto, RUT, fecha de nacimiento, N° de registro RNAC
// opcional, correo, teléfono) — antes solo pedía nombre/usuario/clave.
// El condominio también pasó a ser opcional (ronda 66): si no se elige
// ninguno, el Administrador entra por el flujo de "crear mi primer
// condominio" la primera vez que se loguea.
//
// Ronda 71, a pedido explícito del usuario: el RUT se ve con puntos de
// miles en pantalla ("18.655.541-4") pero se sigue guardando/mandando al
// backend igual que antes (sin puntos, "18655541-4", dígito verificador
// pegado con guión — nunca aparte); y la fecha de nacimiento ahora tiene
// selector de calendario además de poder escribirse a mano.
export default function SuperAdminCrearAdminScreen({ navigation }: any) {
  const { token } = useAuth();
  const [condominios, setCondominios] = useState<CondominioSimple[]>([]);
  const [condominioId, setCondominioId] = useState<number | null>(null);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [usuariocol, setUsuariocol] = useState("");
  const [password, setPassword] = useState("");

  const [foto, setFoto] = useState<string | null>(null);
  const [rut, setRut] = useState("");
  const [rutError, setRutError] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [numeroRegistroRnac, setNumeroRegistroRnac] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    superAdminGetCondominios(token)
      .then(setCondominios)
      .catch((e) => setError(e.message));
  }, [token]);

  const handleCrear = async () => {
    setError(null);
    setExito(null);
    if (!nombreUsuario.trim() || !usuariocol.trim() || !password) {
      setError("Completa nombre, usuario y contraseña.");
      return;
    }
    // Ronda 72, a pedido explícito del usuario (hallazgo de seguridad): esta
    // pantalla dejaba crear un Administrador con una clave de 4 caracteres
    // — el backend ahora también lo rechaza (validarFortalezaPassword en
    // crearAdministrador), pero se valida acá primero para dar el error al
    // toque, sin esperar el viaje al servidor.
    const errorPassword = validarPassword(password);
    if (errorPassword) {
      setError(errorPassword);
      return;
    }
    if (!rut.trim()) {
      setError("Falta el RUT del administrador.");
      return;
    }
    if (!esRutValido(rut)) {
      setError("El RUT ingresado no es correcto. Revísalo antes de continuar.");
      return;
    }
    if (!fechaNacimiento.trim()) {
      setError("Falta la fecha de nacimiento.");
      return;
    }
    if (!correo.trim()) {
      setError("Falta el correo electrónico.");
      return;
    }
    if (!telefono.trim()) {
      setError("Falta el teléfono.");
      return;
    }
    if (!token) return;

    setEnviando(true);
    try {
      await superAdminCrearAdministrador(token, {
        nombre_usuario: nombreUsuario.trim(),
        usuariocol: usuariocol.trim(),
        password,
        condominio_id_condominio: condominioId ?? undefined,
        foto: foto || undefined,
        rut: formatearRut(rut),
        fecha_nacimiento: fechaNacimiento.trim(),
        numero_registro_rnac: numeroRegistroRnac.trim() || undefined,
        correo: correo.trim(),
        telefono: telefono.trim(),
      });
      setExito(
        condominioId
          ? `Cuenta "${usuariocol.trim()}" creada correctamente.`
          : `Cuenta "${usuariocol.trim()}" creada correctamente — sin condominio todavía. Al loguearse por primera vez, va a poder crear el suyo propio.`
      );
      setNombreUsuario("");
      setUsuariocol("");
      setPassword("");
      setCondominioId(null);
      setFoto(null);
      setRut("");
      setFechaNacimiento("");
      setNumeroRegistroRnac("");
      setCorreo("");
      setTelefono("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <FotoCapture label="Foto del administrador" value={foto} onChange={setFoto} recorteCuadrado />

        <Text style={styles.label}>Nombre completo</Text>
        <TextInput
          style={styles.input}
          value={nombreUsuario}
          onChangeText={setNombreUsuario}
          placeholder="ej: María Pérez"
          placeholderTextColor={colors.textMutedOnNavy}
        />

        <Text style={styles.label}>RUT</Text>
        <TextInput
          style={[styles.input, rutError && styles.inputConError]}
          value={rut}
          onChangeText={(t) => {
            setRut(t);
            setRutError(false);
          }}
          onBlur={() => {
            if (!rut.trim()) return;
            if (!esRutValido(rut)) {
              setRutError(true);
              Alert.alert("RUT inválido", "El RUT ingresado no es correcto. Revísalo (formato: 12.345.678-9).");
              return;
            }
            // Se muestra con puntos en pantalla; lo que se guarda y se manda
            // al backend sigue siendo sin puntos (formatearRut, en
            // handleCrear) — el dígito verificador nunca se guarda aparte,
            // siempre va pegado al cuerpo con el guión, en el mismo campo.
            setRut(formatearRutConPuntos(rut));
          }}
          placeholder="ej: 12.345.678-9"
          placeholderTextColor={colors.textMutedOnNavy}
          autoCapitalize="characters"
        />

        <DateField label="Fecha de nacimiento" value={fechaNacimiento} onChange={setFechaNacimiento} maximumDate={new Date()} />

        <Text style={styles.label}>N° de registro RNAC (opcional)</Text>
        <Text style={styles.ayudaChica}>Registro Nacional de Administradores de Condominios.</Text>
        <TextInput
          style={styles.input}
          value={numeroRegistroRnac}
          onChangeText={setNumeroRegistroRnac}
          placeholder="ej: RNAC-4521"
          placeholderTextColor={colors.textMutedOnNavy}
        />

        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          style={styles.input}
          value={correo}
          onChangeText={setCorreo}
          placeholder="ej: maria@ejemplo.cl"
          placeholderTextColor={colors.textMutedOnNavy}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          value={telefono}
          onChangeText={setTelefono}
          placeholder="ej: +56912345678"
          placeholderTextColor={colors.textMutedOnNavy}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Usuario (para loguearse)</Text>
        <TextInput
          style={styles.input}
          value={usuariocol}
          onChangeText={setUsuariocol}
          placeholder="ej: mperez"
          placeholderTextColor={colors.textMutedOnNavy}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Contraseña inicial</Text>
        <Text style={styles.ayudaChica}>{AYUDA_PASSWORD}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 12 caracteres"
          placeholderTextColor={colors.textMutedOnNavy}
          secureTextEntry
        />

        <Text style={styles.label}>Condominio al que queda vinculado (opcional)</Text>
        <View style={styles.listaCondominios}>
          {condominios.map((c) => (
            <TouchableOpacity
              key={c.id_condominio}
              style={[styles.opcionCondominio, condominioId === c.id_condominio && styles.opcionCondominioActiva]}
              onPress={() => setCondominioId(condominioId === c.id_condominio ? null : c.id_condominio)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.opcionCondominioTexto,
                  condominioId === c.id_condominio && styles.opcionCondominioTextoActivo,
                ]}
              >
                {c.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ayuda}>
          Si no eliges ningún condominio, esta cuenta va a poder crear el suyo propio la primera vez que se
          loguee — es el caso normal para un Administrador nuevo. Elegí uno solo si ya existe el condominio y
          querés vincularlo directo.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}
        {exito && <Text style={styles.exito}>{exito}</Text>}

        <TouchableOpacity
          style={[styles.boton, enviando && styles.botonDeshabilitado]}
          onPress={handleCrear}
          disabled={enviando}
          activeOpacity={0.85}
        >
          {enviando ? <ActivityIndicator color={colors.botonNaranjaTexto} /> : <Text style={styles.botonTexto}>Crear administrador</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.navy900 },
  card: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.lg },
  label: { ...typography.label, color: colors.textMutedOnNavy, marginTop: spacing.sm },
  ayuda: { ...typography.small, color: colors.textMutedOnNavy, marginTop: spacing.sm },
  ayudaChica: { ...typography.small, color: colors.textMutedOnNavy, marginTop: 2, fontSize: 11 },
  input: {
    borderWidth: 1,
    borderColor: colors.navy600,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 16,
    marginTop: 6,
    color: colors.textOnNavy,
    backgroundColor: colors.navy700,
  },
  inputConError: { borderColor: colors.danger, borderWidth: 1.5 },
  listaCondominios: { gap: spacing.xs, marginTop: 6 },
  opcionCondominio: { borderWidth: 1.5, borderColor: colors.navy600, backgroundColor: colors.navy700, borderRadius: radius.sm, padding: spacing.sm },
  opcionCondominioActiva: { borderColor: colors.botonNaranja, backgroundColor: colors.navy900 },
  opcionCondominioTexto: { color: colors.textMutedOnNavy, fontWeight: "600" },
  opcionCondominioTextoActivo: { color: colors.goldSoft },
  boton: { backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde, borderRadius: radius.sm, padding: 16, alignItems: "center", marginTop: spacing.lg },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: colors.botonNaranjaTexto, fontSize: 16, fontWeight: "800" },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
  exito: { color: colors.success, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
});
