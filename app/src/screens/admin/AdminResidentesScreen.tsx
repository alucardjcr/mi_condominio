import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  adminActivarAccesoResidente,
  adminActualizarResidente,
  adminCrearResidente,
  adminGetResidentes,
  adminQuitarAccesoResidente,
  adminQuitarCarnetDiscapacidad,
  adminRegistrarCarnetDiscapacidad,
  getTiposResidente,
  getTorres,
  getUnidadesPorTorre,
} from "../../api/client";
import { ResidenteAdmin, TipoResidente, Torre, Unidad } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";

export default function AdminResidentesScreen() {
  const { token, rol } = useAuth();
  // Nombrar/quitar gente del comité es una potestad exclusiva del
  // Administrador real — un residente que entra aquí por ser comité
  // (esAdmin=true, rol="Residente") no debe ver esta acción. El backend
  // igual la rechaza con 403 aunque se intente forzar desde la app.
  const esAdministradorReal = rol === "Administrador";
  const [residentes, setResidentes] = useState<ResidenteAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [torres, setTorres] = useState<Torre[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [torreSel, setTorreSel] = useState<OpcionSelect | null>(null);
  const [unidadSel, setUnidadSel] = useState<OpcionSelect | null>(null);
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);

  // Tipo de residente (ronda 14): a qué título vive en el depto —
  // Propietario, Arrendatario, Pareja del propietario, Roomie, Familiar,
  // Otro. Pensado para que el administrador pueda informar a la PDI, si lo
  // piden, quién vive en una unidad y a qué título (puede haber varios
  // residentes con distinto tipo en el mismo depto).
  const [tiposResidente, setTiposResidente] = useState<TipoResidente[]>([]);
  const [tipoResidenteSel, setTipoResidenteSel] = useState<OpcionSelect | null>(null);
  const [tipoResidenteEnEdicion, setTipoResidenteEnEdicion] = useState<number | null>(null);

  const [carnetEnEdicion, setCarnetEnEdicion] = useState<number | null>(null);
  const [numeroCarnet, setNumeroCarnet] = useState("");

  // Acceso a la app (portal de residentes): activar por primera vez o
  // restablecer la contraseña de un residente que ya tiene acceso.
  const [accesoEnEdicion, setAccesoEnEdicion] = useState<number | null>(null);
  const [accesoUsuariocol, setAccesoUsuariocol] = useState("");
  const [accesoPassword, setAccesoPassword] = useState("");
  const [guardandoAcceso, setGuardandoAcceso] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      setResidentes(await adminGetResidentes(token));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargar();
    }, [cargar])
  );

  useEffect(() => {
    if (!token) return;
    getTorres(token, CONDOMINIO_ID).then(setTorres).catch((e) => Alert.alert("Error", e.message));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getTiposResidente(token).then(setTiposResidente).catch((e) => Alert.alert("Error", e.message));
  }, [token]);

  const handleSeleccionarTorre = async (opcion: OpcionSelect) => {
    setTorreSel(opcion);
    setUnidadSel(null);
    setUnidades([]);
    if (!token) return;
    setUnidades(await getUnidadesPorTorre(token, opcion.id));
  };

  const handleCrear = async () => {
    if (!token || !nombre || !unidadSel) {
      Alert.alert("Faltan datos", "Nombre, torre y depto son obligatorios.");
      return;
    }
    setCreando(true);
    try {
      await adminCrearResidente(token, {
        nombre_usuario: nombre,
        unidad_id_unidad: unidadSel.id,
        tipo_residente_id_tiporesidente: tipoResidenteSel ? Number(tipoResidenteSel.id) : undefined,
      });
      setNombre("");
      setTorreSel(null);
      setUnidadSel(null);
      setTipoResidenteSel(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleGuardarTipoResidente = async (r: ResidenteAdmin, opcion: OpcionSelect | null) => {
    if (!token) return;
    try {
      await adminActualizarResidente(token, r.id_usuario, {
        tipo_residente_id_tiporesidente: opcion ? Number(opcion.id) : null,
      });
      setTipoResidenteEnEdicion(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleToggle = async (r: ResidenteAdmin) => {
    if (!token) return;
    try {
      await adminActualizarResidente(token, r.id_usuario, { flg_vigencia: r.flg_vigencia ? 0 : 1 });
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleToggleComite = (r: ResidenteAdmin) => {
    if (!token) return;
    const activando = !r.flg_comite;
    const confirmar = () =>
      adminActualizarResidente(token, r.id_usuario, { flg_comite: activando ? 1 : 0 })
        .then(cargar)
        .catch((e: any) => Alert.alert("Error", e.message));

    if (activando) {
      Alert.alert(
        "Agregar al comité",
        `${r.nombre_usuario} va a tener los mismos permisos que un Administrador en toda la app (paquetería de todos los deptos, guardias, residentes, patentes, reportes, etc.). ¿Continuar?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Agregar al comité", onPress: confirmar },
        ]
      );
    } else {
      confirmar();
    }
  };

  // Designar al dueño de un depto (ronda 15): a diferencia del comité, esto
  // SÍ está habilitado para cualquiera que entre a esta pantalla (admin o
  // comité) porque es administración normal de una unidad, no una
  // escalada de permisos sobre todo el condominio. El dueño puede o no
  // vivir en el depto — sigue conservando el permiso para administrar el
  // listado de residentes de esa unidad desde su propia cuenta (ver
  // MiHogarScreen). A lo más un dueño por unidad: el backend le quita el
  // flag automáticamente a quien lo tuviera antes en el mismo depto.
  const handleTogglePropietario = (r: ResidenteAdmin) => {
    if (!token) return;
    const activando = !r.flg_propietario;
    const confirmar = () =>
      adminActualizarResidente(token, r.id_usuario, { flg_propietario: activando ? 1 : 0 })
        .then(cargar)
        .catch((e: any) => Alert.alert("Error", e.message));

    if (activando) {
      Alert.alert(
        "Marcar como dueño del depto",
        `${r.nombre_usuario} va a quedar como el dueño registrado de ${r.nombre_torre} ${r.numero_unidad}, viva ahí o no — va a poder administrar (agregar/editar/dar de baja) a los residentes de ese depto desde su propia cuenta. Si otro residente de esa unidad ya era el dueño, deja de serlo. ¿Continuar?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Marcar como dueño", onPress: confirmar },
        ]
      );
    } else {
      confirmar();
    }
  };

  const handleGuardarCarnet = async (r: ResidenteAdmin) => {
    if (!token) return;
    try {
      await adminRegistrarCarnetDiscapacidad(token, r.id_usuario, numeroCarnet || undefined);
      setCarnetEnEdicion(null);
      setNumeroCarnet("");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleQuitarCarnet = async (r: ResidenteAdmin) => {
    if (!token) return;
    try {
      await adminQuitarCarnetDiscapacidad(token, r.id_usuario);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleAbrirAcceso = (r: ResidenteAdmin) => {
    setAccesoEnEdicion(r.id_usuario);
    setAccesoPassword("");
    // Sugerencia de usuario cuando todavía no tiene acceso; si ya lo tiene,
    // se muestra el usuariocol actual (no editable, solo se puede
    // restablecer la contraseña).
    setAccesoUsuariocol(r.usuariocol ?? `depto${r.numero_unidad}`.toLowerCase());
  };

  const handleGuardarAcceso = async (r: ResidenteAdmin) => {
    if (!token) return;
    if (!accesoPassword || accesoPassword.length < 4) {
      Alert.alert("Contraseña muy corta", "Debe tener al menos 4 caracteres.");
      return;
    }
    setGuardandoAcceso(true);
    try {
      if (r.usuariocol) {
        // Ya tiene acceso: solo se restablece la contraseña, el usuario no cambia.
        await adminActualizarResidente(token, r.id_usuario, { password: accesoPassword });
      } else {
        if (!accesoUsuariocol.trim()) {
          Alert.alert("Falta el usuario", "Ingresa un nombre de usuario para el acceso.");
          setGuardandoAcceso(false);
          return;
        }
        await adminActivarAccesoResidente(token, r.id_usuario, {
          usuariocol: accesoUsuariocol.trim(),
          password: accesoPassword,
        });
      }
      setAccesoEnEdicion(null);
      setAccesoPassword("");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardandoAcceso(false);
    }
  };

  const handleQuitarAcceso = (r: ResidenteAdmin) => {
    if (!token) return;
    Alert.alert(
      "Quitar acceso",
      `${r.nombre_usuario} ya no va a poder entrar a la app con su usuario "${r.usuariocol}". ¿Continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Quitar acceso",
          style: "destructive",
          onPress: async () => {
            try {
              await adminQuitarAccesoResidente(token, r.id_usuario);
              cargar();
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };

  const residentesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return residentes;
    const q = busqueda.trim().toLowerCase();
    return residentes.filter(
      (r) => r.nombre_usuario.toLowerCase().includes(q) || r.numero_unidad.includes(q)
    );
  }, [residentes, busqueda]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={residentesFiltrados}
      keyExtractor={(item) => String(item.id_usuario)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View>
          <View style={styles.form}>
            <Text style={styles.formTitulo}>Nuevo residente</Text>
            <TextInput style={styles.input} placeholder="Nombre" value={nombre} onChangeText={setNombre} />
            <SelectModal
              label="Torre"
              placeholder="Selecciona una torre"
              opciones={torres.map((t) => ({ id: t.id_torreblock, label: t.nombre_torre }))}
              valorSeleccionado={torreSel}
              onSeleccionar={handleSeleccionarTorre}
            />
            <SelectModal
              label="Depto"
              placeholder={torreSel ? "Selecciona un depto" : "Primero elige la torre"}
              opciones={unidades.map((u) => ({ id: u.id_unidad, label: u.numero_unidad }))}
              valorSeleccionado={unidadSel}
              onSeleccionar={setUnidadSel}
              disabled={!torreSel}
            />
            <SelectModal
              label="Tipo de residente"
              placeholder="Ej: Propietario, arrendatario, roomie..."
              opciones={tiposResidente.map((t) => ({ id: t.id_tiporesidente, label: t.gls_tiporesidente }))}
              valorSeleccionado={tipoResidenteSel}
              onSeleccionar={setTipoResidenteSel}
            />
            <TouchableOpacity style={styles.botonCrear} onPress={handleCrear} disabled={creando}>
              <Text style={styles.botonCrearTexto}>{creando ? "Creando..." : "Crear residente"}</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.buscador}
            placeholder="Buscar por nombre o depto..."
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombreItem}>{item.nombre_usuario}</Text>
              <Text style={styles.detalle}>
                {item.nombre_torre} {item.numero_unidad} · {item.flg_vigencia ? "Activo" : "Inactivo"}
              </Text>
              {item.id_residentediscapacitado && (
                <Text style={styles.carnetTexto}>
                  ♿ Carnet discapacidad{item.numero_carnet ? `: ${item.numero_carnet}` : " registrado"}
                </Text>
              )}
              <Text style={item.usuariocol ? styles.accesoActivo : styles.accesoInactivo}>
                {item.usuariocol ? `🔑 Acceso a la app: ${item.usuariocol}` : "Sin acceso a la app todavía"}
              </Text>
              {!!item.flg_comite && <Text style={styles.comiteTexto}>👥 Miembro del comité de administración</Text>}
              {!!item.flg_propietario && <Text style={styles.propietarioTexto}>🏠 Dueño de {item.nombre_torre} {item.numero_unidad}</Text>}
              {tipoResidenteEnEdicion !== item.id_usuario && (
                <TouchableOpacity onPress={() => setTipoResidenteEnEdicion(item.id_usuario)}>
                  <Text style={styles.tipoResidenteTexto}>
                    🪪 {item.gls_tiporesidente ?? "Sin tipo de residente asignado"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.botonToggle, item.flg_vigencia ? styles.botonDesactivar : styles.botonActivar]}
              onPress={() => handleToggle(item)}
            >
              <Text style={styles.botonToggleTexto}>{item.flg_vigencia ? "Desactivar" : "Activar"}</Text>
            </TouchableOpacity>
          </View>

          {tipoResidenteEnEdicion === item.id_usuario && (
            <View style={styles.carnetForm}>
              <SelectModal
                label="Tipo de residente"
                placeholder="Selecciona un tipo"
                opciones={tiposResidente.map((t) => ({ id: t.id_tiporesidente, label: t.gls_tiporesidente }))}
                valorSeleccionado={
                  item.tipo_residente_id_tiporesidente && item.gls_tiporesidente
                    ? { id: item.tipo_residente_id_tiporesidente, label: item.gls_tiporesidente }
                    : null
                }
                onSeleccionar={(opcion) => handleGuardarTipoResidente(item, opcion)}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.botonToggle, { backgroundColor: "#999", flex: 1 }]}
                  onPress={() => setTipoResidenteEnEdicion(null)}
                >
                  <Text style={styles.botonToggleTexto}>Cerrar</Text>
                </TouchableOpacity>
                {item.tipo_residente_id_tiporesidente != null && (
                  <TouchableOpacity
                    style={[styles.botonToggle, styles.botonDesactivar, { flex: 1 }]}
                    onPress={() => handleGuardarTipoResidente(item, null)}
                  >
                    <Text style={styles.botonToggleTexto}>Quitar tipo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {carnetEnEdicion === item.id_usuario ? (
            <View style={styles.carnetForm}>
              <TextInput
                style={styles.input}
                placeholder="N° de carnet (opcional)"
                value={numeroCarnet}
                onChangeText={setNumeroCarnet}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.botonToggle, styles.botonActivar, { flex: 1 }]}
                  onPress={() => handleGuardarCarnet(item)}
                >
                  <Text style={styles.botonToggleTexto}>Guardar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.botonToggle, { backgroundColor: "#999", flex: 1 }]}
                  onPress={() => setCarnetEnEdicion(null)}
                >
                  <Text style={styles.botonToggleTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.enlaceCarnet}
              onPress={() =>
                item.id_residentediscapacitado ? handleQuitarCarnet(item) : setCarnetEnEdicion(item.id_usuario)
              }
            >
              <Text style={styles.enlaceCarnetTexto}>
                {item.id_residentediscapacitado
                  ? "Quitar registro de discapacidad"
                  : "Registrar carnet de discapacidad"}
              </Text>
            </TouchableOpacity>
          )}

          {accesoEnEdicion === item.id_usuario ? (
            <View style={styles.carnetForm}>
              {!item.usuariocol && (
                <>
                  <Text style={styles.subLabel}>Usuario</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ej: depto101"
                    value={accesoUsuariocol}
                    onChangeText={setAccesoUsuariocol}
                    autoCapitalize="none"
                  />
                </>
              )}
              <Text style={styles.subLabel}>{item.usuariocol ? "Nueva contraseña" : "Contraseña"}</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 4 caracteres"
                value={accesoPassword}
                onChangeText={setAccesoPassword}
                secureTextEntry
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.botonToggle, styles.botonActivar, { flex: 1 }]}
                  onPress={() => handleGuardarAcceso(item)}
                  disabled={guardandoAcceso}
                >
                  <Text style={styles.botonToggleTexto}>{guardandoAcceso ? "Guardando..." : "Guardar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.botonToggle, { backgroundColor: "#999", flex: 1 }]}
                  onPress={() => setAccesoEnEdicion(null)}
                >
                  <Text style={styles.botonToggleTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 16, marginTop: 6 }}>
              <TouchableOpacity onPress={() => handleAbrirAcceso(item)}>
                <Text style={styles.enlaceCarnetTexto}>
                  {item.usuariocol ? "Restablecer contraseña" : "Activar acceso a la app"}
                </Text>
              </TouchableOpacity>
              {item.usuariocol && (
                <TouchableOpacity onPress={() => handleQuitarAcceso(item)}>
                  <Text style={styles.enlaceQuitarAcceso}>Quitar acceso</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {esAdministradorReal && accesoEnEdicion !== item.id_usuario && (
            <TouchableOpacity style={{ marginTop: 6 }} onPress={() => handleToggleComite(item)}>
              <Text style={item.flg_comite ? styles.enlaceQuitarAcceso : styles.enlaceCarnetTexto}>
                {item.flg_comite ? "Quitar del comité" : "Agregar al comité de administración"}
              </Text>
            </TouchableOpacity>
          )}

          {accesoEnEdicion !== item.id_usuario && (
            <TouchableOpacity style={{ marginTop: 6 }} onPress={() => handleTogglePropietario(item)}>
              <Text style={item.flg_propietario ? styles.enlaceQuitarAcceso : styles.enlaceCarnetTexto}>
                {item.flg_propietario ? "Quitar como dueño del depto" : "Marcar como dueño del depto"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  form: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  buscador: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  botonCrear: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  nombreItem: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#666", marginTop: 2, fontSize: 13 },
  carnetTexto: { color: "#1a6fc4", marginTop: 4, fontSize: 12, fontWeight: "600" },
  accesoActivo: { color: "#1a9d5c", marginTop: 4, fontSize: 12, fontWeight: "600" },
  comiteTexto: { color: "#8e44ad", marginTop: 4, fontSize: 12, fontWeight: "600" },
  propietarioTexto: { color: "#0f766e", marginTop: 4, fontSize: 12, fontWeight: "600" },
  tipoResidenteTexto: { color: "#b0730a", marginTop: 4, fontSize: 12, fontWeight: "600" },
  accesoInactivo: { color: "#999", marginTop: 4, fontSize: 12 },
  subLabel: { fontSize: 12, fontWeight: "600", color: "#555", marginBottom: 4 },
  enlaceQuitarAcceso: { color: "#c0392b", fontSize: 12, fontWeight: "600" },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12, textAlign: "center" },
  enlaceCarnet: { marginTop: 10 },
  enlaceCarnetTexto: { color: "#1a6fc4", fontSize: 12, fontWeight: "600" },
  carnetForm: { marginTop: 10 },
});
