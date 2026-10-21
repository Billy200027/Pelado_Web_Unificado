# Pelado Web Unificado

Aplicación web HTML/CSS/JavaScript: control diario local, períodos 21–20, horas, pagos reales y análisis de Excel con PDF real. Diseño burdeos del control original.

## Abrir

Abre `index.html` o la web publicada con GitHub Pages. Todos los recursos están en la raíz para permitir publicación sin compilación. No requiere instalación ni cuentas de trabajadores.

Tarifas predeterminadas: Grande $0,11/lb, Mediano $0,14/lb, Pequeño $0,22/lb. Las personalizaciones existentes se conservan. Grande: 15/16/21/26; Mediano: 31/36/41; Pequeño: 51.

El calendario, jornadas, bandejas, libras, horas, perfil y ajustes se guardan exclusivamente en el dispositivo. Haz respaldos JSON desde Ajustes. Borrar datos del navegador puede borrar tus registros.

## Código completo, pruebas y documentación

`Pelado_Codigo_Fuente.zip` contiene el proyecto con carpetas, README completo, pruebas automatizadas y comparación de 500 cálculos con el original, muestras sintéticas e integración opcional de Supabase. Las dependencias y licencias están incluidas.

Los archivos de la raíz son una copia funcional del mismo código, con rutas ajustadas para esta publicación. No hay pasos de compilación.

## Supabase

El envío mensual está desactivado hasta crear y configurar un proyecto independiente. No se ha conectado a Cuadros_app. Supabase se reservará exclusivamente para el Excel mensual original y metadatos técnicos necesarios; no guardará el control diario ni tarifas personales.

## Proyecto anterior

Mi_Pelado se conserva sin cambios. Este repositorio permite probar la nueva versión de forma independiente.

## Recuadro de envío compacto

En la publicación, `excel.js` líneas 4–7 define `EXCEL_SHARING_DEFAULTS`: `includeOriginal: true` selecciona la casilla al abrir y `expanded: false` deja el recuadro plegado. El HTML del recuadro se genera en `excel.js`, líneas 115–136; la casilla está en la línea 124. No está escrito directamente en index.html.

El usuario puede desmarcar Incluir el Excel original. La selección no envía datos ni representa una autorización automática: para enviar es necesario pulsar Autorizar y enviar Excel, con información visible sobre el administrador y los datos personales. El envío permanece desactivado hasta configurar Supabase. El CSS del recuadro está al final de style.css.

## Corrección de compatibilidad del reporte mensual

El lector admite fechas AAAA/MM/DD además de AAAA-MM-DD, conserva conceptos sin libras o sin fecha (LIBRES, HORAS, AVANCE), separa TOTAL de los movimientos, interpreta tallas expresadas como rangos y usa la categoría declarada cuando no hay una correspondencia conocida. Los intervalos de tiempo se unen por empleado, incluyendo segundos, sin duplicar solapamientos. La comparación con el lector anterior se comprobó con un archivo privado del usuario; ese documento y su contenido no se publican en el repositorio.

El selector permite consultar conceptos sin fecha; al filtrar un período se excluyen porque no puede asignárseles uno por suposición. Se muestran la suma de movimientos y el total declarado por separado cuando son comparables, sin reinterpretar los conceptos como descuentos. Los registros del control diario no cambian. Los nombres largos de archivos y las notas se ajustan al ancho móvil.

## Informe mensual completo

La vista Excel conserva el resumen y añade evolución diaria de libras o pagos, gráficos de barras/anillo/pastel/tarjetas, distribución de pagos por concepto, productos, indicadores de productividad y tarjetas o tabla de jornadas. Cada jornada permite abrir todos sus movimientos, con tarifa, rendimiento mensual, entrada y salida originales, categoría y fila/hoja de origen. Los movimientos también pueden verse en tarjetas o tabla. Hay filtros por empleado, período 21–20, intervalo de fechas y búsqueda; todos afectan a los mismos datos y al PDF. Los conceptos sin fecha solo se incluyen sin filtro temporal. Posibles duplicados se advierten y conservan, sin eliminarlos por suposición.

El PDF incorpora todos los movimientos seleccionados, evolución diaria, tabla de jornadas, productos/conceptos y datos originales complementarios. La productividad es libras ÷ horas registradas, uniendo intervalos superpuestos por empleado; no se aplica al cálculo del control diario.

## Recepciones de Excel en Supabase

Estado: pendiente de crear el proyecto Pelado y desplegar el endpoint. El conector permite listar proyectos, pero la consulta de coste/creación devuelve UNAVAILABLE. No hay envíos reales activos.

