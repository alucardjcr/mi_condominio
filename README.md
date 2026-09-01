# Mi Condominio — Estacionamientos + Paquetería + Reservas de Espacios Comunes + Login de Residentes + Comité + Dueños de Depto + Notificaciones + Gasto Común por Depto + Personal Externo (MVP)

Control de los 11 estacionamientos de visita + 3 de discapacitados del
condominio Valles de Varoli (entrada, salida, cobro por exceso de tiempo,
permisos especiales, consulta de patentes), del módulo de **paquetería**
de conserjería (recepción con foto, notificación, entrega con firma), del
módulo de **Reservas de Espacios Comunes** (configuración de áreas
comunes, solicitud → aprobación → pago con comprobante → reserva
confirmada, garantía, y el módulo de portería para marcar llegada/salida),
del **login/portal de residentes** (cada residente puede entrar a la app
con su propio usuario, ver sus paquetes y reservar espacios comunes), del
**tipo de residente** de cada persona registrada por depto (Propietario,
Arrendatario, Pareja del propietario, Roomie, Familiar, Otro — para poder
informar a la PDI quién vive en cada unidad y a qué título), del **rol
de Comité** (residentes que forman parte del comité de administración y
tienen los mismos permisos que el Administrador en toda la app), y de
**dueños de depto** (se guarda el propietario registrado de los 112
deptos, separado de quién vive ahí realmente — un depto puede estar
arrendado, y el dueño administra a distancia a los residentes de su
unidad desde su propia cuenta), de **notificaciones** (paquetes,
visitas y comunicados de administrador/comité le llegan al residente
como notificación dentro de la app, con push real al teléfono cuando
está disponible), de **gasto común por depto** (administrador/comité
marcan qué deptos están al día, lo que ya bloqueaba reservar espacios
comunes reservables si el depto tiene deuda), y de **personal externo**
(aseo, jardinería, mantención, etc. con login propio, turno que ellos
mismos marcan al entrar/salir, y tareas puntuales que administrador/comité
les escriben y les llegan como notificación) — sobre un mismo backend
con login de guardias y panel de administrador. La sesión de la app
ahora se mantiene guardada aunque se cierre (`expo-secure-store`), y
las fotos/firmas/comprobantes están listas para subirse a un storage
tipo S3 en vez de disco local en cuanto se contrate el hosting real.

## Estructura

```
mi-condominio-estacionamientos/
├── backend/     Node.js + TypeScript + Express — API REST (MySQL/MariaDB real)
├── app/         React Native (Expo) + TypeScript — app Android/iOS
└── docs/
    └── schema-mysql.sql   DDL consolidado de MySQL — única fuente de verdad del schema
```

## Reglas de negocio implementadas

**Estacionamientos de visita**
1. 11 cupos. 6 horas gratis; después se cobra $60 por minuto (permiso "Normal").
2. Torres y deptos precargados (6 torres, 112 deptos — datos reales de
   `Deptos por piso Varoli.pdf`) con residentes de referencia por depto.
   El guardia elige torre → depto → a quién visita (de la lista precargada,
   o texto libre si la visita no sabe/inventa un nombre, lo que dispara una
   alerta y queda marcado como "no coincide" para revisión).
3. Permiso 12 horas: $2.500 fijo, ignora la regla de 6 horas.
4. Permiso 24 horas: $5.000 fijo, ignora la regla de 6 horas.
5. Permiso fin de semana largo (2 a 4 días): $10.000 fijo, ignora la
   regla de 6 horas.
6. Todos los cobros quedan asociados a la unidad a través de la visita,
   listos para consolidarse a fin de mes en el gasto común. El
   administrador tiene un menú **Reporte gasto común** (fecha inicio,
   fecha término, botón buscar) que muestra, agrupado por torre/depto,
   cada visita que generó cobro con su fecha y hora de entrada y salida,
   el concepto y el monto — más el subtotal por depto y el total general
   del período elegido. *(La exportación real hacia el software de
   gasto común —por ejemplo un archivo o una integración— sigue
   pendiente; hoy el reporte se consulta desde la app.)*
7. Consulta de patentes del condominio: propietario/arrendatario, torre y depto.

**Visitas peatonales**
1. Al presionar ENTRADA, el guardia elige primero **visita vehicular** o
   **visita peatonal**. La peatonal no ocupa cupo de estacionamiento (no
   tiene auto), es gratis y no tiene límite de tiempo.
2. Se guarda nombre y apellidos, RUT, a qué torre/depto viene, y a quién
   visita dentro del depto — igual que en la visita vehicular, este último
   dato es obligatorio (de la lista precargada, o texto libre si la
   visita no sabe/inventa un nombre, lo que dispara una alerta y queda
   marcado como "no coincide" para revisión).
3. Registrar la salida es opcional: como puede que la visita se retire
   sin avisar al guardia, la visita peatonal queda abierta indefinidamente
   si nadie registra su salida (aparece en la pantalla de SALIDA junto a
   las demás, pero no bloquea nada si no se cierra).

**Estacionamientos de discapacitados**
1. 3 cupos, pool separado de los 11 de visita. Sin límite de tiempo y sin
   cobro — se liberan recién cuando la visita/residente se retira.
   - Si lo usa una **visita**, el guardia debe confirmar en la app que
     revisó el carnet de discapacidad (si no confirma, no se puede
     registrar la entrada).
   - Si lo usa un **residente**, debe estar registrado de antemano en la
     tabla `residente_discapacitado` (el administrador lo registra con su
     número de carnet); si no está registrado, la app lo rechaza.

**Paquetería**
1. Solo un guardia/conserje puede registrar la llegada de un paquete
   (no hay un perfil "conserje" aparte de "Guardia" en este MVP).
2. Al registrarlo: torre y depto obligatorios; a quién viene dirigido
   (de la lista de residentes precargados del depto, o texto libre con
   alerta si no coincide, igual que "a quién visita"); RUT del receptor
   opcional; tipo de paquete elegido de un combobox autocompletable con
   15 tipos (carta, paquete pequeño/mediano/grande, medicamento, etc.) —
   **opcional**: si el guardia no elige ninguno, queda como **"Bulto"**
   por defecto; y una **foto del paquete obligatoria** para dejar
   constancia del estado en que llegó.
3. Flujo de estados: **Recepcionado** → **Notificado** → **En portería**
   → **Entregado a residente**, con las salidas alternativas
   **Rechazado por el residente**, **Devuelto al remitente** y
   **Perdido** (con observación libre del motivo).
4. Notificación al residente: hoy el aviso real (WhatsApp) sigue siendo
   manual fuera del sistema — el guardia marca "Notificado" y "En
   portería" a mano desde la app. *(Cuando exista el módulo de
   notificaciones push con login de residentes, este paso se
   automatiza: el paquete pasa a "Notificado" solo al guardar la
   llegada y a "En portería" cuando el residente abre la notificación —
   ver "Supuestos" más abajo.)*
5. Entrega: **firma de quien retira siempre obligatoria** (reemplaza el
   cuaderno físico donde se firma hoy). Si retira la misma persona a la
   que venía dirigido el paquete, con la firma basta. Si retira otra
   persona, además de la firma son obligatorios su nombre **y una foto**
   de quien retira.
6. El residente puede retirar el paquete cuando quiera, sin plazo
   límite — pero si pasan **7 días sin que se retire**, la app lo marca
   con una alerta visual para que el administrador/comité decidan qué
   hacer. *(Ver "Supuestos": hoy es un aviso dentro de la app, no un
   push automático.)*
7. Consultas: el guardia ve todos los paquetes pendientes de portería, y
   puede buscar por rango de fechas, nombre o RUT del residente y estado
   (incluye ya entregados, con quién retiró y qué guardia lo entregó).
   El administrador/comité tienen la misma búsqueda para todos los
   deptos. *(La vista "mis paquetes" para que cada residente vea solo
   los suyos queda lista en el backend pero no tiene pantalla propia
   todavía — depende de que exista login de residentes.)*

**Login y perfiles**
8. Login de guardias — cada visita queda con el guardia que la creó y la
   fecha/hora.
9. 3 botones principales tras el login de un guardia: ENTRADA, SALIDA,
   CONSULTA PATENTE (más PAQUETES).
2. Tres perfiles: **Guardia** (los botones de arriba), **Administrador**
   (CRUD de guardias, de residentes por depto —incluyendo el registro de
   discapacidad y ahora también activar/quitar su acceso a la app—, de
   patentes de residentes, un módulo de auditoría que busca una patente y
   muestra qué guardia registró cada entrada/salida y cuándo, el reporte
   de gasto común, y la búsqueda de paquetería) y **Residente** (ver
   punto 10). El **Comité** no es un cuarto perfil aparte: es un residente
   con el flag `flg_comite` activado, que navega y opera con exactamente
   los mismos permisos que el Administrador (ver punto 14).

**Login de residentes / portal del residente**
10. Los residentes ya venían precargados por depto (sin login, solo como
    referencia para "a quién visita"/"a quién viene dirigido"). Ahora el
    administrador puede **activar el acceso** de cualquier residente
    (le asigna un usuario y una contraseña) para que entre a la misma app
    con el mismo endpoint de login que usan guardias y administrador — no
    hace falta una app aparte.
11. Un residente logeado solo ve **sus propios datos**: la pantalla
    "Mis paquetes" muestra únicamente los de su depto. Esto se refuerza en
    el backend (no solo en la app) — aunque el residente intente forzar
    otro depto en la consulta, el servidor siempre usa la unidad que quedó
    guardada en su sesión al loguearse, así que nunca puede ver los
    paquetes de otro depto.
12. Un residente **no puede** registrar entradas/salidas de visitas,
    recibir/entregar paquetes, ni consultar patentes de otros deptos —
    esas rutas ahora están restringidas explícitamente a Guardia/
    Administrador (antes alcanzaba con estar logeado porque solo
    guardias/administrador tenían usuario; con el portal de residentes ya
    no es así, así que se agregó el chequeo de rol correspondiente).
13. Cualquier usuario logeado (Guardia, Administrador o Residente) puede
    **cambiar su propia contraseña** desde la app pidiendo la actual —
    pensado sobre todo para que el residente reemplace la contraseña
    inicial que le dio el administrador. El administrador también puede
    restablecer la contraseña de un residente desde su ficha (por si la
    olvida) o quitarle el acceso por completo.

**Rol de Comité**
14. El comité de administración se identifica con un flag `flg_comite` en
    la ficha del residente (`1` = es del comité, `0` = no lo es) — no es un
    tipo de usuario nuevo, sigue siendo un Residente con su propio depto y
    su propia sesión. **Solo el Administrador puede nombrar o quitar gente
    del comité** — un miembro del comité, aunque tenga el resto de los
    permisos de administrador, no puede activar ni quitar `flg_comite` a
    nadie (ni a otros residentes ni a sí mismo); esto está reforzado en el
    backend (devuelve 403 si lo intenta, sin importar lo que mande la app)
    y en la app el enlace "Agregar al comité de administración" / "Quitar
    del comité" en RESIDENTES **solo aparece cuando quien está logeado es
    el Administrador real**, no cuando es un comité viendo la misma
    pantalla.
