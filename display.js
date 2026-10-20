/* Vista adaptable y exportación nativa. No altera cálculos ni almacenamiento. */
(() => {
  'use strict';
  const native = window.PeladoAndroid;
  const notify = message => {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4500);
  };
  window.peladoNativeResult = notify;
  const update = () => {
    const button = document.getElementById('fullscreenBtn');
    if (!button) return;
    const active = !!document.fullscreenElement;
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Activar pantalla completa');
    button.title = active ? 'Salir de pantalla completa' : 'Pantalla completa';
  };
  document.addEventListener('fullscreenchange', update);
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('fullscreenBtn');
    if (native) {
      button.hidden = true; // Android ocupa el área disponible desde el inicio.
      return;
    }
    button.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        } else notify('Este navegador no ofrece pantalla completa. Puedes comparar con la APK.');
      } catch {
        notify('Chrome no permitió la pantalla completa. Vuelve a tocar el botón o utiliza la APK.');
      }
      update();
    });
  });
  if (!native) return;
  // Captura también los clics sintéticos de jsPDF en enlaces no insertados en el DOM.
  let exporting = false;
  function exportAnchor(anchor) {
    if (!anchor.download || !/^(blob:|data:)/.test(anchor.href)) return false;
    if (exporting) { notify('Termina de guardar el archivo anterior.'); return true; }
    exporting = true;
    (async () => {
      try {
        const blob = await (await fetch(anchor.href)).blob();
        if (blob.size > 32 * 1024 * 1024) throw new Error('El archivo supera el límite de 32 MB de esta APK.');
        const reader = new FileReader();
        reader.onload = () => {
          native.saveFile(String(reader.result).split(',')[1], anchor.download, blob.type || 'application/octet-stream');
          exporting = false;
        };
        reader.onerror = () => { exporting = false; notify('No se pudo preparar el archivo.'); };
        reader.readAsDataURL(blob);
      } catch (error) { exporting = false; notify(error.message || 'No se pudo exportar.'); }
    })();
    return true;
  }
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!exportAnchor(this)) return click.call(this);
  };
  const dispatch = HTMLAnchorElement.prototype.dispatchEvent;
  HTMLAnchorElement.prototype.dispatchEvent = function (event) {
    if (event.type === 'click' && exportAnchor(this)) return true;
    return dispatch.call(this, event);
  };
})();
