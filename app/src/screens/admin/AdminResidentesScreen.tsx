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

  // Ronda 36, a pedido explícito del usuario: datos adicionales opcionales
  // — se cargan junto con la creación, y se pueden editar después desde un
  // pequeño formulario por residente (ver perfilEnEdicion más abajo).
  const [rutNuevo, setRutNuevo] = useState("");
  const [fechaNacimientoNuevo, setFechaNacimientoNuevo] = useState("");
  const [profesionNuevo, setProfesionNuevo] = useState("");

  const [perfilEnEdicion, setPerfilEnEdicion] = useState<number | null>(null);
  const [rutEditar, setRutEditar] = useState("");
  const [fechaNacimientoEditar, setFechaNacimientoEditar] = useState("");
  const [profesionEditar, setProfesionEditar] = useState("");
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  // Acceso a la app (portal de residentes): activar por primera vez o
  // restablecer la contraseña de un residente que ya tiene acceso.
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
        rut: rutNuevo.trim() || undefined,
        fecha_nacimiento: fechaNacimientoNuevo.trim() || undefined,
        profesion: profesionNuevo.trim() || undefined,
      });
      setNombre("");
      setTorreSel(null);
      setUnidadSel(null);
      setTipoResidenteSel(null);
      setRutNuevo("");
      setFechaNacimientoNuevo("");
      setProfesionNuevo("");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleAbrirPerfil = (r: ResidenteAdmin) => {
    setPerfilEnEdicion(r.id_usuario);
    setRutEditar(r.rut ?? "");
    setFechaNacimientoEditar(r.fecha_nacimiento ?? "");
    setProfesionEditar(r.profesion ?? "");
  };

  const handleGuardarPerfil = async (id: number) => {
    if (!token) return;
    setGuardandoPerfil(true);
    try {
      await adminActualizarResidente(token, id, {
        rut: rutEditar.trim() || null,
        fecha_nacimiento: fechaNacimientoEditar.trim() || null,
        profesion: profesionEditar.trim() || null,
      });
      setPerfilEnEdicion(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardandoPerfil(false);
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

  // Ronda 37, a pedido explícito del usuario: ya no hay formulario — el
  // sistema genera todo (usuario "<siglas>_residente_<depto>" + clave
  // aleatoria de un solo uso, o solo la clave nueva si ya tenía usuario).
  // La clave queda en pantalla (Alert) SOLO esta vez, porque el backend la
  // guarda hasheada y no se puede volver a consultar — hay que
  // comunicársela al residente ahora.
  const handleActivarOrestablecerAcceso = (r: ResidenteAdmin) => {
    const yaTeniaAcceso = !!r.usuariocol;
    Alert.alert(
      yaTeniaAcceso ? "Restablecer contraseña" : "Activar acceso a la app",
      yaTeniaAcceso
        ? `Se va a generar una nueva contraseña temporal para "${r.usuariocol}". ${r.nombre_usuario} va a tener que elegir una contraseña propia la próxima vez que entre. ¿Continuar?`
        : `Se va a generar un usuario y una contraseña temporal para ${r.nombre_usuario}. La primera vez que entre, va a tener que elegir su propio usuario y contraseña. ¿Continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: yaTeniaAcceso ? "Restablecer" : "Activar",
          onPress: async () => {
            if (!token) return;
            setGuardandoAcceso(true);
            try {
              const resultado = await adminActivarAccesoResidente(token, r.id_usuario);
              Alert.alert(
                "Credenciales generadas",
                `Usuario: ${resultado.usuariocol}\nContraseña temporal: ${resultado.password_temporal}\n\nCompártelas con ${r.nombre_usuario} — no se van a poder volver a consultar después. Va a tener que cambiar la contraseña (y puede elegir un usuario nuevo) la primera vez que entre.`
              );
              cargar();
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setGuardandoAcceso(false);
            }
          },
        },
      ]
    );
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
            <TextInput
              style={styles.input}
              placeholder="RUT (opcional)"
              value={rutNuevo}
              onChangeText={setRutNuevo}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder="Fecha de nacimiento AAAA-MM-DD (opcional)"
              value={fechaNacimientoNuevo}
              onChangeText={setFechaNacimientoNuevo}
              keyboardType="numbers-and-punctuation"
            />
            <TextInput
              style={styles.input}
              placeholder="Profesión (opcional)"
              value={profesionNuevo}
              onChangeText={setProfesionNuevo}
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

          {perfilEnEdicion === item.id_usuario ? (
            <View style={styles.carnetForm}>
              <TextInput
                style={styles.input}
                placeholder="RUT (opcional)"
                value={rutEditar}
                onChangeText={setRutEditar}
                autoCapitalize="characters"
              />
              <TextInput
                style={styles.input}
                placeholder="Fecha de nacimiento AAAA-MM-DD (opcional)"
                value={fechaNacimientoEditar}
                onChangeText={setFechaNacimientoEditar}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={styles.input}
                placeholder="Profesión (opcional)"
                value={profesionEditar}
                onChangeText={setProfesionEditar}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.botonToggle, styles.botonActivar, { flex: 1 }]}
                  onPress={() => handleGuardarPerfil(item.id_usuario)}
                  disabled={guardandoPerfil}
                >
                  <Text style={styles.botonToggleTexto}>{guardandoPerfil ? "Guardando..." : "Guardar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.botonToggle, { backgroundColor: "#999", flex: 1 }]}
                  onPress={() => setPerfilEnEdicion(null)}
                >
                  <Text style={styles.botonToggleTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.enlaceCarnet} onPress={() => handleAbrirPerfil(item)}>
              <Text style={styles.enlaceCarnetTexto}>
                {item.rut || item.fecha_nacimiento || item.profesion
                  ? `RUT ${item.rut ?? "—"} · Nac. ${item.fecha_nacimiento ?? "—"} · ${item.profesion ?? "Sin profesión"}`
                  : "Agregar RUT / fecha de nacimiento / profesión"}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: "row", gap: 16, marginTop: 6 }}>
            <TouchableOpacity onPress={() => handleActivarOrestablecerAcceso(item)} disabled={guardandoAcceso}>
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

          {esAdministradorReal && (
            <TouchableOpacity style={{ marginTop: 6 }} onPress={() => handleToggleComite(item)}>
              <Text style={item.flg_comite ? styles.enlaceQuitarAcceso : styles.enlaceCarnetTexto}>
                {item.flg_comite ? "Quitar del comité" : "Agregar al comité de administración"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={{ marginTop: 6 }} onPress={() => handleTogglePropietario(item)}>
            <Text style={item.flg_propietario ? styles.enlaceQuitarAcceso : styles.enlaceCarnetTexto}>
              {item.flg_propietario ? "Quitar como dueño del depto" : "Marcar como dueño del depto"}
            </Text>
          </TouchableOpacity>
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
  carnetTexto: { color: "#014BD2", marginTop: 4, fontSize: 12, fontWeight: "600" },
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
  enlaceCarnetTexto: { color: "#014BD2", fontSize: 12, fontWeight: "600" },
  carnetForm: { marginTop: 10 },
});