15. Un residente con `flg_comite=1` tiene, en todo lo demás, **exactamente
    los mismos permisos que el Administrador en toda la app**: ve GUARDIAS,
    RESIDENTES, PATENTES, AUDITORÍA, REPORTE GASTO COMÚN y PAQUETES de
    todos los deptos (no solo el propio), puede crear/editar/desactivar
    guardias, residentes y patentes, y (cuando se construya) podrá aprobar
    reservas y validar pagos igual que el administrador. En el Home ve su
    propio depto (como cualquier residente) con un "· Comité" junto al
    nombre de la torre, para distinguir que está navegando el menú de
    administrador por ser comité.

**Tipo de residente**

16. Cada residente registrado en un depto tiene, además de su nombre, un
    **tipo de residente**: Propietario, Arrendatario, Pareja del
    propietario, Roomie, Familiar u Otro. Puede haber **varios residentes
    con distinto tipo en el mismo depto** (ej. un propietario que vive con
    su pareja y dos roomies — los cuatro quedan registrados en la misma
    unidad, cada uno con su propio tipo). Pensado para que el
    administrador pueda informar a la PDI, si se lo piden, quién vive en
    una unidad y a qué título. El administrador puede asignar o cambiar el
    tipo de cualquier residente (o dejarlo sin asignar) desde su ficha en
    RESIDENTES.

**Reservas de Espacios Comunes**

17. En Valles de Varoli no existe hoy ningún espacio común arrendable — el
    módulo se construyó igual, de forma genérica, para que cada
    condominio configure sus propias áreas comunes.
18. Cada espacio puede ser **de libre uso** (sin reserva, disponible para
    cualquier residente con el gasto común al día) o **reservable**
    (`flg_reservable`); y **gratuito o pagado** (`flg_gratuito`, con
    precio por bloque de horas configurable).
19. Puede reservar cualquier **residente con el gasto común al día**
    (`flg_gastocomun=1` en `unidad`), además del **comité y el
    administrador** (a nombre de un residente, por ejemplo cuando llaman
    por teléfono). **El guardia no puede reservar.**
20. Toda reserva de un espacio reservable pasa primero por aprobación de
    administrador/comité: **Pendiente → Aprobado / Rechazado** (el
    rechazo exige un motivo).
21. Si el espacio es pagado: tras la aprobación, el residente sube el
    **comprobante de la transferencia** (tarifa + garantía si aplica)
    desde la app (foto, mismo patrón que paquetería); administrador/comité
    **valida manualmente** que el pago llegó y ahí pasa a **Reservado**.
    Si no se valida el pago hasta **2 días antes** de la fecha de uso, la
    reserva **expira automáticamente** (sin cron: se recalcula al
    consultar cualquier listado de reservas) y el horario se libera. Si el
    espacio es gratuito, pasa directo a Reservado al aprobarse.
22. **Configuración por espacio** (administrador/comité, mismos permisos):
    horario de apertura/cierre, días de la semana disponibles, minutos de
    separación entre arriendos (aseo), días máximos de anticipación para
    reservar, días mínimos para que un residente cancele, tarifa, monto de
    garantía, tarifa adicional por minuto de atraso, y un rango de
    temporada opcional (ej. piscina disponible solo del 1 dic al 28 feb).
23. **Garantía**: se paga junto con la tarifa (mismo comprobante). Al
    finalizar el uso, administrador/comité decide si se devuelve o se
    retiene (total o parcialmente, con motivo) — es un registro aparte del
    ciclo de estados de la reserva y **no se carga al gasto común**.
24. El guardia tiene un módulo **"Reserva área común"**: ve las reservas
    confirmadas del día (espacio, depto, horario), y cuando el residente
    llega marca **llegada → En uso**; cuando se retira, marca
    **salida → Finalizado**.
25. Si el residente se pasa del horario reservado, el sistema calcula los
    **minutos de exceso × la tarifa por minuto** configurada y ese monto
    se carga al **mismo reporte de gasto común** que usa estacionamientos
    (agrupado por depto, junto a los cobros de exceso de tiempo de visita).
26. **Cancelación**: el residente puede cancelar su propia reserva desde
    la app mientras esté Pendiente/Aprobada/Reservada (respetando los días
    mínimos de cancelación configurados por espacio); administrador/comité
    puede cancelar cualquiera sin esa restricción. Libera el horario de
    inmediato.
27. **No se permite traslape de horarios** sobre el mismo espacio,
    considerando el tiempo de aseo configurado entre arriendos.
28. El comité tiene, para todo este módulo, exactamente los mismos
    permisos que el administrador (configurar espacios, aprobar/rechazar,
    validar pagos, resolver garantías) — reutiliza el mismo
    `calificaParaRol` del resto de la app, sin lógica nueva.

**Dueños de depto**

29. Se guarda, para cada uno de los 112 deptos, quién es su **propietario
    registrado** (`flg_propietario=1` en su ficha de `usuario`) —
    independiente de si esa persona **vive o no** en el depto. Un dueño
    que no vive ahí (lo tiene arrendado) igual tiene su propia cuenta con
    login en la app y administra a distancia a quienes sí viven en su
    unidad — el ejemplo que diste: el depto está en Talca, el dueño vive
    en Santiago, y desde su casa administra a los residentes de su depto.
30. **Solo el dueño del depto (`flg_propietario=1`) puede editar a los
    integrantes de su hogar** desde su propia cuenta — no un arrendatario
    ni ningún otro residente. Esto es aparte de los permisos que ya tenían
    Administrador/Comité, que siguen pudiendo editar residentes de
    cualquier depto como antes. El dueño entra a un menú propio
    **"Administrar mi hogar"** donde puede **agregar, editar el tipo de
    residente, y dar de baja** a las personas que viven en su depto — un
    CRUD acotado a su propia unidad, nunca a las de otros deptos (el
    backend siempre revalida esto, no confía en lo que mande la app).
31. Un depto puede tener **como máximo un dueño a la vez**: si se marca a
    alguien como dueño de un depto que ya tenía otro dueño, el anterior
    pierde el flag automáticamente (transferencia de propiedad, por
    ejemplo por venta del depto) — no hace falta un paso aparte para
    "quitarle" la propiedad al dueño anterior.
32. El dueño **no puede darse de baja a sí mismo** desde "Administrar mi
    hogar" (para que nunca quede bloqueado de administrar su propio
    depto) — si de verdad hay que sacarlo, lo hace el Administrador/Comité
    desde RESIDENTES.
33. Marcar o quitar a alguien como dueño de un depto (el flag
    `flg_propietario`) lo puede hacer tanto el **Administrador como el
    Comité** desde RESIDENTES — a diferencia de `flg_comite`, que sigue
    siendo exclusivo del Administrador real (ver punto 14), porque asignar
    la propiedad de un depto se trató como administración normal de una
    unidad, no como un poder a nivel de todo el condominio.

**Notificaciones**

34. **Paquetes**: al recepcionarse uno (regla de paquetería, punto 2), le
    llega una notificación —"Nuevo paquete"— a todos los residentes
    activos con acceso de ese depto (no solo a la persona a la que venía
    dirigido). Cuando el guardia lo marca **"En portería"**, le llega una
    segunda notificación —"Paquete en portería"— avisando que ya puede
    retirarlo. Si pasan **7 días sin que se retire**, además del badge
    visual que ya existía (regla de paquetería, punto 6), ahora también le
    llega una notificación de alerta — una sola vez por paquete, no se
    repite en cada consulta.