Cuando esté desplegado, cada envío autorizado quedará en `public.pelado_uploads` con identificador, fecha de recepción y ruta del archivo privado. El administrador podrá consultar esa tabla desde el panel de Supabase y descargar el documento desde Storage → pelado-private. Esto proporciona registro de recepción, no notificación por correo o WhatsApp. Los registros del control diario no se envían. El botón Compartir solicita autorización expresa; seleccionar un archivo para analizarlo continúa siendo una operación local.

## Pago por día libre y adelantos

Por corrección expresa de Billy, el importe fijo de quincena deja de sumarse a la proyección. Ajustes → Libres y bono ofrece `freeDayRate`, con referencia provisional y editable de **16,07 USD por día libre**. Se multiplica por los días marcados Libre del período 21–20, incluidos los que el usuario haya programado: 5 × 16,07 = 80,35 USD. No se presuponen libres adicionales entre los días sin registro. Los libres no entran en el promedio de producción, no causan descuentos y no anulan el bono de asistencia.

La proyección suma producción acumulada después de faltas, producción futura estimada, pago por libres y bono de asistencia según la regla existente. Los adelantos recibidos se conservan como pagos reales (`fortnight`, clave histórica compatible), se comparan con la proyección y se restan al mostrar el saldo estimado por cobrar. No se presume un depósito de 241 USD. Las jornadas, ajustes de tarifas y pagos existentes permanecen intactos; `fortnightDeposit` antiguo se conserva si ya estaba guardado, pero no participa en las estimaciones. Cambiar la tarifa de libre recalcula los períodos estimados anteriores, igual que las demás tarifas locales; no modifica pagos reales.

Archivos del cambio: `js/variables.js` (valor inicial), `js/core.js` (`freeDayPay`), `js/app.js` (ajustes, proyección, modal e historial). En la publicación esos archivos están en la raíz. Prueba específica: `tests/free-days.test.cjs`, además de la suite de regresión completa.

Supabase continúa pendiente: el acceso web elegido con ChatGPT redirigió a Google y la revisión automática bloqueó ese cambio de proveedor. No se completó el acceso ni se envió ningún Excel. Se requiere autorización explícita para continuar ese inicio de sesión.

## Total acumulado y avances provisionales

El panel superior conserva la proyección con producción futura. El recuadro inferior «Total acumulado del período» suma solo producción acumulada después de faltas, libres registrados y bono según la regla existente; la producción futura sigue visible pero no se suma en ese recuadro. Los libres programados y el bono conservan su comportamiento previo: este total no representa un depósito confirmado.

El aviso independiente de avances 25 y 50 muestra una estimación conjunta de las libras registradas del período × (40 / 2.000) USD, redondeada a centavos. No estima cada avance por separado, no proyecta libras futuras y no afecta producción, totales, saldos ni pagos reales. La referencia queda pendiente de verificar con el pago de fin de mes. No cambia el almacenamiento ni las tarifas de producción.

## Pantalla completa y Android

El botón ⛶ junto al perfil activa/desactiva la API de pantalla completa del navegador con un toque. La página usa altura dinámica `100dvh`, fondo continuo y posición inferior que respeta el área de gestos. Chrome puede rechazar u ocultar sus controles según la versión y el dispositivo; se muestra un aviso si no permite la petición. No se fuerza el modo al abrir la web.

`android/` contiene el contenedor nativo de los mismos recursos web, con importación de archivos y exportación PDF/JSON mediante los selectores de Android. La APK abre sin conexión, conserva sus propios datos locales y oculta la navegación inferior del sistema (recuperable con un gesto). Para pasar datos de Chrome a la APK, exporta e importa un respaldo JSON desde Ajustes. No hay sincronización automática entre ambas opciones. No se ha activado Supabase.

Verificación: ocho escenarios de acumulado/proyección, pruebas de pantalla completa y errores, exportación nativa simulada de JSON y un PDF real generado con jsPDF. APK compilada para Android 6+ y firma verificada; queda pendiente la comprobación visual y de selectores en un teléfono real.

## Importar producción al registro diario

En el apartado Excel, el panel «Pasar producción al registro diario» permite elegir un empleado y un período 21–20 del archivo completo, independientemente de los filtros del informe. Suma todos los cortes por fecha y categoría y convierte las libras de cada categoría a bandejas enteras mediante `floor(libras / 5)`. Conserva las libras totales y usa el cálculo y las tarifas personales del registro diario. Los días importados son editables desde el calendario.

