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
