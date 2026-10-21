# Pelado para Android

Contenedor Java/WebView de la misma aplicación HTML/CSS/JavaScript publicada en la raíz. Android 6.0 o posterior, sin anuncios ni cuentas adicionales. Recursos incluidos para abrir sin conexión. El control diario usa el almacenamiento privado del WebView; no comparte automáticamente los datos con Chrome. Para pasar los registros, exporta el respaldo JSON en la web e impórtalo desde Ajustes de la APK.

Importación mediante el selector de documentos de Android; exportación PDF/JSON mediante «Guardar como». El límite de exportación de esta versión es 32 MB. No requiere permiso de acceso general al almacenamiento. El puente nativo solo recibe contenido de los recursos empaquetados: no se cargan páginas externas dentro del WebView. Los enlaces externos seleccionados por el usuario se abren en el navegador. Los envíos a Supabase permanecen pendientes, igual que en la web actual.

La barra inferior de Android se oculta y se puede recuperar deslizando desde el borde. La barra de estado superior permanece visible. Los datos se conservan al cerrar o actualizar con la misma firma; desinstalar o borrar datos elimina el almacenamiento local, por lo que conviene exportar respaldos.

## Compilar

Instala Android SDK Build Tools 35.0.0, Android platform 35 y JDK 17. Ejecuta `bash android/build.sh` con `PELADO_BUILD_TOOLS` y `PELADO_ANDROID_JAR` apuntando a sus rutas. El resultado está alineado y sin firmar. Firma con `apksigner` y una clave privada conservada fuera del repositorio. Nunca publiques el almacén de claves ni su contraseña. El mismo certificado debe usarse en futuras versiones para actualizar sin desinstalar.

## Versión 1.1.0

Versión de Android 2 (versionName 1.1.0), con importación de producción Excel al calendario, borrado por período y estimación conjunta de avances incluida en el dashboard. `daily-import.js` forma parte de los recursos obligatorios de compilación. Incluye un aviso de estimación orientativa sin margen de error máximo garantizado. Una cifra fija de 5 % no se presenta como garantía de precisión.

La APK 1.1.0 se verificó con apksigner y con el mismo certificado de la APK 1.0.0. Se comprobaron los archivos internos frente al código web, las referencias de recursos y las pruebas automatizadas de cálculo e importación. Queda pendiente la instalación y comprobación en un teléfono físico. La actualización requiere instalar esta nueva APK; GitHub Pages no actualiza los recursos internos de la APK instalada.