Solo importa producción: no asigna libres, faltas, horas, avances ni pagos recibidos. Los días nuevos quedan en turno mañana y sin feriado; el usuario debe revisar esos campos. Una categoría con menos de 5 lb o no reconocida deja ese día pendiente de ingreso manual, con aviso. Los movimientos repetidos se conservan y se suman. El cálculo de comparación incluye exclusivamente el pelado en las fechas de la vista, excluyendo los demás conceptos; no pretende validar el pago neto del período. Las tarifas del Excel sirven únicamente como referencia de pago, nunca para calcular la estimación.

Las fechas existentes se conservan por defecto. Reemplazarlas requiere marcar la opción y confirmar; se descarga antes un respaldo. «Borrar registros de este período» elimina solo las jornadas del período seleccionado, incluidas las ingresadas manualmente; conserva otros períodos, ajustes, pagos recibidos y análisis Excel. Solicita confirmación y descarga previamente un respaldo JSON. El respaldo puede restaurarse desde Ajustes y reemplaza los datos del dispositivo según el flujo existente.

La APK actual usa recursos internos: actualizar GitHub Pages no actualiza esa APK. La web y el acceso directo del navegador sí usan la versión publicada; los datos locales de la APK y del navegador son independientes. El ZIP histórico de código fuente no incluye necesariamente los cambios posteriores de la raíz: para esta versión usa «Code → Download ZIP» en GitHub.

Validación de esta ampliación: pruebas de agrupación por empleado y período, redondeo, edición mediante el formulario real, conflictos, reimportación sin duplicar, rechazo atómico de lotes inválidos y borrado aislado por período. Las pruebas de interfaz usan `jsdom` (`NODE_PATH` debe incluir esa dependencia). Con el archivo privado de referencia se verificaron 17 días de producción y 2.123,28 lb sin publicar el archivo ni datos personales en el repositorio.

## Avances incluidos en el dashboard (21 de octubre de 2026)

Por indicación de Billy, la estimación conjunta de avance 25 y avance 50 se incorpora ahora tanto a la proyección superior como al total acumulado, una vez en cada total. Se conserva la referencia provisional de libras registradas × 0,02 USD, redondeada a centavos. No se estiman avances sobre producción futura ni se asignan importes individuales. El desglose superior y el acumulado muestran el concepto. El saldo por cobrar y la diferencia con pagos recibidos utilizan la proyección actualizada; no se modifica ningún pago real, registro diario ni comparación de producción del Excel. Esta regla sustituye el comportamiento anterior descrito en «Total acumulado y avances provisionales».

## PCC / tijera en la importación (APK 1.1.1)

El importador asigna a la categoría interna `adicional` todas las filas de producción con tarifa numérica mayor que cero y menor a 0,11 USD/lb, antes de clasificar por talla. La tarifa original solo identifica la categoría: el importe usa el precio local configurado para PCC, cuyo valor predeterminado sigue siendo 0,08 USD/lb. Las cuatro categorías se agrupan por fecha y sus bandejas se redondean hacia abajo después de sumar sus cortes. La vista previa muestra también PCC / tijera. Se conserva cualquier nombre personalizado de la categoría; solo se renombra el marcador anterior «Adicional (provisional)».

Los registros existentes no se reclasifican sin el Excel. Para corregir un período previo debe volver a importarse con la opción de reemplazar, revisando después los turnos, feriados y horas porque ese flujo sustituye las jornadas coincidentes. Se descarga respaldo antes de reemplazar. La APK 1.1.1 usa el mismo certificado y conserva el paquete de las anteriores; se verificó firma, recursos y las pruebas de mezcla PCC/normal, umbral 0,11, tarifa personal y guardado en calendario. Pendiente de instalación en teléfono físico.

## Reparar días PCC guardados (APK 1.1.2)

El informe reconoce ahora PCC por tarifa en la lectura del Excel y al restaurar un análisis guardado. El panel ofrece «Corregir PCC en días guardados»: solo actualiza las cuatro cantidades de bandejas en jornadas trabajadas que coinciden en fecha y libras con el empleado/período seleccionado. Conserva las libras, horas, turno, feriado y demás campos. Omite días con libras distintas o estados Libre/Falta, y los informa para revisión manual. Requiere confirmación y descarga un respaldo antes de guardar; repetir la reparación no duplica bandejas. No cambia días sin PCC. Los registros antiguos no se modifican automáticamente al instalar la APK.

Se reprodujo mediante prueba integrada un caso de 148,08 lb con 60 lb a 0,08 USD/lb: la distribución anterior 20 grandes, 9 medianas y 0 adicionales se corrige a 8 grandes, 9 medianas y 12 adicionales, conservando horas y turno. Ajustes muestra la versión 1.1.2. Firma APK y recursos verificados; pendiente de prueba en un teléfono físico.