35. **Visitas**: cuando el guardia registra el ingreso de una visita
    (vehicular o peatonal) a un depto, le llega una notificación —"Visita
    registrada"— a todos los residentes activos con acceso de ese depto,
    exactamente lo que pediste ("las visitas también deben llegarle como
    notificación al residente"). No aplica cuando quien usa un cupo de
    discapacitados es el propio residente (no hay ninguna "visita" que
    avisar en ese caso).
36. **Comunicados**: administrador o comité pueden redactar un comunicado
    (título + mensaje) desde **"Enviar comunicado"**, y le llega como
    notificación a **todos** los residentes activos con acceso del
    condominio — de cualquier depto, no solo de uno — tal como pediste.
37. Toda notificación queda **siempre guardada** en la bandeja
    "Notificaciones" dentro de la app de cada destinatario (con su propio
    leído/no leído), sin importar si el push real al teléfono funcionó o
    no. El **push real** (aviso en la pantalla de bloqueo/notificaciones
    del sistema operativo) se intenta además cuando el residente tiene su
    teléfono registrado — ver "Supuestos" más abajo sobre las limitaciones
    de esto en Expo Go.

**Gasto común por depto**

38. `flg_gastocomun` sobre `unidad` (la tabla de deptos) ya existía desde
    la ronda 14 y ya bloqueaba reservar un espacio común **reservable**
    (arriendo) si el depto tenía deuda — pero solo se podía cambiar por
    SQL directo. Ahora administrador/comité lo administran desde
    **"GASTO COMÚN POR DEPTO"**: lista de todos los deptos con su estado
    (Al día / Con deuda) y un botón para alternarlo.
39. Marcar o quitar el gasto común al día lo puede hacer tanto el
    **Administrador como el Comité** — mismo criterio que `flg_propietario`
    (punto 33): se trató como administración rutinaria de un depto
    puntual, no como un poder a nivel de todo el condominio.
40. Por ahora el flag **solo se usa para dos cosas**, tal como pediste:
    identificar qué deptos están al día, y bloquear (o permitir) que
    reserven espacios comunes reservables. No bloquea el acceso a
    espacios de **libre uso** (piscina, gimnasio) porque esos no pasan
    por ningún flujo de reserva en la app — no hay ningún control digital
    de acceso a ellos hoy.

**Personal externo (aseo, jardinería, mantención, etc.)**

41. Cada trabajador (la señora del aseo, el jardinero, el maestro que
    repara los techos, etc.) queda registrado con **login propio** en la
    app — usuario y contraseña asignados por administrador/comité al
    crearlo, igual que un guardia (no un flujo de "activar acceso" aparte
    como en Residente, porque el personal siempre tiene cuenta desde el
    día uno). Cada uno tiene una **especialidad** (Aseo, Jardinería,
    Mantención, Conserjería externa, Otro).
42. **Turno**: el propio trabajador marca **"Empezar turno"** y **"Marcar
    salida"** desde su celular (autoservicio, no lo marca el guardia) —
    así queda registrada la fecha y el horario exacto en que estuvo en el
    condominio. No puede tener dos turnos abiertos a la vez.
43. **Tareas**: administrador o comité le escriben una tarea puntual de
    texto libre a un trabajador específico (ej. "cortar árboles costado
    sur") desde **"PERSONAL EXTERNO" → Asignar tarea**. Le llega como
    **notificación** (bandeja + push best-effort, mismo sistema de la
    ronda 16) — a propósito **no es una plantilla de checklist**: dijiste
    que ellos ya saben sus deberes diarios, así que cada tarea es un
    mensaje suelto que el trabajador marca como completado desde su
    propia app cuando termina.
44. El **historial de cumplimiento** (qué tareas se completaron, cuándo, y
    el historial de turnos de cada trabajador) solo lo ve **administrador
    y comité** — ni otro trabajador de personal externo ni ningún
    residente pueden verlo, tal como pediste.

### Supuestos que hice y que conviene confirmar

- **Guardias/residentes no se borran, se desactivan**: como las visitas
  quedan enlazadas al guardia que las creó (para la auditoría), el CRUD
  no elimina filas — usa `flg_vigencia` para activar/desactivar. Avísame
  si necesitas borrado real.
- **Patentes "asignadas a cada estacionamiento"**: entendí esto como que
  cada patente de residente queda asociada a su depto (`unidad_id_unidad`
  en `patente_condominio`), que a su vez puede tener cupos de tipo
  "Residente" reservados en `estacionamiento.unidad_id_unidad` (ya estaba
  en tu ERD original). Si lo que necesitas es enlazar la patente
  directamente a un número de cupo específico, dime y lo agrego.
- Los residentes precargados de deptos que no registraste explícitamente
  siguen siendo datos de prueba (`Residente 101`, etc.) — el administrador
  ya puede reemplazarlos uno por uno desde la app, o dime si prefieres que
  te deje un script de carga masiva (CSV).
- **Paquetería — columnas que agregué sobre tu tabla `paquete` original**:
  `foto_recepcion_url` (obligatoria), `firma_retiro_url` y
  `foto_retiro_url` (condicional) para las fotos/firma que pediste, y
  `residente_receptor_usuario_id`/`receptor_coincide` (mismo patrón que
  "a quién visita" en estacionamientos) para poder enlazar el paquete a
  un residente real cuando coincide. También agregué el tipo "Bulto" al
  catálogo `tipo_paquete` (no estaba en tu ERD) como default.
- **RUT del receptor**: hoy no existe una tabla de RUTs de residentes en
  el sistema (el `usuario` precargado no tiene ese campo), así que el
  filtro "por RUT" que pediste funciona sobre un campo `rut_receptor`
  opcional que el guardia puede escribir al recibir el paquete, no sobre
  una ficha del residente. Si prefieres que el RUT quede en la ficha del
  residente (y se autocomplete solo), dime y lo cambio cuando construyamos
  el módulo de residentes/usuarios a fondo.
- **Notificación push y alerta de 7 días como aviso automático**: todavía
  no hay login de residentes ni un módulo de notificaciones push (son dos
  de los módulos que quedan pendientes del ERD completo). Mientras tanto,
  "Notificado"/"En portería" los marca el guardia a mano después de avisar
  por WhatsApp como hacen hoy, y la alerta de 7 días es un badge visual
  dentro de la app (no un push al celular del administrador/comité).
  Cuando construyamos esos dos módulos, esta parte de paquetería se
  conecta directo sin cambiar el flujo que ya ves acá.
- **Fotos y firma — almacenamiento**: por defecto se siguen guardando como
  archivos en disco del propio backend (carpeta `backend/uploads/`),
  servidos por Express — nada cambió acá para quien no toque nada. Desde
  la ronda 17 esto es **S3-ready**: ver el bloque de "Storage S3-ready"
  más abajo, con el detalle de cómo activarlo cuando tengas el hosting.
- **Login de residentes — cómo se generan usuario/contraseña**: no venía
  definido, así que hice lo mismo que ya usan guardias/administrador —el
  administrador escribe el usuario (le sugiero uno del tipo `depto101`,
  pero lo puede cambiar) y una contraseña al activar el acceso. No hay
  todavía "olvidé mi contraseña" por correo (no hay envío de correos en
  este MVP) — si el residente la pierde, el administrador se la
  restablece desde su ficha. Dime si prefieres otro criterio (por ejemplo
  usuario = RUT, o invitación por correo/WhatsApp con clave temporal).
- **Rol "Comité"**: implementado como el flag `flg_comite` sobre la ficha
  del residente (ver punto 14-15 arriba), con los mismos permisos que
  Administrador en toda la app — esta fue la opción que elegiste entre las
  alternativas que te planteé. La lógica de permisos quedó centralizada en
  una sola función (`calificaParaRol`) que trata "es comité" como
  equivalente a "es Administrador" en cualquier ruta protegida, así que el
  módulo de Reservas de Espacios Comunes (cuando se construya) no va a
  necesitar lógica de permisos adicional para el comité.

- **Reservas de Espacios Comunes — columnas que agregué sobre el ERD
  original**: el ERD traía `espacio_comun`, `tarifa_espaciocomun`,
  `reserva_espaciocomun` y `estado_reserespaciocomun`, pero sin columnas
  para casi nada de la configuración pedida (garantía, tarifa de atraso,
  temporada, días/horario disponibles, minutos de separación, anticipación
  máxima, cancelación mínima, comprobante, quién aprobó/rechazó/canceló,
  llegada/salida, exceso). Se simplificó `tarifa_espaciocomun` directamente
  como columnas en `espacio_comun` (un espacio, una tarifa vigente) en vez
  de mantenerla como tabla aparte, porque no se pidió historial de tarifas
  pasadas. Si más adelante se necesita que la tarifa cambie con historial
  (ej. "desde marzo sube el precio, pero las reservas ya hechas mantienen
  el precio viejo"), esto ya está cubierto aparte: `monto_tarifa`/
  `monto_garantia` quedan "congelados" en la propia fila de la reserva al
  crearla, así que un cambio de tarifa a futuro nunca afecta reservas ya
  existentes.
- **Fechas/horas reales, no `VARCHAR`**: a diferencia del resto del schema
  MVP (estacionamientos, paquetería), las columnas de Reservas usan tipos
  `DATE`/`TIME`/`DATETIME` reales de MySQL — este módulo necesita
  aritmética real de fechas para detectar traslapes de horarios y calcular
  rangos de temporada, cosa que el patrón `VARCHAR` del resto del schema no
  permite hacer bien.
- **Expiración automática sin cron**: este MVP no tiene infraestructura de
  tareas programadas, así que en vez de un cron que revise reservas
  vencidas cada cierto tiempo, la expiración (regla 21) se recalcula "de
  forma perezosa" cada vez que se lista cualquier grupo de reservas (mis
  reservas, reservas del día, panel admin) — el resultado es el mismo para
  quien usa la app, pero si necesitas el estado "Expirado" reflejado sin
  que nadie haya abierto la app entre medio, hay que agregar un cron real.
- **Gasto común al día (`flg_gastocomun`)**: no existía en el schema MVP
  (sí en el ERD completo de 35 tablas) — se agregó a `unidad` con default
  `1` (al día). Desde la ronda 17 el administrador/comité ya lo puede
  marcar manualmente desde la app (ver "GASTO COMÚN POR DEPTO" arriba) —
  sigue sin haber ninguna integración automática con el sistema real de
  gasto común (nada lo pone en `0` solo cuando alguien atrasa un pago),
  tal como confirmaste que se usaría por ahora: solo para identificar
  quién está al día y bloquear/permitir reservas.
- **`tipo_residente` — quedó sin asignar en los residentes de prueba
  antiguos**: los residentes placeholder que ya existían antes de esta
  ronda (`Residente 101`, `Residente 102`, etc.) se les asignó
  "Propietario" por default al correr el seed; el depto 101 además ahora
  trae 3 personas más de ejemplo (pareja + 2 roomies) para poder probar el
  caso que describiste. El resto de los deptos quedan con un solo
  residente placeholder — agregar los residentes reales de cada depto (y
  su tipo correcto) sigue siendo trabajo manual del administrador, igual
  que ya pasaba con los nombres.

- **Dueños de depto — "al menos un dueño por depto" no es una regla
  reforzada todavía**: técnicamente hoy un depto podría quedar sin nadie
  marcado como `flg_propietario=1` si el administrador nunca lo asigna
  (el seed sí deja un dueño en cada uno de los 112 deptos, pero no hay
  validación que impida borrarlo sin reemplazo). Lo que sí está reforzado
  es que **nunca puede haber más de uno a la vez** (transferencia
  automática, punto 31). Avísame si prefieres que sea obligatorio tener
  siempre exactamente un dueño.
- **No se construyó un "registro legal" de dueños aparte (RUT, contacto,
  escritura, etc.)** — según tu respuesta, cada dueño tiene una cuenta
  completa de la app igual que un residente (mismo `usuario`, mismo
  login), no una ficha de registro separada sin acceso. Si más adelante
  necesitas guardar datos adicionales del dueño (RUT, teléfono de
  contacto, fecha de escritura), se pueden agregar como columnas nuevas
  sobre la misma fila de `usuario` sin cambiar el diseño.
- **Qué puede tocar el dueño desde "Administrar mi hogar" y qué sigue
  siendo solo del Administrador/Comité**: el dueño puede agregar/editar
  tipo/dar de baja residentes de su depto, pero **no puede** desde ahí
  activarles acceso a la app a otros (usuario/contraseña), registrar su
  carnet de discapacidad, ni marcar a nadie como comité o como dueño —
  esas acciones administrativas más sensibles siguen siendo exclusivas de
  Administrador/Comité vía `/admin/residentes`. Dime si alguna de estas
  también la quieres delegar al dueño.

- **Notificaciones — push real necesita una "development build", no
  funciona en Expo Go**: desde el SDK 53 de Expo (la versión que usa este
  proyecto es la 57), el **push remoto ya no funciona dentro de Expo Go**
  — es una limitación de Expo mismo, no de este código. Para que el
  residente reciba de verdad el aviso en la pantalla de su celular (fuera
  de la app), hay que compilar una **development build**
  (`npx expo run:android` o un build con EAS) en vez de abrir la app con
  Expo Go. Mientras tanto, todo lo demás funciona igual: la notificación
  siempre queda guardada y visible en "Notificaciones" dentro de la app
  apenas el residente la abre — eso no depende de ningún build especial y
  se probó de punta a punta (ver más abajo). El registro del push token
  (`POST /auth/push-token`) y el envío real al servicio de Expo también
  están construidos y probados en el sentido de que nunca rompen nada si
  fallan (sin red, sin token, Expo Go sin soporte) — lo único que no se
  pudo verificar en este entorno es que un push real llegue a un teléfono
  físico, porque no hay uno conectado acá. Cuando pruebes desde tu
  celular con una development build, avísame si algo no llega y lo
  revisamos.
- **A quién le llega cada notificación de un depto**: se decidió avisarle
  a **todos** los residentes activos con acceso de la unidad (dueño viva o
  no ahí, arrendatario, pareja, roomies, etc.), no solo a la persona
  puntual a la que se dirigió el paquete o se dijo que visitaban — mismo
  criterio ya usado en "Administrar mi hogar" (ronda 15): cualquiera del
  hogar puede querer saberlo. Si prefieres que solo le llegue a quien
  coincidió por nombre, dime y lo acoto.
- **Por qué "Notificado" no dispara push aparte**: el paso manual
  "Notificado" que el guardia puede marcar (para el aviso informal por
  WhatsApp que sigue existiendo fuera del sistema) no genera una
  notificación push nueva, porque sería un segundo aviso casi idéntico al
  que ya se manda automáticamente al recepcionar el paquete. El push
  siguiente recién llega cuando se marca "En portería" (ya está listo
  para retirar). Si prefieres un push también en "Notificado", es un
  cambio chico.
- **Solo se guarda un push token por usuario**: si el residente entra
  desde dos teléfonos distintos, el que se guarda último "pisa" al
  anterior — el MVP no soporta varios dispositivos logeados a la vez con
  push en ambos. Avísame si esto es un problema real para algún caso de
  uso tuyo.
- **`tipo_notificacion` sin pantalla propia de catálogo**: a diferencia de
  otros catálogos de esta app (tipo de paquete, tipo de espacio común),
  los 5 tipos de notificación son fijos y no editables desde la app —
  como no se pidió que el condominio pueda inventar tipos nuevos, se dejó
  como una lista cerrada sembrada en el seed.

- **Sesión persistente — cuánto dura antes de pedir loguearse de nuevo**:
  se guarda con `expo-secure-store` (cifrado por el sistema operativo,
  Android/iOS). Para que la persistencia sirviera de algo, también
  extendí cuánto dura el token: Guardia se quedó igual (**12 horas**, "dura
  un turno" — suele ser un teléfono/tablet compartido del condominio, no
  conviene dejarlo logeado semanas), pero Residente y Administrador ahora
  duran **30 días** (antes también eran solo 12h, heredado de cuando nadie
  perseguía persistir la sesión). Si el token guardado ya venció, o el
  administrador te quita el acceso, la primera pantalla que pida datos al
  backend recibe un 401 y la app cierra sesión sola y te manda al login —
  no hace falta ningún paso especial para "limpiar" una sesión vencida.
  Avísame si 30 días te parece mucho o poco.
- **Storage S3-ready — cómo probarlo sin tener todavía un proveedor
  contratado**: como no hay credenciales de un S3 real disponibles acá,
  el driver "s3" se probó de punta a punta contra un servidor S3 falso
  (`s3rver`, corriendo localmente en este entorno) — se confirmó que sube
  el archivo, que el contenido que llega es idéntico byte a byte al
  original, que guarda el `ContentType` correcto, y que un error de
  configuración (falta `S3_BUCKET`) da un mensaje claro en vez de un error
  críptico del SDK. No se probó contra un proveedor real (AWS S3,
  Cloudflare R2, etc.) porque no hay uno contratado todavía — cuando
  tengas las credenciales, avísame y lo probamos contra el real antes de
  darlo por definitivo en producción.
- **Storage S3 — bucket público, sin URLs firmadas**: igual que hoy
  `/uploads` se sirve sin ningún control de acceso (cualquiera con el link
  puede ver una foto), el driver S3 asume que el bucket/CDN es público —
  no genera URLs firmadas (presigned) que expiren. Si más adelante quieres
  que las fotos/firmas/comprobantes sean privados, es un cambio acotado en
  `storage.ts`, pero no se hizo en esta ronda porque no fue parte del
  pedido.

- **Personal externo — login propio desde el día uno**: elegiste que cada
  trabajador tenga su propia cuenta (no solo una ficha sin acceso), así
  que se creó como un `tipo_usuario` más ('Personal'), con el mismo flujo
  de alta que un guardia: administrador/comité le asigna usuario y
  contraseña al crearlo. El token dura 30 días, igual que
  Residente/Administrador (es su propio celular, no un dispositivo
  compartido de portería como el del guardia).
- **Tarea = mensaje suelto, no checklist**: dijiste explícitamente que
  preferías que le llegara como notificación porque "ellos ya saben sus
  deberes" — así que no se construyó ninguna plantilla de tareas diarias
  por especialidad, solo un cajón de texto libre que administrador/comité
  le escriben a un trabajador puntual. Si más adelante quieres una
  plantilla recurrente (ej. "todos los días le llega automáticamente el
  checklist de jardinería"), es un módulo aparte que se puede agregar
  sobre esta misma base.
- **Especialidad (`tipo_personal`) es un catálogo cerrado, sin pantalla
  propia**: igual que `tipo_notificacion` (ronda 16), los 5 valores
  sembrados (Aseo, Jardinería, Mantención, Conserjería externa, Otro) no
  se pueden editar ni agregar desde la app hoy — se define directo en el
  seed. Si necesitas una especialidad distinta, dime y la agrego, o
  construimos la pantalla de catálogo si vas a necesitar cambiarlas
  seguido.
- **Personal externo no aparece hoy en ninguna pantalla de Residente**:
  el pedido fue sobre lo que ve administración/comité (asignar tareas,
  ver cumplimiento) y lo que ve el propio trabajador (turno, mis tareas)
  — un residente no tiene, por ahora, ninguna vista de "quién viene hoy a
  hacer aseo/jardinería". Se puede agregar más adelante si te sirve.
- **Sin control de acceso físico integrado con portería**: el turno lo
  marca el propio trabajador desde su celular (autoservicio, como
  pediste), no el guardia — no está enganchado al mismo flujo de
  entrada/salida de visitas. Si más adelante quieres que el guardia
  también pueda ver/marcar el turno de personal externo desde su propia
  pantalla (ej. alguien sin celular a mano), es un agregado acotado.

## Backend

Motor de base de datos: **MySQL/MariaDB real** (desde la ronda 13 — antes
se usaba `node:sqlite` embebido, solo porque el entorno donde se construyó
originalmente no tenía salida de red hacia los binarios que Prisma
necesita descargar). El cliente es [`mysql2`](https://www.npmjs.com/package/mysql2)
(no necesita compilar nada, se instala con un `npm install` normal), y el
schema completo — todo lo construido hasta hoy: estacionamientos,
paquetería, login de residentes, `flg_comite`, `flg_propietario`,
notificaciones — vive en un único archivo,
`docs/schema-mysql.sql`, que el propio backend aplica solo (`CREATE TABLE
IF NOT EXISTS...`) al arrancar.

Necesitas un servidor MySQL o MariaDB corriendo (local, Docker, o el que
uses para desarrollo) y una base de datos vacía creada de antemano:

```sql
CREATE DATABASE mi_condominio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Después, en `backend/.env`, apunta las variables `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, `DB_NAME` a esa base (el archivo ya trae los
valores de ejemplo que se usaron para probar esta ronda: usuario
`micondominio`, base `mi_condominio` — cámbialos por los tuyos).

```bash
cd backend
npm install
npm run seed   # aplica el schema (si falta) y siembra:
                # 6 torres, 112 deptos reales, residentes de prueba,
                # guardia1/guardia2/admin (pass "1234"),
                # 11 cupos de visita + 3 de discapacitados,
                # tipos de permiso (incluye Peatonal), 2 patentes de ejemplo,
                # 16 tipos de paquete (incluye "Bulto") + 7 estados,
                # 6 tipos de residente (Propietario/Arrendatario/Pareja del
                # propietario/Roomie/Familiar/Otro) — el depto 101 queda
                # con 4 residentes de ejemplo (propietario + pareja + 2
                # roomies) para probar el caso de varios tipos en un mismo
                # depto,
                # 11 tipos de espacio común + 8 estados de reserva (sin
                # espacios reales precargados — Varoli no tiene ninguno
                # hoy, el administrador los configura desde la app),
                # un dueño (`flg_propietario=1`) precargado por cada uno
                # de los 112 deptos, 6 tipos de notificación (paquete
                # recibido/en portería/alerta 7 días, visita registrada,
                # comunicado, tarea asignada) que se disparan solos — no
                # hay nada que sembrar aparte para probarlas, ver el
                # párrafo de pruebas más abajo,
                # 5 especialidades de personal externo (Aseo, Jardinería,
                # Mantención, Conserjería externa, Otro) con 3 cuentas de
                # prueba ya con login activado: aseo1/1234, jardinero1/1234,
                # mantencion1/1234
                #
                # El seed ya deja 3 cuentas activas y listas para probar
                # de inmediato (usuario/clave "1234"):
                #   residente101 → dueño y ocupante del depto 101 (caso normal)
                #   residente102 → arrendatario, vive en el depto 102 pero no es el dueño
                #   dueno102     → dueño del depto 102, NO vive ahí (caso "depto
                #                  arrendado" que describiste: administra a
                #                  residente102 a distancia desde "Administrar mi hogar")
                # El resto de los residentes de prueba siguen sin acceso a la
                # app (eso lo hace el administrador desde RESIDENTES →
                # "Activar acceso a la app"). Para probar rápido sin pasar
                # por la app: con el backend corriendo,
                #   curl -X POST http://localhost:3000/admin/residentes/4/acceso \
                #     -H "Authorization: Bearer <token admin>" -H "Content-Type: application/json" \
                #     -d '{"usuariocol":"residente101","password":"1234"}'
                # activa al residente de prueba del depto 101 (id_usuario=4).
npm run dev    # levanta la API en http://localhost:3000 (aplica el schema
                # al arrancar, aunque no hayas corrido el seed)
```

Si `DB_HOST`/credenciales están mal, o el servidor MySQL no está
disponible, el backend lo dice de inmediato en la consola y no levanta
(falla rápido en vez de arrancar y recién fallar en la primera consulta).

Las fotos/firmas de paquetería y los comprobantes de Reservas se guardan
por defecto en `backend/uploads/` (se crea sola) y se sirven en
`/uploads/...`; si quieres cambiar la carpeta, define la variable de
entorno `UPLOADS_DIR`. Desde la ronda 17 esto es **S3-ready**: agregando
`STORAGE_DRIVER=s3` y las variables `S3_BUCKET`/`S3_REGION`/`S3_ENDPOINT`/
`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` (más `S3_FORCE_PATH_STYLE` y
`S3_PUBLIC_BASE_URL` si tu proveedor los necesita) en `backend/.env` —
comentadas de ejemplo ahí mismo — las fotos/firmas/comprobantes se suben a
cualquier storage compatible con la API de S3 (AWS S3, Cloudflare R2,
Backblaze B2, DigitalOcean Spaces, MinIO) en vez de disco local, sin tocar
código. Detalle completo de las variables y del porqué en
`backend/src/utils/storage.ts`.

Endpoints principales:

| Método | Ruta | Auth | Qué hace |
|--------|------|------|----------|
| POST   | `/auth/login` | — | Login (`usuariocol`, `password`) → token + rol (Guardia/Administrador/Residente/Personal) |
| POST   | `/auth/cambiar-password` | ✓ | El propio usuario cambia su contraseña (pide la actual) |
| GET    | `/torres`, `/torres/:id/unidades`, `/unidades/:id/residentes` | ✓ | Catálogos precargados |
| GET    | `/tipos-permiso` | ✓ | Normal/12h/24h/FDS largo/Discapacitado con sus reglas |
| GET    | `/tipos-paquete` | ✓ | Catálogo de tipos de paquete (incluye "Bulto") |
| GET    | `/residentes-discapacitados` | ✓ | Residentes habilitados para cupos de discapacitados |
| GET    | `/estacionamientos/disponibilidad?condominio_id=1` | — | Cupos de visita **y** discapacitados con su estado |
| POST   | `/visitas` | ✓ Guardia/Admin | Registra entrada (vehicular, peatonal, o residente discapacitado), asigna cupo si corresponde, cobra permisos especiales |
| PATCH  | `/visitas/:id/salida` | ✓ Guardia/Admin | Registra salida, libera cupo, calcula exceso de tiempo si aplica |
| GET    | `/patentes/:patente` | ✓ Guardia/Admin | Consulta propietario/arrendatario, torre y depto |
| POST   | `/paquetes` | ✓ Guardia/Admin | Registra la llegada de un paquete (foto obligatoria) |
| GET    | `/paquetes/pendientes?condominio_id=1` | ✓ Guardia/Admin | Paquetes sin retirar, con `diasPendiente` y `alerta7dias` |
| GET    | `/paquetes?fecha_inicio=&fecha_termino=&q=&estado=&condominio_id=` | ✓ | Búsqueda/auditoría (incluye entregados). Para Guardia/Admin es de todo el condominio; para Residente queda acotada a su propio depto sin importar qué filtros mande |
| GET    | `/paquetes/:id` | ✓ | Detalle de un paquete (403 si un Residente pide uno de otro depto) |
| PATCH  | `/paquetes/:id/estado` | ✓ Guardia/Admin | Notificado / En portería / Rechazado / Devuelto / Perdido |
| PATCH  | `/paquetes/:id/entrega` | ✓ Guardia/Admin | Registra la entrega (firma siempre, foto si retira otra persona) |
| GET/POST/PATCH | `/admin/guardias` | ✓ Administrador | CRUD de guardias |
| GET/POST/PATCH | `/admin/residentes` | ✓ Administrador (`flg_comite` solo el Administrador real) | CRUD de residentes por depto (el PATCH también permite restablecer su contraseña de acceso; el campo `flg_comite` está bloqueado para un comité, incluso teniendo el resto de los permisos de administrador; el campo `flg_propietario` sí lo puede asignar tanto Administrador como Comité — marca/transfiere quién es el dueño registrado del depto) |
| GET/POST/PATCH | `/mi-depto/residentes` | ✓ Residente con `flg_propietario=1` | Autoservicio del dueño de un depto: lista, agrega, edita el tipo de residente, y da de baja a los residentes de **su propia unidad** (nunca de otra — el backend siempre revalida la unidad del token); no puede tocar `flg_comite`/`flg_propietario` de nadie, ni darse de baja a sí mismo |
| POST/DELETE | `/admin/residentes/:id/discapacidad` | ✓ Administrador | Registrar/quitar carnet de discapacidad |
| POST/DELETE | `/admin/residentes/:id/acceso` | ✓ Administrador | Activar/quitar el acceso a la app de un residente (usuario + contraseña) |
| GET/POST/PATCH | `/admin/patentes` | ✓ Administrador | CRUD de patentes de residentes |
| GET    | `/admin/auditoria/patente/:patente` | ✓ Administrador | Historial completo de una patente y qué guardia registró cada visita |
| GET    | `/admin/reportes/gasto-comun?fecha_inicio=&fecha_termino=` | ✓ Administrador | Cobros por exceso de tiempo/permiso especial **y** por exceso de horario en reservas de espacios comunes en el rango, agrupados por depto (para el gasto común) |
| GET    | `/tipos-residente` | ✓ | Catálogo: Propietario/Arrendatario/Pareja del propietario/Roomie/Familiar/Otro |
| GET    | `/reservas/espacios/tipos`, `/reservas/espacios`, `/reservas/espacios/:id`, `/reservas/espacios/:id/disponibilidad?fecha=` | ✓ | Catálogo de espacios comunes y sus horarios ya ocupados en una fecha |
| POST   | `/reservas` | ✓ Residente/Admin | Crea una reserva (Residente: para su propio depto; Admin/Comité: a nombre de un residente indicando `unidad_id_unidad`/`solicitante_usuario_id`) — valida horario, traslape, gasto común al día y anticipación máxima |
| GET    | `/reservas/mias?condominio_id=` | ✓ Residente | Las reservas del propio depto |
| GET    | `/reservas/:id` | ✓ | Detalle de una reserva (403 si un Residente pide una de otro depto) |
| PATCH  | `/reservas/:id/cancelar` | ✓ Residente/Admin | Cancela (respeta días mínimos de cancelación para un Residente; sin restricción para Admin/Comité) |
| POST   | `/reservas/:id/comprobante` | ✓ Residente/Admin | Sube el comprobante de transferencia (foto) de una reserva Aprobada |
| GET    | `/reservas/dia?condominio_id=&fecha=` | ✓ Guardia/Admin | Reservas confirmadas del día (Reservado/En uso/Finalizado) — módulo "Reserva área común" |
| PATCH  | `/reservas/:id/llegada`, `/reservas/:id/salida` | ✓ Guardia/Admin | Marca llegada (→ En uso) y salida (→ Finalizado, calcula exceso de horario si aplica) |
| GET/POST/PATCH | `/admin/espacios` | ✓ Administrador | CRUD de espacios comunes (configuración completa: tarifa, garantía, horario, temporada, etc.) |
| GET    | `/admin/reservas?condominio_id=&estado=&espacio_id=&fecha_inicio=&fecha_termino=` | ✓ Administrador | Todas las reservas del condominio, con filtros |
| PATCH  | `/admin/reservas/:id/aprobar`, `/admin/reservas/:id/rechazar` | ✓ Administrador | Aprueba (→ Reservado si gratis, → Aprobado si pagado) o rechaza (motivo obligatorio) una reserva Pendiente |
| PATCH  | `/admin/reservas/:id/validar-pago` | ✓ Administrador | Valida el comprobante subido (Aprobado → Reservado) |
| PATCH  | `/admin/reservas/:id/garantia` | ✓ Administrador | Resuelve la garantía de una reserva Finalizada (`Devuelta` o `Retenida` con monto/motivo) |
| POST   | `/auth/push-token` | ✓ | Registra el push token de Expo del teléfono del usuario logeado (lo llama la app sola tras el login) |
| GET    | `/notificaciones` | ✓ | Bandeja propia (paquetes/visitas/comunicados que le llegaron a este usuario), más recientes primero |
| PATCH  | `/notificaciones/:id/leido` | ✓ | Marca UNA notificación propia como leída (403 si intenta marcar la de otro usuario) |
| POST   | `/admin/comunicados` | ✓ Administrador | Redacta un comunicado (`titulo`, `cuerpo`) que le llega como notificación a TODOS los residentes activos con acceso del condominio |
| GET    | `/admin/unidades/gasto-comun?condominio_id=1` | ✓ Administrador | Lista todos los deptos vigentes con su estado de gasto común (`flg_gastocomun`) |
| PATCH  | `/admin/unidades/:id/gasto-comun` | ✓ Administrador | Marca un depto al día (`1`) o con deuda (`0`) — bloquea/permite reservar espacios comunes reservables |
| GET    | `/admin/personal/tipos?condominio_id=1` | ✓ Administrador | Catálogo de especialidades (Aseo, Jardinería, Mantención, Conserjería externa, Otro) |
| GET/POST/PATCH | `/admin/personal` | ✓ Administrador | CRUD de personal externo (login propio: usuario/contraseña se asignan al crearlo, igual que un guardia) |
| POST   | `/admin/personal/:id/tarea` | ✓ Administrador | Le escribe una tarea de texto libre a un trabajador puntual — le llega como notificación (bandeja + push best-effort) |
| GET    | `/admin/personal/tareas?condominio_id=1&usuario_id=` | ✓ Administrador | Historial de tareas asignadas (de todo el personal, o de uno solo con `usuario_id`) — historial de cumplimiento |
| GET    | `/admin/personal/:id/turnos` | ✓ Administrador | Historial de turnos (entrada/salida) de un trabajador puntual |
| POST   | `/personal/turno/iniciar`, `/personal/turno/finalizar` | ✓ Personal | El propio trabajador marca "Empezar turno"/"Marcar salida" — no puede tener dos turnos abiertos a la vez |
| GET    | `/personal/turno/actual` | ✓ Personal | El turno abierto del trabajador logeado, si tiene uno (para que la app sepa qué botón mostrar) |
| GET    | `/personal/tareas` | ✓ Personal | Bandeja propia de tareas asignadas |
| PATCH  | `/personal/tareas/:id/completar` | ✓ Personal | Marca UNA tarea propia como completada (403/400 si intenta marcar la de otro) |

Probado end-to-end en este entorno, incluyendo: bloqueo de `/admin` para
guardias (403), entrada a cupo de discapacitados sin confirmar carnet
(rechazada), con carnet confirmado (cupo D-xx asignado), como residente no
registrado (rechazada) y como residente registrado (cupo asignado), salida
tras 30 horas simuladas en un cupo de discapacitados sin generar ningún
cobro, auditoría por patente, creación de residentes/patentes desde el
panel de administrador, el reporte de gasto común (2 visitas con exceso
de tiempo en el mismo depto agrupadas con su subtotal correcto, bloqueo
403 para guardias, rango de fechas sin resultados, y validación de fechas
inválidas o invertidas), las visitas peatonales (rechazo si falta
nombre/RUT/depto/a quién visita, registro con nombre que no coincide con
ningún residente —queda igual registrada, marcada para revisión—, registro
con nombre que sí coincide, salida opcional sin cobro y sin tocar ningún
cupo, y que las entradas/salidas vehiculares siguen funcionando
exactamente igual que antes), y la paquetería (rechazo si falta la foto de
recepción, registro con tipo sin elegir → queda "Bulto", marcar
Notificado/En portería, entrega de la misma persona solo con firma,
entrega de otra persona sin foto rechazada y con foto aceptada, un paquete
ya entregado no admite más cambios de estado, marcar Perdido con
observación, la alerta de 7 días sin retirar aparece en `pendientes`
—simulada retrasando `fecha_recepcion`—, la foto guardada se sirve
correctamente por `/uploads/...`, y la búsqueda por rango de fechas,
nombre, RUT y estado).

También se probó end-to-end el login de residentes: activar acceso desde
`/admin/residentes/:id/acceso`, login del residente devolviendo su torre/
depto, un residente viendo `/paquetes` sin filtro y viendo solo el suyo
aunque fuerce `unidad_id` de otro depto en la query, `GET /paquetes/:id`
de otro depto devolviendo 403, un residente bloqueado con 403 al intentar
`POST /paquetes`, `POST /visitas` y `GET /patentes/:patente`, cambio de
contraseña propio (login con la vieja falla después, con la nueva
funciona), el administrador restableciendo la contraseña de un residente,
y revocar el acceso (el login deja de funcionar de inmediato).

También se probó end-to-end el rol de Comité: activar `flg_comite=1` en un
residente vía `PATCH /admin/residentes/:id`, su token de login trae
`esComite: true` junto con `rol: "Residente"`, puede llamar
`GET /admin/guardias` (200, antes reservado a Administrador), su
`GET /paquetes` devuelve paquetes de todos los deptos (no solo el propio),
y puede `POST /visitas`; en paralelo, un residente sin `flg_comite` sigue
acotado a su propio depto y sigue recibiendo 403 en `/admin/guardias`. Y
específicamente que **solo el Administrador puede nombrar comité**: un
comité que intenta `PATCH /admin/residentes/:id` con `flg_comite` (a otro
residente o a sí mismo, para quitárselo) recibe 403, mientras que sigue
pudiendo editar otros campos del mismo residente (por ejemplo el nombre)
sin problema; el Administrador real sí puede activar y quitar el flag
normalmente.

También se volvió a probar **todo lo anterior de punta a punta contra
MySQL/MariaDB real** (ronda 13), no contra la base embebida que se usaba
antes: `docs/schema-mysql.sql` se aplicó limpio sobre una base
`mi_condominio` recién creada (18 tablas), el seed corrió completo contra
esa base, y se repitió el mismo recorrido de pruebas — login de los 3
roles, entrada/salida de visita con cobro por exceso de tiempo, entrada/
salida de discapacitados, registro/entrega de paquetes, reporte de gasto
común, activar/revocar acceso de residente, y el bloqueo de `flg_comite`
solo para el Administrador real — confirmando que las transacciones siguen
siendo atómicas (por ejemplo, si falla cualquier paso al registrar una
entrada o una entrega, no queda nada a medio guardar), que los mensajes de
"ese dato ya existe" siguen funcionando igual de claros con el formato de
error propio de MySQL, y que `tsc --noEmit` (backend y app) y
`npx expo export` siguen compilando sin errores con todo el código
convertido a `async`/`await`.

También se probó end-to-end (ronda 14) el módulo de **Reservas de Espacios
Comunes** y el **tipo de residente**: guardia bloqueado con 403 al intentar
reservar; reserva pagada con cálculo correcto de tarifa (bloques ×
precio); rechazo por traslape de horario y por caer fuera del horario
configurado del espacio; rechazo por superar los días máximos de
anticipación (solo para residente, no para admin); ciclo completo de pago
Pendiente → Aprobado → sube comprobante → Reservado → llegada → En uso →
salida → Finalizado; cálculo de exceso de horario tanto en un espacio
gratuito (sin cobro) como en uno pagado (cobro correcto); rechazo exige
motivo; el residente cancela su propia reserva Pendiente; `flg_gastocomun`
bloqueando a un residente pero no a admin/comité; 403 al cancelar/ver una
reserva de otro depto; la vista del guardia y "mis reservas" del residente
devuelven lo esperado; el exceso de horario aparece correctamente sumado
en el mismo reporte de gasto común que estacionamientos, con su propio
detalle (`detalleReservas`) y el resumen por depto combinado; y que la
equivalencia comité = Administrador funciona sin código nuevo en las
rutas `/admin/espacios` y `/admin/reservas`. Se agregaron y probaron
también los endpoints de configuración (`POST`/`PATCH /admin/espacios`) y
el listado admin de reservas con filtros. Para el tipo de residente: el
depto 101 quedó con 4 residentes (Propietario, Pareja del propietario, 2
Roomies) — confirmado que `GET /admin/residentes` los devuelve a los
cuatro con su `gls_tiporesidente` correcto, que el administrador puede
asignar/cambiar/quitar (`null`) el tipo de cualquier residente vía
`PATCH /admin/residentes/:id`, y que `GET /tipos-residente` devuelve el
catálogo completo. Durante estas pruebas se detectó y corrigió que los
listados de reservas usados por la app del residente
(`GET /reservas/mias`) y por el panel admin (`GET /admin/reservas`) no
traían `flg_gratuito`/`gls_tipoespaciocomun`/`nombre_creador` como sí lo
hace el detalle de una reserva — se alinearon las tres consultas para que
tengan la misma forma. `tsc --noEmit` (backend y app) y
`npx expo export --platform android` compilan sin errores con las
pantallas nuevas.

También se probó end-to-end (ronda 15) el módulo de **dueños de depto**:
login de `dueno102` trae `esPropietario: true` en el token junto con la
unidad del depto 102 (aunque quien vive ahí sea `residente102`);
`GET /mi-depto/residentes` del dueño devuelve solo a los residentes de su
propia unidad; `POST /mi-depto/residentes` crea un residente nuevo en su
depto aunque se le inyecte `unidad_id_unidad` de otro depto en el body —
el backend ignora ese valor y usa siempre la unidad del token (probado
enviando `unidad_id_unidad: 99`, el residente quedó igual en la unidad
real del dueño); `PATCH /mi-depto/residentes/:id` sobre un residente de
**otro** depto devuelve 403; un residente sin `flg_propietario` recibe
403 en las tres rutas de `/mi-depto`; el dueño puede cambiar el tipo de
residente y dar de baja/reactivar a otros, pero recibe 400 si intenta
darse de baja a sí mismo; al marcar a un nuevo dueño para un depto que ya
tenía uno, el dueño anterior pierde `flg_propietario` automáticamente
(probado transfiriendo la propiedad del depto 101 y confirmando que
`residente101` quedó sin el flag, luego revertido para dejar los datos de
prueba como estaban); y que tanto Administrador como Comité pueden marcar
`flg_propietario` vía `PATCH /admin/residentes/:id` sin restricción de
rol (a diferencia de `flg_comite`, que sigue devolviendo 403 si lo
intenta un comité). `tsc --noEmit` (backend y app) y
`npx expo export --platform android` compilan sin errores con la pantalla
nueva `MiHogarScreen` y el botón "ADMINISTRAR MI HOGAR".

También se probó end-to-end (ronda 16) el módulo de **notificaciones**:
registrar un paquete para el depto 101 deja una notificación "Nuevo
paquete" en la bandeja de `residente101`; marcarlo "En portería" agrega
una segunda notificación "Paquete en portería" (dos en total, sin
duplicar la primera); una visita vehicular y una peatonal registradas
para el depto 102 le llegan como "Visita registrada" **tanto** a
`residente102` (que vive ahí) **como** a `dueno102` (que no vive ahí) —
confirmando el caso "depto arrendado" que describiste; un comunicado
creado por el Administrador (`POST /admin/comunicados`) le llegó a los 3
residentes activos con acceso del condominio (`destinatarios: 3`),
incluidos los de deptos distintos al que lo redactó; `guardia1` intentando
`POST /admin/comunicados` recibe 403 (no es Administrador ni Comité);
`residente102` intentando marcar como leída una notificación que le
pertenece a `residente101` recibe 400 (nunca puede tocar la de otro);
simulando un paquete con `fecha_recepcion` de 8 días atrás directo en la
base, la primera consulta a `GET /paquetes/pendientes` disparó la alerta
de 7 días una sola vez (`alerta7dias_notificada` pasó de `0` a `1`), y una
segunda consulta inmediatamente después **no** la volvió a disparar
(mismo patrón perezoso que la expiración de reservas); se registró un
push token con formato válido de Expo pero inventado
(`POST /auth/push-token`, 200 ok) y se confirmó que un nuevo paquete
igual se registra sin error (201) aunque el intento de push real hacia
ese token falle silenciosamente (`flg_push_enviado` queda en `0`, la
notificación queda igual en la bandeja); y que `guardia1` no tiene
ninguna notificación propia (`GET /notificaciones` devuelve `[]`), porque
hoy nada le notifica nada a un guardia. `tsc --noEmit` (backend y app) y
`npx expo export --platform android` compilan sin errores (1038 módulos)
con las pantallas nuevas `NotificacionesScreen` y
`AdminComunicadosScreen`. No se pudo probar en este entorno que el push
real llegue a un teléfono físico (ver "Supuestos": Expo Go no soporta
push remoto desde el SDK 53, hace falta una development build).

También se probó end-to-end (ronda 17) **gasto común por depto**,
**duración del token por rol** y el **storage S3-ready**: `GET
/admin/unidades/gasto-comun` devuelve los 112 deptos con su estado;
`guardia1` recibe 403; se creó un espacio común reservable de prueba,
se marcó el depto 101 "con deuda" (`PATCH
/admin/unidades/1/gasto-comun`), se confirmó que `residente101` recibe
el mismo mensaje de bloqueo que ya existía desde la ronda 14 ("gasto
común pendiente") al intentar reservarlo, se volvió a marcar "al día" y
la misma reserva se creó sin problema; `flg_gastocomun` con un valor
inválido (`2`) devuelve 400, y una unidad inexistente devuelve un error
claro (se revirtieron los datos de prueba —reserva cancelada, espacio
desactivado— al terminar). Se decodificaron los JWT de `admin`,
`residente101` y `guardia1`: **720 horas (30 días)** para los dos
primeros, **12 horas** para el guardia, confirmando la duración
diferenciada por rol. El registro y entrega de un paquete (dos fotos +
firma) se volvió a probar completo con el nuevo storage async —sin
ningún cambio de comportamiento con el driver local, que sigue siendo el
default— confirmando que no hay regresión por el refactor. El driver
"s3" se probó aparte, de punta a punta, contra un servidor S3 falso
(`s3rver`) corriendo localmente en este entorno (no hay credenciales de
un proveedor real disponibles acá): subida de una imagen de prueba,
descarga posterior desde el bucket confirmando que el contenido es
idéntico byte a byte al original y que el `ContentType` quedó correcto,
la variante con `S3_PUBLIC_BASE_URL` configurado arma la URL con esa
base en vez de la URL virtual-hosted por defecto, y la falta de
`S3_BUCKET` con `STORAGE_DRIVER=s3` da un error claro en vez de uno
críptico del SDK — ver el detalle completo en "Supuestos" arriba.
`tsc --noEmit` (backend y app) y `npx expo export --platform android`
compilan/bundlean sin errores (1041 módulos) con la pantalla nueva
`AdminGastoComunScreen` y la sesión persistida.

También se probó end-to-end (ronda 18) el módulo de **personal externo**
contra una base MySQL/MariaDB recién creada (schema + seed limpios, sin
errores): login de `jardinero1` devuelve `rol: "Personal"` y un JWT de
**720 horas (30 días)** (mismo criterio que Residente/Administrador,
confirmado decodificando el token); `GET /admin/personal` y `GET
/admin/personal/tipos` devuelven las 3 cuentas de prueba con su
especialidad; el administrador le asignó la tarea "Cortar árboles costado
sur" a `jardinero1` (`POST /admin/personal/121/tarea`) y esta apareció de
inmediato en su bandeja de notificaciones (`GET /notificaciones`, tipo
"Tarea asignada") y en `GET /personal/tareas`; `jardinero1` la marcó
completada (`PATCH /personal/tareas/:id/completar`), intentar completarla
de nuevo devuelve 400 ("ya estaba completada"), e intentar completar un id
inexistente/ajeno también devuelve 400 sin filtrar información de otro
usuario; el historial admin (`GET /admin/personal/tareas`, con y sin
filtro `usuario_id`) muestra la tarea completada con el nombre del
trabajador y de quién la creó. Turno: `GET /personal/turno/actual`
devuelve `null` sin turno abierto; `POST /personal/turno/finalizar` sin
turno abierto devuelve 400; `POST /personal/turno/iniciar` crea el turno y
un segundo intento antes de marcar salida devuelve 400 ("ya tienes un
turno abierto"); `POST /personal/turno/finalizar` lo cierra, y `GET
/admin/personal/:id/turnos` muestra la fila con `fecha_inicio` y
`fecha_termino` correctos tanto abierta como cerrada. Permisos: `guardia1`
y `residente101` reciben 403 en cualquier ruta `/personal/*` (`Esta acción
requiere uno de estos perfiles: Personal`), y `jardinero1` recibe 403 en
`/admin/personal` (no es Administrador ni Comité) — confirmando que
`requireRol("Personal")` y `requireAdmin` no se pisan entre sí. Además:
crear personal con un `usuariocol` repetido devuelve el mismo mensaje
amigable que ya existía para guardias/residentes; desactivar una cuenta
(`flg_vigencia=0`) le bloquea el login (`401` con el mensaje genérico de
"usuario o contraseña incorrectos", igual que cualquier otro rol
desactivado) y bloquea asignarle una tarea nueva ("no es personal externo
activo"); intentar asignarle una tarea a un `id_usuario` que es Residente
(no Personal) también se rechaza con el mismo mensaje, así que no hay
forma de mandarle una "tarea de personal" a alguien que no lo es. `tsc
--noEmit` (backend y app) sin errores; `npx expo export --platform
android` bundlea sin errores (1045 módulos) con las pantallas nuevas
(`AdminPersonalScreen`, `AdminAsignarTareaScreen`,
`AdminPersonalDetalleScreen`, `PersonalTareasScreen`) y el Home con su
rama nueva para el rol Personal.

## App (React Native / Expo)

```bash
cd app
npm install
npx expo start
```

Login → Home con menú distinto según el rol:
- **Guardia**: ENTRADA / SALIDA / CONSULTA PATENTE / **PAQUETES** (más un
  enlace a disponibilidad). La pantalla de Entrada primero pregunta si es
  visita **vehicular** o **peatonal**; si es vehicular, permite elegir
  entre cupo de visita normal o cupo de discapacitados (y, dentro de este
  último, si lo usa una visita —con el switch de confirmación de carnet—
  o un residente ya registrado); si es peatonal, pide nombre y apellidos,
  RUT, torre/depto y a quién visita —igual de obligatorio que en la
  vehicular— (sin cupo ni patente). PAQUETES abre la lista de paquetes en
  portería (con badge de días pendientes y alerta a los 7 días), desde
  donde se registra uno nuevo (con foto de cámara obligatoria), se marca
  Notificado/En portería, se registra la entrega (firma siempre —
  dibujada con el dedo—, foto si retira alguien distinto al receptor), o
  se marca Rechazado/Devuelto/Perdido con observación; y desde ahí también
  se llega a la búsqueda/historial por fecha, nombre o RUT. Se agregó
  además **RESERVA ÁREA COMÚN**: las reservas confirmadas del día
  (espacio, depto, horario) con botones para marcar llegada y salida —
  al marcar la salida avisa si hubo exceso de horario y el cargo generado.
- **Administrador** (y **Comité**, que ve exactamente este mismo menú):
  GUARDIAS / RESIDENTES / PATENTES / AUDITORÍA / REPORTE
  GASTO COMÚN / **PAQUETES** / **RESERVAS ESPACIOS COMUNES** /
  **CONFIGURAR ESPACIOS COMUNES**. Los primeros cuatro tienen su lista,
  formulario de alta y activar/desactivar; en RESIDENTES cada ficha ahora
  también muestra si tiene acceso a la app activado y permite activarlo
  (usuario + contraseña), restablecer la contraseña, o quitarle el
  acceso, además de mostrar si es miembro del comité y permitir
  agregarlo/quitarlo, y muestra/permite asignar el **tipo de residente**
  (Propietario/Arrendatario/Pareja del propietario/Roomie/Familiar/Otro),
  tanto al crear un residente nuevo como para uno ya existente; también
  muestra si es el **dueño del depto** (badge "🏠 Dueño de Torre X 101") y
  permite marcarlo/quitarlo como tal ("Marcar como dueño del depto" /
  "Quitar como dueño del depto" — disponible para Administrador y
  Comité); el reporte
  de gasto común tiene fecha inicio, fecha término y botón buscar, y
  muestra el listado agrupado por depto con el subtotal de cada uno y el
  total general del período (incluye los cobros por exceso de horario de
  reservas junto a los de estacionamientos); PAQUETES abre la misma
  búsqueda/historial del guardia, pero para todos los deptos del
  condominio. **CONFIGURAR ESPACIOS COMUNES** es el CRUD completo de
  espacios (nombre, tipo, capacidad, reservable/no reservable,
  gratuito/pagado, precio y bloque de horas, garantía, tarifa de atraso,
  horario, días disponibles, minutos de separación, anticipación máxima,
  cancelación mínima, temporada). **RESERVAS ESPACIOS COMUNES** es la
  bandeja de gestión: filtrar por estado, aprobar/rechazar (con motivo),
  validar el pago una vez subido el comprobante, y resolver la garantía
  (devolver o retener con motivo) al finalizar el uso — además de un
  acceso directo para reservar "a nombre de un residente". Se agregó
  además **ENVIAR COMUNICADO**: un formulario simple (título + mensaje)
  que, tras confirmar, le llega como notificación a todos los residentes
  activos con acceso del condominio — el resultado avisa a cuántos les
  llegó. Se agregó también **GASTO COMÚN POR DEPTO**: la lista de los 112
  deptos con su estado (Al día / Con deuda) y un botón para alternarlo,
  con buscador por torre/depto y un resumen de cuántos deptos tienen
  deuda. Se agregó también **PERSONAL EXTERNO**: la ficha de cada
  trabajador (aseo, jardinería, mantención, etc.) con su especialidad y
  si tiene un turno abierto ahora mismo, formulario de alta con
  usuario/contraseña (login propio, como un guardia), activar/desactivar,
  y por cada persona un botón **"Asignar tarea"** (texto libre, le llega
  como notificación) y **"Ver historial"** (tareas completadas/pendientes
  y turnos de entrada/salida — este historial es exclusivo de
  Administrador/Comité). Un residente que es comité ve además su saludo
  con "· Comité" en el Home, para distinguir que está en el menú de
  administrador.
- **Residente**: **MIS PAQUETES** — sus propios paquetes, separados en
  "esperando retiro" e "historial" (nada de otros deptos, ni jugando con
  la URL/parámetros: el backend lo acota igual). Se agregó
  **RESERVAR ESPACIO COMÚN** (catálogo de espacios reservables, con fecha/
  hora y los horarios ya ocupados ese día antes de reservar) y
  **Ver mis reservas** (estado de cada una, subir el comprobante de pago
  cuando corresponde, y cancelar mientras esté permitido). Sigue siendo el
  único perfil sin acceso a estacionamientos/patentes/paquetería de
  portería, que siguen siendo terreno de Guardia/Administrador. Si además
  es el **dueño registrado de su depto**, ve un botón extra
  **"ADMINISTRAR MI HOGAR"** que abre un CRUD acotado a su propia
  unidad: agregar personas, cambiar su tipo de residente, o darlas de
  baja — pensado para el caso de un depto arrendado, donde el dueño no
  vive ahí pero igual administra a quienes sí viven desde su propia
  cuenta. No puede darse de baja a sí mismo desde esta pantalla.
- **Personal externo** (ronda 18: aseo, jardinería, mantención, etc.): un
  botón grande que alterna entre **EMPEZAR TURNO** y **MARCAR SALIDA**
  (con confirmación antes de marcar la salida) según si ya tiene un turno
  abierto, y **MIS TAREAS** — la bandeja de tareas que le escribió
  administrador/comité (texto libre, ej. "cortar árboles costado sur"),
  con un botón para marcarlas como completadas. También tiene acceso a
  **Notificaciones** (mismo sistema que paquetes/visitas/comunicados) y a
  cambiar su propia contraseña. No ve estacionamientos, paquetería,
  reservas ni ningún dato de otros residentes/personal — es el rol más
  acotado de los cuatro.

Residente/Comité, Administrador y (desde la ronda 18) Personal tienen un
enlace **"Notificaciones"** en el Home (con el número de no leídas entre
paréntesis cuando hay alguna) que abre la bandeja completa: paquetes,
visitas, comunicados y tareas asignadas, ordenados del más nuevo al más
viejo, con las no leídas destacadas — tocar una la marca como leída. Al
loguearse, la app pide permiso de notificaciones y registra el push token
del teléfono automáticamente y en silencio (si el usuario lo rechaza, o si
el permiso falla por cualquier motivo, la app sigue funcionando igual —
solo que sin push real, ver "Supuestos" sobre Expo Go).

Los cuatro perfiles tienen un enlace **"Cambiar contraseña"** en el Home
(pide la contraseña actual). Al guardar, cierra la sesión para que se
vuelva a entrar con la nueva.

**Sesión persistente (ronda 17)**: cerrar la app (o que el sistema
operativo la mate en segundo plano) ya no obliga a loguearse de nuevo —
la sesión se guarda cifrada en el teléfono con `expo-secure-store` y se
restaura sola al volver a abrir la app (con un loading breve mientras
tanto). Si el token guardado ya no sirve (venció, o el administrador
quitó el acceso), la app lo detecta sola en la primera pantalla que pida
datos y vuelve al login — no queda nunca "pegada" mostrando errores.

Branding: ícono, splash y pantalla de login con el logo de Valles de Varoli.

Dependencias nuevas para paquetería: `expo-image-picker` (foto con
cámara), `react-native-svg` + `react-native-view-shot` (firma dibujada a
mano, capturada como imagen). En iOS, la primera vez que se use la cámara
el sistema pedirá el permiso correspondiente (ya configurado en
`app.json`).

Dependencia nueva para notificaciones: `expo-notifications` (más
`expo-constants`, que ya venía con Expo). Se agregó el plugin
`expo-notifications` a `app.json`. **Importante**: el push real (aviso en
la pantalla de notificaciones del sistema operativo) necesita una
development build — no funciona abriendo la app con Expo Go desde el SDK
53 de Expo (ver "Supuestos" en la sección de arriba). La bandeja dentro de
la app ("Notificaciones" en el Home) funciona igual en Expo Go, sin
ninguna limitación.

Dependencia nueva para la sesión persistente: `expo-secure-store` — no
necesita ningún plugin ni configuración adicional en `app.json`.

Se probó que el bundle compila sin errores (`npx expo export`); correrla
en un emulador o teléfono real hay que hacerlo desde tu máquina. Antes de
probar en un dispositivo físico, ajusta `app/src/config/api.ts` con la URL
donde esté corriendo el backend (tu IP local o la URL desplegada —
`localhost` no es alcanzable desde el teléfono).

## Pendiente / próximos pasos

1. Confirmar los supuestos marcados arriba.
2. Reemplazar los residentes de prueba restantes por datos reales (o
   pedirme un script de carga masiva).
3. ~~Persistir la sesión en la app.~~ **Hecho (ronda 17)** — se guarda con
   `expo-secure-store` y se restaura sola al abrir la app; el token de
   Residente/Administrador ahora dura 30 días (antes 12h) para que la
   persistencia sirva de algo (Guardia se mantuvo en 12h).
4. Exportar/integrar el reporte de gasto común (hoy solo se consulta desde
   la app) con el sistema real de gasto común a fin de mes — por ejemplo
   como archivo descargable o integración directa.
5. ~~Migrar el backend de SQLite a MySQL.~~ **Hecho (ronda 13)** — el
   backend corre sobre MySQL/MariaDB real vía `mysql2`, probado de punta
   a punta (ver el párrafo de pruebas más arriba). Queda pendiente elegir
   y contratar el hosting donde correrá esa base en producción — ver la
   sección "Hosting" más abajo.
6. ~~Módulo de notificaciones push.~~ **Hecho (ronda 16)** — paquetes
   (recibido y en portería), visitas (le llega al depto completo, dueño
   viva ahí o no) y comunicados de administrador/comité a todos los
   residentes, con bandeja dentro de la app siempre garantizada y push
   real al teléfono cuando hay development build (no funciona en Expo Go
   desde el SDK 53 — ver "Supuestos"). La alerta de 7 días ahora además
   de badge visual manda una notificación (una sola vez por paquete).
7. ~~Migrar las fotos/firmas/comprobantes de disco local a un storage tipo
   S3.~~ **Hecho, S3-ready (ronda 17)** — el código ya soporta subir a
   cualquier storage compatible con S3 (AWS S3, R2, Spaces, B2, MinIO) con
   solo configurar variables de entorno, probado de punta a punta contra
   un servidor S3 falso (no hay credenciales de un proveedor real
   disponibles en este entorno — ver "Supuestos"). Por defecto sigue
   guardando en disco local hasta que actives `STORAGE_DRIVER=s3`.
8. ~~Reservas de Espacios Comunes.~~ **Hecho (ronda 14)** — configuración
   de áreas comunes por condominio, flujo de solicitud → aprobación →
   pago con comprobante → reserva confirmada, garantía, y el módulo
   "Reserva Área Común" para que el guardia marque llegada/salida, con
   pantallas propias para Residente/Comité-Administrador/Guardia.
9. **Tipo de residente** (ronda 14) — hecho para el caso de un solo
   depto con varios residentes de distinto tipo (probado con el depto
   101: propietario + pareja + 2 roomies); queda pendiente reemplazar los
   residentes de prueba restantes por los datos reales de cada depto y su
   tipo correcto (ver punto 2).
10. **Reservas — mejoras posibles a futuro, no bloqueantes**: hoy la
    expiración automática (regla 21) se recalcula al listar reservas, no
    con un cron real (ver "Supuestos" arriba) — si se necesita que el
    estado quede al día sin que nadie abra la app, hay que agregar un job
    programado. `flg_gastocomun` tampoco tiene todavía una integración
    real que lo actualice automáticamente desde el sistema de gasto común
    — hoy queda en `1` (al día) por defecto para todos los residentes de
    prueba.
11. **Dueños de depto** (ronda 15) — hecho: se guarda el dueño registrado
    de los 112 deptos separado de quién vive ahí (`flg_propietario`), cada
    dueño tiene su propia cuenta y puede autoadministrar (CRUD) a los
    residentes de su unidad desde "Administrar mi hogar" aunque no viva
    ahí, con transferencia automática de dueño y bloqueo de
    autodesactivación. Queda pendiente, si lo necesitas más adelante: un
    registro con datos adicionales del dueño (RUT, teléfono de contacto),
    una regla que obligue a que todo depto tenga siempre un dueño
    asignado, y decidir si se le delega también activar acceso a la app
    de sus propios residentes (hoy sigue siendo solo de
    Administrador/Comité — ver "Supuestos" arriba).
12. **Notificaciones** (ronda 16) — hecho: paquetes, visitas y comunicados
    le llegan al residente, con bandeja dentro de la app siempre
    garantizada y push real cuando hay development build. Queda pendiente,
    si lo necesitas más adelante: compilar una development build para
    poder probar el push real en un teléfono (ver "Supuestos"), soportar
    más de un dispositivo logeado a la vez con push en ambos, y decidir si
    "Notificado" también debería mandar push aparte del que ya se manda al
    recepcionar el paquete.
13. **Gasto común por depto** (ronda 17) — hecho: administrador/comité
    marcan desde "GASTO COMÚN POR DEPTO" qué deptos están al día, lo que
    ya bloqueaba (desde la ronda 14) reservar espacios comunes
    reservables. Sigue sin existir integración automática con el sistema
    real de gasto común (nada lo pone en deuda solo) — tal como
    confirmaste, por ahora es solo para identificar y bloquear/permitir
    reservas; si más adelante quieres esa integración real, es un módulo
    aparte a definir.
14. **Personal externo** (ronda 18) — hecho: aseo, jardinería, mantención,
    etc. con login propio (usuario/contraseña desde que se crean, como un
    guardia), turno que ellos mismos marcan al entrar/salir del
    condominio, y tareas puntuales de texto libre que administrador/comité
    les escriben y les llegan como notificación (bandeja + push
    best-effort) — sin plantilla de checklist, a propósito, porque
    confirmaste que ellos ya saben sus deberes diarios. El historial de
    cumplimiento (tareas completadas y turnos) es exclusivo de
    Administrador/Comité. Queda pendiente, si lo necesitas más adelante:
    una pantalla de catálogo para agregar especialidades nuevas (hoy son 5
    fijas del seed), una vista para que un residente vea "quién viene hoy"
    a hacer aseo/jardinería, y que el guardia pueda ver/marcar el turno de
    alguien de personal externo que no tenga celular a mano.

## Hosting: qué características buscar para las pruebas

Con el backend ya corriendo sobre MySQL/MariaDB real, esto es lo que
conviene mirar al elegir dónde contratar el hosting de pruebas:

- **MySQL/MariaDB administrado**: que el proveedor ofrezca la base como
  servicio (no que haya que instalarla y mantenerla a mano). Confirmé que
  **Railway** lo ofrece como plantilla de un clic (no solo Postgres, que es
  lo que suelen destacar primero).
- **Runtime de Node.js**: que soporte desplegar el backend Express tal
  cual está (Node 18+), con variables de entorno para `DB_HOST`,
  `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — el backend ya está
  preparado para leerlas del entorno, así que no hace falta tocar código
  para apuntar a la base del hosting.
- **Nivel de precio acorde a "pruebas"**: no hace falta el plan más caro
  todavía. Con Railway, por ejemplo (precios verificados en su
  documentación oficial):
  - **Free**: $0, pero muy limitado (1 réplica, 0.5 GB RAM, 1 vCPU) — sirve
    para probar que el despliegue funciona, no para uso real con
    guardias/residentes.
  - **Hobby**: US$5/mes + US$5 de crédito de uso incluido (6 réplicas,
    hasta 48 GB RAM/48 vCPU, 100 GB de disco efímero, 5 GB de volumen
    persistente) — este es el punto de partida razonable para las pruebas
    con el condominio real: alcanza para el backend + la base MySQL
    corriendo juntos con margen.
  - **Pro**: US$20/mes + US$20 de crédito — recién tendría sentido si ya
    hay varios condominios usando el sistema en paralelo, no para esta
    etapa.
  - Cobro por excedente si te pasas del crédito incluido: ~US$10/GB RAM,
    ~US$20/vCPU, US$0.05/GB de tráfico de salida, US$0.15/GB/mes de
    almacenamiento en volumen — conviene tenerlo presente pero no debería
    ser un problema en la etapa de pruebas.
- **Almacenamiento persistente para las fotos/firmas**: hoy `backend/
  uploads/` guarda los archivos en el disco del propio backend (ver el
  punto 7 de pendientes). Un volumen persistente (Railway lo incluye)
  alcanza para probar con una sola instancia del backend, pero si más
  adelante se necesita correr más de una instancia (por ejemplo para no
  tener downtime al actualizar), ahí sí conviene migrar esas fotos/firmas
  a un storage tipo S3 — no es bloqueante para empezar a probar.
- **Backups automáticos** de la base de datos, aunque sea el plan básico
  del proveedor — para no perder datos de prueba reales de residentes si
  algo falla.
- **Multi-tenant listo**: el schema ya indexa todo por
  `condominio_id_condominio` (ver `docs/schema-mysql.sql`), así que
  cualquier hosting que cumpla lo anterior sirve igual para probar con un
  condominio o, más adelante, con varios en la misma base.

En resumen: para esta etapa (probar con el condominio real antes de
vender el sistema a otros condominios), un plan tipo **Railway Hobby
(US$5/mes)** cumple con todo lo anterior sin sobre-invertir; cuando el
sistema tenga más de un condominio activo o necesite alta disponibilidad,
ahí conviene revisar planes superiores o alternativas administradas
específicas de MySQL.
