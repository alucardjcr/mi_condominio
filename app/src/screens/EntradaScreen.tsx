import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  getResidentesConCarnetDiscapacidad,
  getResidentesPorUnidad,
  getTiposPermiso,
  getTorres,
  getUnidadesPorTorre,
  registrarEntrada,
} from "../api/client";
import { Residente, ResidenteConCarnet, TipoPermiso, Torre, Unidad } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import SelectModal, { OpcionSelect } from "../components/SelectModal";

const TIPO_VISITA_VEHICULAR_ID = 1;
const TIPO_VISITA_PEATONAL_ID = 2;
const GLS_PERMISO_DISCAPACITADO = "Discapacitado";
const GLS_PERMISO_PEATONAL = "Peatonal";

function describirPermiso(p: TipoPermiso): string {
  if (p.monto_fijo > 0) return `${p.gls_tipopermiso} — $${p.monto_fijo.toLocaleString("es-CL")}`;
  return `${p.gls_tipopermiso} — ${p.tiempo_gratis_minutos / 60} hrs gratis, luego $${p.tarifa_por_minuto_extra}/min`;
}

export default function EntradaScreen({ navigation }: any) {
  const { token } = useAuth();

  // Vehicular o peatonal (una peatonal no ocupa cupo de estacionamiento).
  const [esPeatonal, setEsPeatonal] = useState(false);

  // Solo relevante si es vehicular: cupo de visita normal, o uno de los 3 discapacitados.
  const [esDiscapacitado, setEsDiscapacitado] = useState(false);
  const [ocupanteResidente, setOcupanteResidente] = useState(false); // solo relevante si esDiscapacitado

  const [torres, setTorres] = useState<Torre[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [residentes, setResidentes] = useState<Residente[]>([]);
  const [tiposPermiso, setTiposPermiso] = useState<TipoPermiso[]>([]);
  const [residentesConCarnet, setResidentesConCarnet] = useState<ResidenteConCarnet[]>([]);

  const [torreSel, setTorreSel] = useState<OpcionSelect | null>(null);
  const [unidadSel, setUnidadSel] = useState<OpcionSelect | null>(null);
  const [residenteSel, setResidenteSel] = useState<OpcionSelect | null>(null);
  const [residenteLibre, setResidenteLibre] = useState("");
  const [usandoResidenteLibre, setUsandoResidenteLibre] = useState(false);
  const [permisoSel, setPermisoSel] = useState<OpcionSelect | null>(null);
  const [residenteDiscapacitadoSel, setResidenteDiscapacitadoSel] = useState<OpcionSelect | null>(null);
  const [carnetConfirmado, setCarnetConfirmado] = useState(false);

  const [patente, setPatente] = useState("");
  const [nombreVisita, setNombreVisita] = useState("");
  const [rutVisita, setRutVisita] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!token) return;
    getTorres(token, CONDOMINIO_ID).then(setTorres).catch((e) => Alert.alert("Error", e.message));
    getTiposPermiso(token).then(setTiposPermiso).catch((e) => Alert.alert("Error", e.message));
    getResidentesConCarnetDiscapacidad(token)
      .then(setResidentesConCarnet)
      .catch((e) => Alert.alert("Error", e.message));
  }, [token]);

  const permisoDiscapacitado = tiposPermiso.find((p) => p.gls_tipopermiso === GLS_PERMISO_DISCAPACITADO);
  const permisoPeatonal = tiposPermiso.find((p) => p.gls_tipopermiso === GLS_PERMISO_PEATONAL);
  const permisosNormales = tiposPermiso.filter(
    (p) => p.gls_tipopermiso !== GLS_PERMISO_DISCAPACITADO && p.gls_tipopermiso !== GLS_PERMISO_PEATONAL
  );

  const handleSeleccionarTorre = async (opcion: OpcionSelect) => {
    setTorreSel(opcion);
    setUnidadSel(null);
    setResidenteSel(null);
    setResidenteLibre("");
    setUsandoResidenteLibre(false);
    setUnidades([]);
    setResidentes([]);
    if (!token) return;
    setUnidades(await getUnidadesPorTorre(token, opcion.id));
  };

  const handleSeleccionarUnidad = async (opcion: OpcionSelect) => {
    setUnidadSel(opcion);
    setResidenteSel(null);
    setResidenteLibre("");
    setUsandoResidenteLibre(false);
    setResidentes([]);
    if (!token) return;
    setResidentes(await getResidentesPorUnidad(token, opcion.id));
  };

  const limpiarFormulario = () => {
    setPatente("");
    setNombreVisita("");
    setRutVisita("");
    setTorreSel(null);
    setUnidadSel(null);
    setResidenteSel(null);
    setResidenteLibre("");
    setUsandoResidenteLibre(false);
    setPermisoSel(null);
    setResidenteDiscapacitadoSel(null);
    setCarnetConfirmado(false);
    setEsDiscapacitado(false);
    setOcupanteResidente(false);
    setEsPeatonal(false);
  };

  const handleCambiarModoVisita = (peatonal: boolean) => {
    setEsPeatonal(peatonal);
    setEsDiscapacitado(false);
    setOcupanteResidente(false);
    setPermisoSel(null);
    setCarnetConfirmado(false);
  };

  const nombreResidenteFinal = usandoResidenteLibre ? residenteLibre : residenteSel?.label ?? "";

  const handleSubmit = async () => {
    if (!token) return;

    if (esPeatonal) {
      if (!permisoPeatonal) {
        Alert.alert("Error", "No se encontró el tipo de permiso 'Peatonal'. Revisa el seed.");
        return;
      }
      if (!torreSel || !unidadSel || !nombreVisita.trim() || !rutVisita.trim() || !nombreResidenteFinal.trim()) {
        Alert.alert(
          "Faltan datos",
          "Torre, depto, a quién visita, nombre y apellidos, y RUT son obligatorios para una visita peatonal."
        );
        return;
      }

      setEnviando(true);
      try {
        const resultado = await registrarEntrada(token, {
          tipo_visita_id_tipovisita: TIPO_VISITA_PEATONAL_ID,
          tipo_permiso_id_tipopermiso: permisoPeatonal.id_tipopermiso,
          condominio_id_condominio: CONDOMINIO_ID,
          nombre_visita: nombreVisita,
          rut_visita: rutVisita,
          unidad_id_unidad: unidadSel.id,
          nombre_residente_visitado: nombreResidenteFinal,
          residente_visitado_usuario_id: usandoResidenteLibre ? undefined : residenteSel?.id,
        });

        if (!resultado.residenteCoincide) {
          Alert.alert(
            "⚠️ Revisar antes de dejar pasar",
            `"${nombreResidenteFinal}" no coincide con ningún residente registrado en ${unidadSel.label}. Confirma con la visita antes de dejarla entrar.`
          );
        }

        // Ronda 20: alerta VETADOS — solo informativa, la entrada ya quedó
        // registrada igual. El guardia decide cómo proceder (ej. llamar a
        // Carabineros).
        if (resultado.alertaVetado) {
          Alert.alert(
            "🚨 PERSONA VETADA",
            `${resultado.alertaVetado.nombre_completo} (RUT ${resultado.alertaVetado.rut}) está en la lista de personas con prohibición de ingreso.${
              resultado.alertaVetado.parentesco ? `\n\nMotivo: ${resultado.alertaVetado.parentesco}` : ""
            }\n\nLa entrada ya quedó registrada — avisa a administración y/o Carabineros según corresponda.`
          );
        }

        Alert.alert(
          "Entrada peatonal registrada",
          `${nombreVisita} quedó registrado ingresando a pie a ${torreSel.label} ${unidadSel.label}. Es gratis y sin límite de tiempo — registrar su salida es opcional.`
        );
        limpiarFormulario();
        navigation.navigate("Home");
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setEnviando(false);
      }
      return;
    }

    if (esDiscapacitado && !permisoDiscapacitado) {
      Alert.alert("Error", "No se encontró el tipo de permiso 'Discapacitado'. Revisa el seed.");
      return;
    }

    if (esDiscapacitado && ocupanteResidente) {
      if (!residenteDiscapacitadoSel) {
        Alert.alert("Faltan datos", "Selecciona qué residente va a usar el cupo.");
        return;
      }
    } else {
      if (!torreSel || !unidadSel || !nombreResidenteFinal.trim() || !nombreVisita) {
        Alert.alert("Faltan datos", "Torre, depto, a quién visita y nombre de la visita son obligatorios.");
        return;
      }
      if (!esDiscapacitado && !permisoSel) {
        Alert.alert("Faltan datos", "Selecciona el tipo de permiso.");
        return;
      }
      if (esDiscapacitado && !carnetConfirmado) {
        Alert.alert(
          "Confirma el carnet",
          "Debes confirmar que revisaste el carnet de discapacidad de la visita antes de continuar."
        );
        return;
      }
    }

    setEnviando(true);
    try {
      const resultado = await registrarEntrada(token, {
        patente: patente || undefined,
        tipo_visita_id_tipovisita: TIPO_VISITA_VEHICULAR_ID,
        tipo_permiso_id_tipopermiso: esDiscapacitado ? permisoDiscapacitado!.id_tipopermiso : permisoSel!.id,
        condominio_id_condominio: CONDOMINIO_ID,
        ...(esDiscapacitado && ocupanteResidente
          ? {
              tipo_ocupante: "Residente" as const,
              residente_usuario_id: residenteDiscapacitadoSel!.id,
            }
          : {
              nombre_visita: nombreVisita,
              rut_visita: rutVisita || undefined,
              unidad_id_unidad: unidadSel!.id,
              nombre_residente_visitado: nombreResidenteFinal,
              residente_visitado_usuario_id: usandoResidenteLibre ? undefined : residenteSel?.id,
              carnet_discapacidad_confirmado: esDiscapacitado ? carnetConfirmado : undefined,
            }),
      });

      if (!esDiscapacitado && !resultado.residenteCoincide) {
        Alert.alert(
          "⚠️ Revisar antes de dejar pasar",
          `"${nombreResidenteFinal}" no coincide con ningún residente registrado en ${unidadSel?.label}. Confirma con la visita antes de asignar el estacionamiento.`
        );
      }

      let mensaje = resultado.cupoAsignado
        ? `Cupo asignado: ${resultado.visita.numero_estacionamiento}`
        : "No hay cupos disponibles en este momento. La visita quedó registrada igual.";

      if (resultado.cargoInmediato) {
        mensaje += `\n\nSe generó un cobro de $${resultado.cargoInmediato.monto_cobrar.toLocaleString(
          "es-CL"
        )} (${resultado.cargoInmediato.concepto}) al gasto común del depto.`;
      }

      // Ronda 20: alerta VETADOS — solo informativa, nunca bloquea el
      // registro (el guardia decide cómo proceder).
      if (resultado.alertaVetado) {
        Alert.alert(
          "🚨 PERSONA VETADA",
          `${resultado.alertaVetado.nombre_completo} (RUT ${resultado.alertaVetado.rut}) está en la lista de personas con prohibición de ingreso.${
            resultado.alertaVetado.parentesco ? `\n\nMotivo: ${resultado.alertaVetado.parentesco}` : ""
          }\n\nLa entrada ya quedó registrada — avisa a administración y/o Carabineros según corresponda.`
        );
      }

      Alert.alert("Entrada registrada", mensaje);
      limpiarFormulario();
      navigation.navigate("Home");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.tipoCupoSelector}>
          <TouchableOpacity
            style={[styles.tipoCupoBoton, !esPeatonal && styles.tipoCupoBotonActivo]}
            onPress={() => handleCambiarModoVisita(false)}
          >
            <Text style={[styles.tipoCupoTexto, !esPeatonal && styles.tipoCupoTextoActivo]}>
              🚗 Visita vehicular
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tipoCupoBoton, esPeatonal && styles.tipoCupoBotonActivo]}
            onPress={() => handleCambiarModoVisita(true)}
          >
            <Text style={[styles.tipoCupoTexto, esPeatonal && styles.tipoCupoTextoActivo]}>
              🚶 Visita peatonal
            </Text>
          </TouchableOpacity>
        </View>

        {!esPeatonal && (
          <View style={styles.tipoCupoSelector}>
            <TouchableOpacity
              style={[styles.tipoCupoBoton, !esDiscapacitado && styles.tipoCupoBotonActivo]}
              onPress={() => setEsDiscapacitado(false)}
            >
              <Text style={[styles.tipoCupoTexto, !esDiscapacitado && styles.tipoCupoTextoActivo]}>
                Cupo de visita
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tipoCupoBoton, esDiscapacitado && styles.tipoCupoBotonActivo]}
              onPress={() => setEsDiscapacitado(true)}
            >
              <Text style={[styles.tipoCupoTexto, esDiscapacitado && styles.tipoCupoTextoActivo]}>
                ♿ Cupo discapacitado
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!esPeatonal && esDiscapacitado && (
          <View style={styles.tipoCupoSelector}>
            <TouchableOpacity
              style={[styles.tipoCupoBoton, !ocupanteResidente && styles.tipoCupoBotonActivo]}
              onPress={() => setOcupanteResidente(false)}
            >
              <Text style={[styles.tipoCupoTexto, !ocupanteResidente && styles.tipoCupoTextoActivo]}>
                Es una visita
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tipoCupoBoton, ocupanteResidente && styles.tipoCupoBotonActivo]}
              onPress={() => setOcupanteResidente(true)}
            >
              <Text style={[styles.tipoCupoTexto, ocupanteResidente && styles.tipoCupoTextoActivo]}>
                Es un residente
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {esPeatonal ? (
          <>
            <Text style={styles.notaPeatonal}>
              La visita peatonal es gratis y no tiene límite de tiempo. No ocupa cupo de
              estacionamiento, y registrar su salida es opcional (puede que se retire sin avisar).
              Igual que en la visita vehicular, indicar a quién visita es obligatorio.
            </Text>

            <SelectModal
              label="Torre *"
              placeholder="Selecciona una torre"
              opciones={torres.map((t) => ({ id: t.id_torreblock, label: t.nombre_torre }))}
              valorSeleccionado={torreSel}
              onSeleccionar={handleSeleccionarTorre}
            />

            <SelectModal
              label="Depto *"
              placeholder={torreSel ? "Selecciona un depto" : "Primero elige la torre"}
              opciones={unidades.map((u) => ({ id: u.id_unidad, label: u.numero_unidad }))}
              valorSeleccionado={unidadSel}
              onSeleccionar={handleSeleccionarUnidad}
              disabled={!torreSel}
            />

            <SelectModal
              label="A quién visita *"
              placeholder={unidadSel ? "Selecciona un residente" : "Primero elige el depto"}
              opciones={residentes.map((r) => ({ id: r.id_usuario, label: r.nombre_usuario }))}
              valorSeleccionado={usandoResidenteLibre ? null : residenteSel}
              onSeleccionar={(o) => {
                setResidenteSel(o);
                setUsandoResidenteLibre(false);
              }}
              disabled={!unidadSel}
              extraFooterLabel="No está en la lista / no lo sabe"
              onExtraFooter={() => {
                setUsandoResidenteLibre(true);
                setResidenteSel(null);
              }}
            />

            {usandoResidenteLibre && (
              <>
                <Text style={styles.alerta}>
                  La visita no identificó a un residente precargado — verifica bien antes de dejarla
                  entrar.
                </Text>
                <TextInput
                  style={styles.input}
                  value={residenteLibre}
                  onChangeText={setResidenteLibre}
                  placeholder="Nombre que indicó la visita"
                />
              </>
            )}

            <Text style={styles.label}>Nombre y apellidos *</Text>
            <TextInput
              style={styles.input}
              value={nombreVisita}
              onChangeText={setNombreVisita}
              placeholder="Ej: Juan Pérez González"
            />

            <Text style={styles.label}>RUT *</Text>
            <TextInput
              style={styles.input}
              value={rutVisita}
              onChangeText={setRutVisita}
              placeholder="Ej: 12.345.678-9"
            />
          </>
        ) : esDiscapacitado && ocupanteResidente ? (
          <>
            <SelectModal
              label="Residente *"
              placeholder="Selecciona el residente registrado"
              opciones={residentesConCarnet.map((r) => ({
                id: r.id_usuario,
                label: `${r.nombre_usuario} — ${r.nombre_torre} ${r.numero_unidad}`,
              }))}
              valorSeleccionado={residenteDiscapacitadoSel}
              onSeleccionar={setResidenteDiscapacitadoSel}
            />
            {residentesConCarnet.length === 0 && (
              <Text style={styles.alerta}>
                No hay residentes con carnet de discapacidad registrado. El administrador debe
                registrarlo primero.
              </Text>
            )}
            <Text style={styles.label}>Patente</Text>
            <TextInput
              style={styles.input}
              value={patente}
              onChangeText={setPatente}
              placeholder="Ej: AB-CD-12"
              autoCapitalize="characters"
            />
          </>
        ) : (
          <>
            <SelectModal
              label="Torre *"
              placeholder="Selecciona una torre"
              opciones={torres.map((t) => ({ id: t.id_torreblock, label: t.nombre_torre }))}
              valorSeleccionado={torreSel}
              onSeleccionar={handleSeleccionarTorre}
            />

            <SelectModal
              label="Depto *"
              placeholder={torreSel ? "Selecciona un depto" : "Primero elige la torre"}
              opciones={unidades.map((u) => ({ id: u.id_unidad, label: u.numero_unidad }))}
              valorSeleccionado={unidadSel}
              onSeleccionar={handleSeleccionarUnidad}
              disabled={!torreSel}
            />

            <SelectModal
              label="A quién visita *"
              placeholder={unidadSel ? "Selecciona un residente" : "Primero elige el depto"}
              opciones={residentes.map((r) => ({ id: r.id_usuario, label: r.nombre_usuario }))}
              valorSeleccionado={usandoResidenteLibre ? null : residenteSel}
              onSeleccionar={(o) => {
                setResidenteSel(o);
                setUsandoResidenteLibre(false);
              }}
              disabled={!unidadSel}
              extraFooterLabel="No está en la lista / no lo sabe"
              onExtraFooter={() => {
                setUsandoResidenteLibre(true);
                setResidenteSel(null);
              }}
            />

            {usandoResidenteLibre && (
              <>
                <Text style={styles.alerta}>
                  La visita no identificó a un residente precargado — verifica bien antes de asignar
                  el cupo.
                </Text>
                <TextInput
                  style={styles.input}
                  value={residenteLibre}
                  onChangeText={setResidenteLibre}
                  placeholder="Nombre que indicó la visita"
                />
              </>
            )}

            <Text style={styles.label}>Nombre de la visita *</Text>
            <TextInput
              style={styles.input}
              value={nombreVisita}
              onChangeText={setNombreVisita}
              placeholder="Ej: Juan Pérez"
            />

            <Text style={styles.label}>Patente</Text>
            <TextInput
              style={styles.input}
              value={patente}
              onChangeText={setPatente}
              placeholder="Ej: AB-CD-12"
              autoCapitalize="characters"
            />

            <Text style={styles.label}>RUT</Text>
            <TextInput
              style={styles.input}
              value={rutVisita}
              onChangeText={setRutVisita}
              placeholder="Ej: 12.345.678-9"
            />

            {esDiscapacitado ? (
              <View style={styles.carnetRow}>
                <Switch value={carnetConfirmado} onValueChange={setCarnetConfirmado} />
                <Text style={styles.carnetTexto}>
                  Confirmo que revisé el carnet de discapacidad de la visita
                </Text>
              </View>
            ) : (
              <SelectModal
                label="Tipo de permiso *"
                placeholder="Selecciona el tipo de permiso"
                opciones={permisosNormales.map((p) => ({ id: p.id_tipopermiso, label: describirPermiso(p) }))}
                valorSeleccionado={permisoSel}
                onSeleccionar={setPermisoSel}
              />
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.boton, enviando && styles.botonDeshabilitado]}
          onPress={handleSubmit}
          disabled={enviando}
        >
          <Text style={styles.botonTexto}>{enviando ? "Registrando..." : "Registrar entrada"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  tipoCupoSelector: { flexDirection: "row", gap: 10, marginBottom: 4 },
  tipoCupoBoton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  tipoCupoBotonActivo: { backgroundColor: "#1a6fc4", borderColor: "#1a6fc4" },
  tipoCupoTexto: { fontWeight: "600", color: "#333" },
  tipoCupoTextoActivo: { color: "#fff" },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    marginTop: 4,
  },
  alerta: { color: "#c0392b", fontSize: 12, marginTop: 8 },
  notaPeatonal: {
    backgroundColor: "#eef6ff",
    color: "#1a6fc4",
    fontSize: 13,
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  carnetRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 10 },
  carnetTexto: { flex: 1, fontSize: 14, color: "#333" },
  boton: {
    backgroundColor: "#1a9d5c",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 28,
  },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
