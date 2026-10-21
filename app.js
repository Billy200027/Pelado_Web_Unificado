(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const initialPeriod = PeladoCore.periodOf(new Date()).split("-").map(Number);
  const state = {
    view: "dashboard",
    currentMonth: initialPeriod[1] - 1,
    currentYear: initialPeriod[0],
    profile: load(STORAGE_KEYS.profile, null),
    config: load(STORAGE_KEYS.config, null) || structuredClone(APP_CONFIG),
    months: load(STORAGE_KEYS.months, {}),
    realPayments: load(STORAGE_KEYS.realPayments, {}),
    editingDate: null
  };

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const weekdayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    try { migrateStorage(); } catch { alert("No se pudo migrar o guardar en este navegador. Los datos antiguos se conservan. Habilita almacenamiento y recarga antes de registrar jornadas."); }
    applySavedConfig();
    bindNavigation();
    bindGlobalEvents();
    updateHeader();
    renderAll();

    setTimeout(() => {
      $("#splash")?.classList.add("hide");
      $("#app")?.classList.remove("hidden");
    }, state.config.splashDurationMs || 3000);

    if (!state.profile) {
      setTimeout(() => openProfileModal(true), 350);
    }
  }

  function bindNavigation() {
    $$('[data-module]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.module==='excel'?'excel':'dashboard')));
    $$(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    $$(".drawer-links button").forEach(btn => {
      btn.addEventListener("click", () => {
        switchView(btn.dataset.view);
        closeDrawer();
      });
    });

    $("#mobileMenuBtn")?.addEventListener("click", openDrawer);
    $("#closeDrawer")?.addEventListener("click", closeDrawer);
    $("#drawerBackdrop")?.addEventListener("click", closeDrawer);
    $("#profileBtn")?.addEventListener("click", () => openProfileModal(false));
  }

  function bindGlobalEvents() {
    document.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;

      if (action === "show-calendar") switchView("calendar");
      if (action === "prev-month") changeMonth(-1);
      if (action === "next-month") changeMonth(1);
      if (action === "today-month") {
        const now = new Date();
        const period = PeladoCore.periodOf(now).split("-").map(Number);
        state.currentMonth = period[1]-1;
        state.currentYear = period[0];
        renderAll();
      }
      if (action === "open-day") openDayModal(event.target.closest("[data-date]")?.dataset.date);
      if (action === "edit-day") openDayModal(event.target.closest("[data-date]")?.dataset.date);
      if (action === "delete-day") deleteDay(event.target.closest("[data-date]")?.dataset.date);
      if (action === "backup") exportBackup();
      if (action === "import-backup") $("#backupFile").click();
      if (action === "assign-payment") assignLegacyPayment(event.target.closest("[data-legacy]").dataset.legacy);
      if (action === "default-rates") restoreDefaultRates();
      if (action === "profile") openProfileModal(false);
      if (action === "save-profile") saveProfile();
      if (action === "save-settings") saveSettings();
      if (action === "real-payment") openRealPaymentModal();
      if (action === "save-real-payment") saveRealPayment();
      if (action === "reset-data") resetAllData();
      if (action === "close-modal") closeModal();
    });

    document.addEventListener("click", (event) => {
      const counterBtn = event.target.closest("[data-counter]");
      if (!counterBtn) return;
      const key = counterBtn.dataset.counter;
      const delta = Number(counterBtn.dataset.delta || 0);
      const input = document.querySelector(`#counter-${key}`);
      if (!input) return;
      input.value = Math.max(0, Number(input.value || 0) + delta);
      updateDayCalculation();
    });

    document.addEventListener("input", (event) => {
      if (event.target.matches(".day-input, .counter-value")) updateDayCalculation();
    });

    document.addEventListener("change", (event) => {
      if (["dayType","dayShift","dayHoliday","hoursEnabled","nextDay"].includes(event.target.id)) {
        updateDayCalculation();
      }
    });
  }

  function switchView(view) {
    state.view = view;
    $('#periodControls').hidden=view==='excel';
    $$('[data-module]').forEach(btn=>{const active=(view==='excel')===(btn.dataset.module==='excel');btn.classList.toggle('btn-primary',active);btn.classList.toggle('btn-secondary',!active);});
    updateHeader();

    $$(".view").forEach(section => section.classList.remove("active-view"));
    $(`#view-${view}`)?.classList.add("active-view");

    $$(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateHeader() {
    const titles = {
      dashboard: "Resumen",
      calendar: "Calendario",
      history: "Historial",
      settings: "Ajustes", excel: "Analizar Excel / PDF"
    };
    $("#pageTitle").textContent = titles[state.view] || "Pelado";

    const name = state.profile?.name || "P";
    $("#profileBtn").textContent = initials(name);
    $("#drawerProfile").innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <div class="tiny">${state.profile?.age ? `${escapeHtml(String(state.profile.age))} años` : "Perfil sin edad"}</div>
    `;
  }

  function renderAll() {
    renderDashboard();
    renderCalendar();
    renderHistory();
    renderSettings();
    updateHeader();
    $("#periodControls").innerHTML = periodToolbar();
    document.dispatchEvent(new Event("pelado-daily-changed"));
  }

  function renderDashboard() {
    const month = getMonthData();
    const entries = getMonthEntries(month);
    const stats = calculateMonthStats(entries);

    const real = getRealPaymentData();
    const projectedFutureProduction = stats.workedDays > 0
      ? truncateCents(stats.average * stats.remainingWorkableDays)
      : 0;
    // Referencia conjunta provisional: $40 por 2.000 lb registradas.
    const estimatedExtraAdvances = Math.round(stats.totalLb * (40 / 2000) * 100) / 100;
    const projectedProductionClose = truncateCents(stats.productionAdjusted + projectedFutureProduction);
    const projectedMonthEnd = truncateCents(
      projectedProductionClose + stats.freeMoney + (stats.absences === 0 ? state.config.attendanceBonus : 0) + estimatedExtraAdvances
    );
    const projectedTotalMonth = projectedMonthEnd;
    // Este recuadro excluye la producción futura; la proyección superior se conserva.
    const accumulatedTotal = truncateCents(
      stats.productionAdjusted + stats.freeMoney + (stats.absences === 0 ? state.config.attendanceBonus : 0) + estimatedExtraAdvances
    );
    const realTotal = Number(real.fortnight || 0) + Number(real.monthEnd || 0);

    $("#view-dashboard").innerHTML = `
      <div class="section-head">
        <div>
          <div class="eyebrow">${periodLabel()}</div>
          <h2>Tu panorama del período</h2>
          <p class="muted">Estimación basada en lo que ya registraste.</p>
        </div>
        <button class="btn btn-soft" data-action="real-payment">Registrar pago real</button>
      </div>

      <div class="card hero-card">
        <div class="hero-content">
          <div class="hero-kicker">Proyección total del período</div>
          <div class="hero-amount">${money(projectedTotalMonth)}</div>
          <p class="hero-note">
            Libres: ${stats.freeDays} × $${formatMoney(state.config.freeDayRate)} = $${formatMoney(stats.freeMoney)}
            + producción acumulada $${formatMoney(stats.productionAdjusted)}
            + producción futura estimada $${formatMoney(projectedFutureProduction)}
            ${stats.absences === 0 ? `+ $${formatMoney(state.config.attendanceBonus)} de asistencia` : " · sin bono de asistencia por faltas"}
            + avance 25 y avance 50 estimados $${formatMoney(estimatedExtraAdvances)}.
          </p>
        </div>
      </div>

      <p class="notice">Estimación orientativa, sin margen de error máximo garantizado. El rol de pago puede incluir descuentos y ajustes adicionales. Revisa horas, turnos y días libres para comparar importes equivalentes.</p>

      <div class="stats-grid">
        ${statCard("Producción", money(stats.productionAdjusted), "Después de descuentos por faltas")}
        ${statCard("Promedio diario", money(stats.average), `${stats.workedDays} días trabajados`)}
        ${statCard("Mínimo", money(stats.min), "Por día trabajado")}
        ${statCard("Máximo", money(stats.max), "Por día trabajado")}
      </div>

      <div class="dashboard-grid">
        <div class="card card-pad">
          <div class="section-head">
            <div>
              <div class="section-title">Producción acumulada</div>
              <div class="tiny">Distribución estimada por categoría</div>
            </div>
            <span class="tiny">${stats.totalTrays} bandejas</span>
          </div>
          <div class="breakdown">
            ${breakdownRow("Grande", stats.categoryMoney.grande, stats.categoryLb.grande, stats.productionBeforeAbsence)}
            ${breakdownRow("Mediano", stats.categoryMoney.mediano, stats.categoryLb.mediano, stats.productionBeforeAbsence)}
            ${breakdownRow("Pequeño", stats.categoryMoney.pequeno, stats.categoryLb.pequeno, stats.productionBeforeAbsence)}
            ${breakdownRow(escapeHtml(state.config.additionalName), stats.categoryMoney.adicional, stats.categoryLb.adicional, stats.productionBeforeAbsence)}
            ${projectionLine("Trabajo por horas", money(stats.hoursMoney))}
          </div>
        </div>

        <div class="card card-pad">
          <div class="section-head">
            <div>
              <div class="section-title">Total acumulado del período</div>
              <div class="tiny">Sin sumar la producción futura estimada</div>
            </div>
          </div>
          <div class="projection-box">
            <div class="projection-main">
              <div class="tiny">Total · producción + libres + bono + avances</div>
              <div class="projection-value">${money(accumulatedTotal)}</div>
            </div>
            ${projectionLine("Producción acumulada", money(stats.productionAdjusted))}
            ${projectionLine("Producción futura estimada (no incluida)", money(projectedFutureProduction))}
            ${projectionLine("Días trabajados", stats.workedDays)}
            ${projectionLine("Días libres", stats.freeDays)}
            ${projectionLine("Pago por libres", `${stats.freeDays} × ${money(state.config.freeDayRate)} = ${money(stats.freeMoney)}`)}
            ${projectionLine("Faltas", stats.absences)}
            ${projectionLine("Días trabajables restantes", stats.remainingWorkableDays)}
            ${projectionLine("Bono asistencia", stats.absences === 0 ? money(state.config.attendanceBonus) : "$0,00")}
            ${projectionLine("Avance 25 y avance 50 (estimación conjunta)", money(estimatedExtraAdvances))}
          </div>
        </div>
      </div>

      <div class="card card-pad" style="margin-top:14px">
        <div class="section-head">
          <div>
            <div class="section-title">Aviso · avances 25 y 50</div>
            <div class="tiny">Estimación conjunta incluida en los totales</div>
          </div>
        </div>
        <div class="projection-box">
          ${projectionLine("Libras registradas", `${formatNumber(stats.totalLb)} lb`)}
          ${projectionLine("Extra conjunto estimado", money(estimatedExtraAdvances))}
          <p class="notice">La estimación conjunta de avance 25 y avance 50 se suma una sola vez al total acumulado y una sola vez a la proyección superior. Referencia provisional: 2.000 lb ≈ $40,00 (1.000 lb ≈ $20,00), calculada solo con las libras registradas del período. No se proyectan avances sobre libras futuras. El importe individual de cada avance queda pendiente de verificar; esta estimación no registra dinero recibido.</p>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card card-pad">
          <div class="section-head">
            <div>
              <div class="section-title">Estado real de pagos</div>
              <div class="tiny">Lo depositado, no lo que el algoritmo imagina</div>
            </div>
          </div>
          <div class="projection-box">
            ${projectionLine("Adelanto recibido", money(real.fortnight))}
            ${projectionLine("Cierre recibido", money(real.monthEnd))}
            ${projectionLine("Diferencia real − proyección", money((Math.round(realTotal * 100) - Math.round(projectedTotalMonth * 100)) / 100))}
            ${projectionLine("Saldo estimado por cobrar", money((Math.round(projectedTotalMonth * 100) - Math.round(realTotal * 100)) / 100))}
            <div class="calc-total"><span>Total real</span><span>${money(realTotal)}</span></div>
          </div>
        </div>

        <div class="card card-pad">
          <div class="section-head">
            <div>
              <div class="section-title">Calendario laboral</div>
              <div class="tiny">Configuración del período</div>
            </div>
            <button class="btn btn-secondary" data-action="today-month">Período actual</button>
          </div>
          <div class="projection-box">
            ${projectionLine("Feriados trabajados", stats.holidays)}
            ${projectionLine("Turnos nocturnos", stats.nights)}
            ${projectionLine("Descuento por faltas", money(stats.absenceDeduction))}
            ${projectionLine("Libras registradas", `${formatNumber(stats.totalLb)} lb`)}
          </div>
        </div>
      </div>
    `;
  }

  function renderCalendar() {
    const month = getMonthData();
    const periodDates = PeladoCore.dates(state.currentYear, state.currentMonth);
    const first = PeladoCore.parseDate(periodDates[0]);
    const firstDayMondayIndex = (first.getDay() + 6) % 7;

    let cells = "";
    for (let i = 0; i < firstDayMondayIndex; i++) cells += `<div class="day empty"></div>`;

    for (const date of periodDates) {
      const day = Number(date.slice(8));
      const record = month.days[date] || defaultDayRecord(date);
      const typeClass = record.type === "libre" ? "free" : record.type === "falta" ? "absent" : record.holiday ? "holiday" : "worked";
      const today = isToday(date) ? "today" : "";
      const night = record.type === "trabajado" && record.shift === "noche" ? "night" : "";

      let label = month.days[date] ? "Trabajado" : "Sin registro";
      if (record.type === "libre") label = "Libre";
      if (record.type === "falta") label = "Falta";
      if (record.holiday && record.type === "trabajado") label = "Feriado";
      if (record.type === "trabajado" && record.shift === "noche") label += " · Noche";

      const production = record.type === "trabajado" && record.libras > 0 ? `${formatNumber(record.libras)} lb` : "";

      cells += `
        <button class="day ${typeClass} ${today} ${night}" data-action="open-day" data-date="${date}">
          <span class="day-number">${day}<small>/${Number(date.slice(5,7))}</small></span>
          <span class="day-type">${label}</span>
          ${production ? `<span class="day-extra">${production}</span>` : ""}
        </button>
      `;
    }

    $("#view-calendar").innerHTML = `
      <div class="calendar-toolbar calendar-local-toolbar">
        <div class="month-switch">
          <button class="icon-btn" data-action="prev-month" aria-label="Mes anterior">‹</button>
          <div class="month-name">${periodLabel()}</div>
          <button class="icon-btn" data-action="next-month" aria-label="Mes siguiente">›</button>
        </div>
        <button class="btn btn-secondary" data-action="today-month">Hoy</button>
      </div>

      <div class="card calendar-card">
        <div class="weekdays">${weekdayNames.map(d => `<div class="weekday">${d}</div>`).join("")}</div>
        <div class="calendar-grid">${cells}</div>
      </div>

      <div class="legend">
        <span class="legend-item"><i class="dot worked"></i>Trabajado</span>
        <span class="legend-item"><i class="dot free"></i>Libre</span>
        <span class="legend-item"><i class="dot absent"></i>Falta</span>
        <span class="legend-item"><i class="dot holiday"></i>Feriado</span>
        <span class="legend-item"><i class="dot night"></i>Noche</span>
      </div>

      <div class="card card-pad" style="margin-top:14px;">
        <div class="section-title">Cómo funciona el calendario</div>
        <p class="muted" style="margin:7px 0 0;font-size:12px;line-height:1.55;">
          Los días sin registro se consideran potencialmente trabajables para proyecciones. Registra producción y marca tus días libres,
          faltas, feriados y turnos nocturnos. Un feriado puede combinarse con un turno nocturno.
        </p>
      </div>
    `;
  }

  function renderHistory() {
    const month = getMonthData();
    const entries = getMonthEntries(month).sort((a,b) => a.date.localeCompare(b.date));

    if (!entries.length) {
      $("#view-history").innerHTML = `
        <div class="card empty-state">
          <div class="empty-icon">≡</div>
          <h2>Aún no hay registros</h2>
          <p>Cuando registres una jornada aparecerá aquí.</p>
          <button class="btn btn-primary" data-action="show-calendar">Ver calendario</button>
        </div>
      `;
      return;
    }

    $("#view-history").innerHTML = `
      <div class="section-head">
        <div>
          <div class="eyebrow">${periodLabel()}</div>
          <h2>Historial</h2>
          <p class="muted">Puedes editar o eliminar cualquier registro.</p>
        </div>
      </div>
      <div class="history-list">
        ${entries.map(record => historyItem(record)).join("")}
      </div>
    `;
  }

  function renderSettings() {
    const c = state.config;
    $("#view-settings").innerHTML = `
      <div class="section-head">
        <div>
          <div class="eyebrow">Configuración</div>
          <h2>Valores de cálculo</h2>
          <p class="muted">Los cambios recalculan TODAS las estimaciones históricas, como en el original. Los pagos reales no cambian.</p>
        </div>
      </div>

      <div class="settings-grid">
        <div class="card card-pad">
          <div class="section-title">Perfil</div>
          <div class="form-grid" style="margin-top:14px;">
            <div class="field">
              <label>Nombre</label>
              <input id="settingsName" class="input" value="${escapeAttr(state.profile?.name || "")}">
            </div>
            <div class="field">
              <label>Edad</label>
              <input id="settingsAge" class="input" type="number" min="1" max="120" value="${escapeAttr(state.profile?.age || "")}">
            </div>
          </div>
        </div>

        <div class="card card-pad">
          <div class="section-title">Precios por libra</div>
          <div class="price-row">
            <div class="price-label">Grande <div class="tiny">Tallas ${c.sizes.grande}</div></div>
            <input id="priceGrande" class="input" type="number" step="0.01" min="0" value="${c.prices.grande}">
          </div>
          <div class="price-row">
            <div class="price-label">Mediano <div class="tiny">Tallas ${c.sizes.mediano}</div></div>
            <input id="priceMediano" class="input" type="number" step="0.01" min="0" value="${c.prices.mediano}">
          </div>
          <div class="price-row">
            <div class="price-label">Pequeño <div class="tiny">Tallas ${c.sizes.pequeno}</div></div>
            <input id="pricePequeno" class="input" type="number" step="0.01" min="0" value="${c.prices.pequeno}">
          </div>
        </div>

        <div class="card card-pad">
          <div class="section-title">Categoría adicional y horas</div>
          <div class="field"><label>Nombre provisional (sin tallas asignadas)</label><input id="additionalName" class="input" value="${escapeAttr(c.additionalName)}"></div>
          <div class="price-row"><label for="priceAdicional">Adicional · USD/lb</label><input id="priceAdicional" class="input" type="number" min="0" step="0.01" value="${c.prices.adicional}"></div>
          <div class="price-row"><label for="hourlyRate">Tarifa por hora · USD/h</label><input id="hourlyRate" class="input" type="number" min="0" step="0.01" value="${c.hourlyRate}"></div>
          <div class="price-row"><label for="hourHolidayMultiplier">Feriado + horas · multiplicador provisional</label><input id="hourHolidayMultiplier" class="input" type="number" min="0" step="0.1" value="${c.hourHolidayMultiplier}"></div>
          <p class="tiny">Referencia $2,01/h. Multiplicador de horas 1 hasta definir otra regla. No se descuentan descansos.</p>
          <p class="notice">Tarifas predeterminadas confirmadas: Grande $0,11; Mediano $0,14; Pequeño $0,22 por libra. Tus cambios se guardan solo en este dispositivo.</p>
        </div>
        <div class="card card-pad">
          <div class="section-title">Reglas laborales</div>
          <div class="price-row">
            <div class="price-label">Recargo nocturno <div class="tiny">Se suma a cada categoría</div></div>
            <input id="nightSurcharge" class="input" type="number" step="0.01" min="0" value="${c.nightSurcharge}">
          </div>
          <div class="price-row">
            <div class="price-label">Multiplicador feriado <div class="tiny">2 = doble</div></div>
            <input id="holidayMultiplier" class="input" type="number" step="0.1" min="1" value="${c.holidayMultiplier}">
          </div>
          <div class="price-row">
            <div class="price-label">Descuento por falta</div>
            <input id="absenceDeduction" class="input" type="number" step="0.01" min="0" value="${c.absenceDeduction}">
          </div>
        </div>

        <div class="card card-pad">
          <div class="section-title">Libres y bono</div>
          <div class="price-row">
            <label for="freeDayRate" class="price-label">Pago por día libre <div class="tiny">USD por cada día marcado Libre</div></label>
            <input id="freeDayRate" class="input" type="number" step="0.01" min="0" value="${c.freeDayRate}">
          </div>
          <div class="price-row">
            <div class="price-label">Bono de asistencia <div class="tiny">Solo si no hubo faltas</div></div>
            <input id="attendanceBonus" class="input" type="number" step="0.01" min="0" value="${c.attendanceBonus}">
          </div>
          <p class="tiny">Referencia provisional: $16,07 por libre. Se suman solo los días marcados Libre, también si ya los programaste. El adelanto recibido no es un ingreso adicional; regístralo en pagos reales. Cambiar este precio recalcula las estimaciones de libres de todos los períodos.</p>
          <div style="margin-top:14px;">
            <button class="btn btn-primary btn-block" data-action="save-settings">Guardar cambios</button>
          </div>
        </div>
      </div>

      <div class="card card-pad" style="margin-top:14px;">
        <div class="section-head">
          <div>
            <div class="section-title">Datos locales</div>
            <div class="tiny">Todo se guarda en este dispositivo mediante LocalStorage.</div>
          </div>
          <button class="btn btn-danger" data-action="reset-data">Borrar todos los datos</button>
        </div>
        <div class="notice">
          El control diario no usa servidor ni cuenta externa. Si borras los datos del navegador,
          también desaparecerán los registros guardados aquí.
        </div>
      </div>
      <div class="card card-pad" style="margin-top:14px"><h3>Respaldo y tarifas predeterminadas</h3>
        <div class="actions"><button class="btn btn-secondary" data-action="backup">Descargar respaldo JSON</button><button class="btn btn-secondary" data-action="import-backup">Importar respaldo</button><button class="btn btn-soft" data-action="default-rates">Usar tarifas predeterminadas</button></div>
        <p class="tiny">Los valores predeterminados se publican con la aplicación. Tus tarifas personalizadas tienen prioridad y no se envían a Supabase.</p>
        <input id="backupFile" type="file" accept=".json" hidden onchange="window.importPeladoBackup(this.files[0])">
        <h3>Pagos del calendario anterior</h3><p class="tiny">Sin fecha de depósito no se puede deducir su período. Asigna cada pago explícitamente; el original queda en el respaldo.</p>
        ${legacyPaymentsUI()}
      </div>
    `;
  }

  function openProfileModal(firstTime) {
    const profile = state.profile || { name: "", age: "" };
    openModal(`
      <div class="modal">
        <div class="modal-head">
          <div>
            <div class="eyebrow">${firstTime ? "Bienvenido" : "Perfil"}</div>
            <h2 class="modal-title">${firstTime ? "Configuremos tu perfil" : "Tu perfil"}</h2>
          </div>
          ${firstTime ? "" : `<button class="icon-btn" data-action="close-modal">×</button>`}
        </div>
        <div class="modal-body">
          <div class="notice" style="margin-bottom:14px;">
            La edad es informativa y no interviene en ningún cálculo.
          </div>
          <div class="form-grid">
            <div class="field full">
              <label>Nombre</label>
              <input id="profileName" class="input" value="${escapeAttr(profile.name)}" placeholder="Ej. Billy">
            </div>
            <div class="field full">
              <label>Edad</label>
              <input id="profileAge" class="input" type="number" min="1" max="120" value="${escapeAttr(profile.age)}" placeholder="Ej. 25">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          ${firstTime ? "" : `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button>`}
          <button class="btn btn-primary" data-action="save-profile">Guardar y continuar</button>
        </div>
      </div>
    `);
  }

  function openDayModal(date) {
    if (!date) return;
    state.editingDate = date;
    const month = getMonthData();
    const existing = month.days[date] || defaultDayRecord(date);

    openModal(buildDayModal(existing));
    updateDayCalculation();
  }

  function buildDayModal(record) {
    const displayDate = formatLongDate(record.date);
    const isWorked = record.type === "trabajado";
    const isFree = record.type === "libre";
    const isAbsent = record.type === "falta";

    return `
      <div class="modal">
        <div class="modal-head">
          <div>
            <div class="eyebrow">${displayDate}</div>
            <h2 class="modal-title">Registro del día</h2>
          </div>
          <button class="icon-btn" data-action="close-modal">×</button>
        </div>

        <div class="modal-body">
          <div class="day-type-grid">
            <button class="type-option ${isWorked ? "selected" : ""}" data-modal-type="trabajado">
              <strong>Trabajé</strong><span>Registrar producción</span>
            </button>
            <button class="type-option ${isFree ? "selected" : ""}" data-modal-type="libre">
              <strong>Día libre</strong><span>Pago unitario configurado</span>
            </button>
            <button class="type-option ${isAbsent ? "selected" : ""}" data-modal-type="falta">
              <strong>Falté</strong><span>Aplica descuento</span>
            </button>
          </div>

          <input type="hidden" id="dayType" value="${record.type}">

          <div id="workedFields" class="${isWorked ? "" : "hidden"}">
            <div class="form-grid">
              <div class="field">
                <label>Turno</label>
                <select id="dayShift" class="select">
                  <option value="manana" ${record.shift === "manana" ? "selected" : ""}>Mañana</option>
                  <option value="noche" ${record.shift === "noche" ? "selected" : ""}>Noche</option>
                </select>
              </div>
              <div class="field">
                <label>Feriado</label>
                <select id="dayHoliday" class="select">
                  <option value="no" ${!record.holiday ? "selected" : ""}>No</option>
                  <option value="si" ${record.holiday ? "selected" : ""}>Sí, aplica multiplicador configurado</option>
                </select>
              </div>
            </div>

            <div class="counter-list" style="margin-top:14px;">
              ${counterRow("Grande", "grande", record.grande, "Tallas 15, 16, 21, 26")}
              ${counterRow("Mediano", "mediano", record.mediano, "Tallas 31, 36, 41")}
              ${counterRow("Pequeño", "pequeno", record.pequeno, "Talla 51")}
              ${counterRow(escapeHtml(state.config.additionalName), "adicional", record.adicional, "Sin tallas asignadas")}
            </div>

            <div class="field" style="margin-top:14px;">
              <label>Libras totales del día</label>
              <input id="totalLb" class="input day-input" type="number" min="0" step="0.01" value="${record.libras || ""}" placeholder="Ej. 133">
            </div>

            <div class="field" style="margin-top:14px"><label for="hoursEnabled">¿Trabajaste por horas?</label><select id="hoursEnabled" class="select"><option value="no">No</option><option value="si" ${record.hoursEnabled?'selected':''}>Sí</option></select></div>
            <div id="hoursFields" class="form-grid">
              <div class="field"><label for="startTime">Inicio · credencial entregada</label><input id="startTime" class="input day-input" type="time" value="${escapeAttr(record.startTime||'')}"></div>
              <div class="field"><label for="endTime">Fin · credencial devuelta</label><input id="endTime" class="input day-input" type="time" value="${escapeAttr(record.endTime||'')}"></div>
              <label class="field full"><span><input id="nextDay" type="checkbox" ${record.nextDay?'checked':''}> La hora de fin corresponde al día siguiente</span></label>
              <p class="tiny field full">Marca explícitamente el cruce de medianoche. El recargo nocturno de pelado se marca con el selector Turno.</p>
            </div>
            <div id="dayCalculation" class="calculation-box"></div>
          </div>

          <div id="absenceNotice" class="${isAbsent ? "" : "hidden"}">
            <div class="notice" style="color:var(--color-danger);background:var(--color-danger-soft);border-color:#f4c8ce;">
              Esta falta aplicará automáticamente un descuento de <strong>${money(state.config.absenceDeduction)}</strong>
              y hará que el bono de asistencia sea $0 al cierre del período.
            </div>
          </div>

          <div id="freeNotice" class="${isFree ? "" : "hidden"}">
            <div class="notice">
              Este día se considera libre. Suma el pago por libre configurado; no entra en el promedio de producción ni genera descuento.
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
          <button class="btn btn-primary" data-action="save-day">Guardar día</button>
        </div>
      </div>
    `;
  }

  function counterRow(label, key, value, subtitle) {
    return `
      <div class="counter-row">
        <div class="counter-label">
          <strong>${label}</strong>
          <small>${subtitle}</small>
        </div>
        <div class="counter">
          <button type="button" data-counter="${key}" data-delta="-1">−</button>
          <input id="counter-${key}" class="counter-value" value="${Number(value || 0)}" inputmode="numeric" style="border:0;background:transparent;max-width:38px;" />
          <button type="button" data-counter="${key}" data-delta="1">+</button>
        </div>
      </div>
    `;
  }

  function formRecord() {
    return {date:state.editingDate,type:$("#dayType").value,shift:$("#dayShift").value,holiday:$("#dayHoliday").value==="si",
      ...Object.fromEntries(PeladoCore.keys.map(k=>[k,numberValue(`#counter-${k}`)])),libras:numberValue("#totalLb"),
      hoursEnabled:$("#hoursEnabled").value==="si",startTime:$("#startTime").value,endTime:$("#endTime").value,nextDay:$("#nextDay").checked};
  }
  function updateDayCalculation() {
    if(!$("#dayType"))return;
    const r=formRecord();
    $("#workedFields").classList.toggle("hidden",r.type!=="trabajado");
    $("#absenceNotice").classList.toggle("hidden",r.type!=="falta");
    $("#freeNotice").classList.toggle("hidden",r.type!=="libre");
    $("#hoursFields").classList.toggle("hidden",!r.hoursEnabled);
    if(r.type==="libre"){$("#dayCalculation").innerHTML=`${projectionLine("Pago por día libre",money(PeladoCore.freeDayPay(1,state.config.freeDayRate)))}<p class="tiny">No se aplica nocturno ni feriado al libre. No genera producción ni descuento.</p>`;return;}
    const c=calculateDay(r);
    $("#dayCalculation").innerHTML=`<div class="tiny">Distribución proporcional · ${formatNumber(c.lbPerTray)} lb por bandeja</div>
      ${PeladoCore.keys.map((k,i)=>`<div class="calc-row"><span>${escapeHtml(["Grande","Mediano","Pequeño",state.config.additionalName][i])} · ${formatNumber(c.lb[k])} lb</span><strong>${money(c.money[k])}</strong></div>`).join("")}
      ${projectionLine("Pago por pelado",money(c.peelingMoney))}
      ${projectionLine("Pago por horas · "+c.minutes+" min",money(c.hoursMoney))}
      ${c.hourError?`<p role="alert">${escapeHtml(c.hourError)}</p>`:""}
      ${r.holiday?`<div class="tiny">Feriado: pelado ×${state.config.holidayMultiplier}; horas ×${state.config.hourHolidayMultiplier}</div>`:""}
      ${r.shift==="noche"?`<div class="tiny">Recargo manual +${money(state.config.nightSurcharge)}/lb antes de multiplicar feriado</div>`:""}
      <div class="calc-total"><span>Estimación combinada</span><span>${money(c.totalMoney)}</span></div>`;
  }
  function calculateDay(record) { return PeladoCore.calculateDay(record,state.config); }
  function saveDay() {
    if(!state.editingDate)return;
    let record=formRecord();
    if(record.type==="trabajado") {
      const inputs=$$("#workedFields input[type=number], #workedFields .counter-value");
      if(inputs.some(el=>!Number.isFinite(Number(el.value))||Number(el.value)<0||!el.checkValidity()))return toast("Revisa las cantidades: deben ser números válidos y no negativos.");
      if(PeladoCore.keys.some(k=>!Number.isInteger(record[k])))return toast("Las bandejas deben ser cantidades enteras.");
      const c=calculateDay(record);
      if(c.hourError)return toast(c.hourError);
      if((c.totalTrays>0)!==(record.libras>0))return toast("Para pelado indica tanto bandejas como libras.");
      if(!c.totalTrays&&!record.hoursEnabled)return toast("Registra pelado o un tramo por horas.");
      if(c.minutes>960&&!confirm(`El tramo dura ${c.minutes/60} horas. ¿Confirmas la duración?`))return;
    }else record={...defaultDayRecord(record.date),type:record.type};
    getMonthData().days[record.date]=record;
    try{save(STORAGE_KEYS.months,state.months);}catch{return;}
    closeModal();renderAll();toast("Día guardado.");
  }

  function deleteDay(date) {
    if (!date) return;
    const month = getMonthData();
    if (!month.days[date]) return;

    if (!confirm(`¿Eliminar el registro del ${formatLongDate(date)}?`)) return;

    delete month.days[date];
    save(STORAGE_KEYS.months, state.months);
    renderAll();
    toast("Registro eliminado.");
  }

  function calculateMonthStats(entries) {
    let productionBeforeAbsence = 0;
    let hoursMoney = 0;
    let totalLb = 0;
    let totalTrays = 0;
    let workedDays = 0;
    let freeDays = 0;
    let absences = 0;
    let holidays = 0;
    let nights = 0;
    let absenceDeduction = 0;

    const categoryMoney = { grande: 0, mediano: 0, pequeno: 0, adicional: 0 };
    const categoryLb = { grande: 0, mediano: 0, pequeno: 0, adicional: 0 };
    const daily = [];

    entries.forEach(record => {
      if (record.type === "libre") {
        freeDays++;
        return;
      }

      if (record.type === "falta") {
        absences++;
        absenceDeduction += Number(state.config.absenceDeduction);
        return;
      }

      if (record.type !== "trabajado") return;

      workedDays++;
      if (record.holiday) holidays++;
      if (record.shift === "noche") nights++;

      const calc = calculateDay(record);
      hoursMoney += calc.hoursMoney;

      totalLb += Number(record.libras);
      totalTrays += calc.totalTrays;
      productionBeforeAbsence += calc.totalMoney;

      categoryMoney.grande += calc.money.grande;
      categoryMoney.mediano += calc.money.mediano;
      categoryMoney.pequeno += calc.money.pequeno;
      categoryMoney.adicional += calc.money.adicional;

      categoryLb.grande += calc.lb.grande;
      categoryLb.mediano += calc.lb.mediano;
      categoryLb.pequeno += calc.lb.pequeno;
      categoryLb.adicional += calc.lb.adicional;

      daily.push(calc.totalMoney);
    });

    const productionAdjusted = truncateCents(productionBeforeAbsence - absenceDeduction);
    const average = daily.length ? truncateCents(productionBeforeAbsence / daily.length) : 0;
    const min = daily.length ? Math.min(...daily) : 0;
    const max = daily.length ? Math.max(...daily) : 0;

    const remainingWorkableDays = PeladoCore.remaining(state.currentYear,state.currentMonth,getMonthData().days);

    return {
      hoursMoney: truncateCents(hoursMoney),
      productionBeforeAbsence: truncateCents(productionBeforeAbsence),
      productionAdjusted,
      totalLb,
      totalTrays,
      workedDays,
      freeDays,
      freeMoney: PeladoCore.freeDayPay(freeDays,state.config.freeDayRate),
      absences,
      holidays,
      nights,
      absenceDeduction: truncateCents(absenceDeduction),
      categoryMoney: {
        grande: truncateCents(categoryMoney.grande),
        mediano: truncateCents(categoryMoney.mediano),
        pequeno: truncateCents(categoryMoney.pequeno),
        adicional: truncateCents(categoryMoney.adicional)
      },
      categoryLb,
      average,
      min: truncateCents(min),
      max: truncateCents(max),
      remainingWorkableDays,
      daily
    };
  }

  function openRealPaymentModal() {
    const real = getRealPaymentData();

    openModal(`
      <div class="modal">
        <div class="modal-head">
          <div>
            <div class="eyebrow">Dinero recibido</div>
            <h2 class="modal-title">Registrar pagos reales</h2>
          </div>
          <button class="icon-btn" data-action="close-modal">×</button>
        </div>
        <div class="modal-body">
          <div class="notice" style="margin-bottom:14px;">
            La proyección y el pago real se guardan por separado. La app no inventará que te depositaron dinero solo porque una fórmula se puso optimista.
          </div>
          <div class="form-grid">
            <div class="field">
              <label>Adelanto recibido</label>
              <input id="realFortnight" class="input" type="number" step="0.01" min="0" value="${real.fortnight}">
            </div>
            <div class="field">
              <label>Cierre recibido</label>
              <input id="realMonthEnd" class="input" type="number" step="0.01" min="0" value="${real.monthEnd}">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
          <button class="btn btn-primary" data-action="save-real-payment">Guardar pagos</button>
        </div>
      </div>
    `);
  }

  function saveRealPayment() {
    const key = monthKey();
    state.realPayments[key] = {
      ...getRealPaymentData(),
      fortnight: numberValue("#realFortnight"),
      monthEnd: numberValue("#realMonthEnd")
    };
    save(STORAGE_KEYS.realPayments, state.realPayments);
    closeModal();
    renderAll();
    toast("Pago real guardado.");
  }

  function saveProfile() {
    const name = $("#profileName")?.value.trim();
    const age = $("#profileAge")?.value;

    if (!name) {
      toast("Escribe tu nombre.");
      return;
    }

    state.profile = { name, age: age ? Number(age) : "" };
    save(STORAGE_KEYS.profile, state.profile);
    closeModal();
    renderAll();
    toast("Perfil guardado.");
  }

  function saveSettings() {
    if($$("#view-settings input[type=number]").some(el=>!el.checkValidity()||!Number.isFinite(Number(el.value)))) return toast("Revisa los valores de ajustes.");
    state.profile={name:$("#settingsName").value.trim(),age:$("#settingsAge").value?Number($("#settingsAge").value):""};
    save(STORAGE_KEYS.profile,state.profile);
    state.config.prices.adicional=numberValue("#priceAdicional");
    state.config.additionalName=$("#additionalName").value.trim()||"Adicional (provisional)";
    state.config.hourlyRate=numberValue("#hourlyRate");
    state.config.hourHolidayMultiplier=numberValue("#hourHolidayMultiplier");
    state.config.prices.grande = numberValue("#priceGrande");
    state.config.prices.mediano = numberValue("#priceMediano");
    state.config.prices.pequeno = numberValue("#pricePequeno");
    state.config.nightSurcharge = numberValue("#nightSurcharge");
    state.config.holidayMultiplier = Math.max(1, numberValue("#holidayMultiplier"));
    state.config.absenceDeduction = numberValue("#absenceDeduction");
    state.config.freeDayRate = numberValue("#freeDayRate");
    state.config.attendanceBonus = numberValue("#attendanceBonus");

    const overrides=Object.fromEntries(PeladoCore.keys.filter(k=>state.config.prices[k]!==APP_CONFIG.prices[k]).map(k=>[k,state.config.prices[k]]));
    save("pelado_price_overrides_v1",overrides);
    save(STORAGE_KEYS.config, state.config);
    renderAll();
    toast("Configuración actualizada.");
  }

  function resetAllData() {
    if (!confirm("Esto borrará perfil, meses, pagos reales y configuración personalizada. ¿Continuar?")) return;
    localStorage.removeItem(STORAGE_KEYS.profile);
    localStorage.removeItem(STORAGE_KEYS.months);
    localStorage.removeItem(STORAGE_KEYS.realPayments);
    localStorage.removeItem(STORAGE_KEYS.config);
    ["pelado_price_overrides_v1","pelado_migration_v2","pelado_legacy_assignments_v2","peladoClaroData","pelado_profile_v1","pelado_config_v1","pelado_months_v1","pelado_real_payments_v1","pelado_migration_backup_v1"].forEach(k=>localStorage.removeItem(k));
    location.reload();
  }

  function getMonthData() {
    const key = monthKey();
    if (!state.months[key]) {
      state.months[key] = { days: {} };
      try {save(STORAGE_KEYS.months, state.months);} catch {}
    }
    return state.months[key];
  }

  function getMonthEntries(month) {
    return Object.values(month.days || {});
  }

  function getRealPaymentData() {
    return state.realPayments[monthKey()] || { fortnight: 0, monthEnd: 0 };
  }

  // Acceso acotado para el panel de importación Excel; el guardado es atómico.
  window.PeladoDaily = {
    snapshot: () => structuredClone({months:state.months,config:state.config}),
    importProduction(period, records, replace=false) {
      if(!/^\d{4}-\d{2}$/.test(period))throw Error("Período inválido.");
      const next=structuredClone(state.months);next[period]??={days:{}};
      let added=0,skipped=0,overwritten=0;
      for(const input of records){
        PeladoCore.parseDate(input.date);
        if(PeladoCore.periodOf(input.date)!==period)throw Error("Fecha fuera del período.");
        for(const key of PeladoCore.keys)if(!Number.isInteger(input[key])||input[key]<0)throw Error("Bandejas inválidas.");
        if(!Number.isFinite(input.libras)||input.libras<=0||!PeladoCore.keys.some(k=>input[k]>0))throw Error("Libras inválidas.");
        if(next[period].days[input.date]&&!replace){skipped++;continue;}
        if(next[period].days[input.date])overwritten++;
        const record={...defaultDayRecord(input.date),...Object.fromEntries(PeladoCore.keys.map(k=>[k,input[k]])),libras:input.libras,hoursEnabled:false,startTime:'',endTime:'',nextDay:false};
        next[period].days[input.date]=record;added++;
      }
      if(added){if(overwritten)exportBackup();save(STORAGE_KEYS.months,next);state.months=next;}
      // Mostrar el período importado, no el período actual que estaba abierto.
      window.PeladoDaily.openPeriod(period);
      toast(`${added} días guardados; ${skipped} existentes conservados. Período ${period}-21 al ${PeladoCore.dateKey(new Date(state.currentYear,state.currentMonth+1,20,12))}.${overwritten?' El JSON descargado es el respaldo anterior.':''}`);
      return {added,skipped,overwritten};
    },
    deletePeriod(period) {
      if(!state.months[period])return;
      exportBackup();
      const next=structuredClone(state.months);delete next[period];
      save(STORAGE_KEYS.months,next);state.months=next;renderAll();
    },
    openPeriod(period) {
      if(!/^\d{4}-\d{2}$/.test(period))return;
      const [year,month]=period.split('-').map(Number);state.currentYear=year;state.currentMonth=month-1;renderAll();switchView('calendar');
    }
  };

  function defaultDayRecord(date) {
    return {
      date,
      type: "trabajado",
      shift: "manana",
      holiday: false,
      grande: 0,
      mediano: 0,
      pequeno: 0,
      libras: 0
    };
  }

  function monthKey() {
    return `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, "0")}`;
  }

  function dateKey(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function changeMonth(delta) {
    const d = new Date(state.currentYear, state.currentMonth + delta, 1);
    state.currentMonth = d.getMonth();
    state.currentYear = d.getFullYear();
    renderAll();
  }

  function statCard(label, value, meta) {
    return `
      <div class="card stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
        <div class="stat-meta">${meta}</div>
      </div>
    `;
  }

  function breakdownRow(label, moneyValue, lbValue, total) {
    const percent = total > 0 ? Math.min(100, Math.max(0, (moneyValue / total) * 100)) : 0;
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">${label}</div>
        <div>
          <div class="progress"><span style="width:${percent}%"></span></div>
          <div class="tiny" style="margin-top:4px;">${formatNumber(lbValue)} lb</div>
        </div>
        <div class="money">${money(moneyValue)}</div>
      </div>
    `;
  }

  function projectionLine(label, value) {
    return `<div class="projection-line"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function historyItem(record) {
    const calc = record.type === "trabajado" ? calculateDay(record) : null;

    let sub = "Día libre";
    let value = record.type==="libre"?money(PeladoCore.freeDayPay(1,state.config.freeDayRate)):"—";
    if(record.type==="libre")sub="Día libre · pago unitario configurado";

    if (record.type === "falta") {
      sub = `Falta · descuento ${money(state.config.absenceDeduction)}`;
      value = `-${money(state.config.absenceDeduction)}`;
    }

    if (record.type === "trabajado") {
      sub = `${record.shift === "noche" ? "Noche" : "Mañana"}${record.holiday ? " · Feriado" : ""} · ${calc.totalTrays} bandejas · ${formatNumber(record.libras)} lb · pelado ${money(calc.peelingMoney)} · horas ${calc.minutes} min: ${money(calc.hoursMoney)}`;
      value = money(calc.totalMoney);
    }

    return `
      <div class="card history-item" data-date="${record.date}">
        <div>
          <div class="history-date">${formatLongDate(record.date)}</div>
          <div class="history-sub">${sub}</div>
        </div>
        <div class="history-actions">
          <strong>${value}</strong>
          <button class="btn btn-secondary" data-action="edit-day" data-date="${record.date}">Editar</button>
          <button class="btn btn-danger" data-action="delete-day" data-date="${record.date}">Eliminar</button>
        </div>
      </div>
    `;
  }

  function openModal(content) {
    $("#modalRoot").innerHTML = `<div class="modal-backdrop">${content}</div>`;

    $$("#modalRoot [data-modal-type]").forEach(btn => {
      btn.addEventListener("click", () => {
        $$("#modalRoot [data-modal-type]").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        $("#dayType").value = btn.dataset.modalType;
        updateDayCalculation();
      });
    });

    $("#modalRoot [data-action='save-day']")?.addEventListener("click", saveDay);
  }

  function closeModal() {
    $("#modalRoot").innerHTML = "";
    state.editingDate = null;
  }

  function openDrawer() {
    $("#mobileDrawer")?.classList.add("open");
    $("#drawerBackdrop")?.classList.remove("hidden");
  }

  function closeDrawer() {
    $("#mobileDrawer")?.classList.remove("open");
    $("#drawerBackdrop")?.classList.add("hidden");
  }

  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2300);
  }

  function periodLabel() {
    const ds=PeladoCore.dates(state.currentYear,state.currentMonth);
    return ds.map((d,i)=>i===0||i===ds.length-1?PeladoCore.parseDate(d).toLocaleDateString('es-EC',{day:'numeric',month:'short',year:'numeric'}):null).filter(Boolean).join(' — ');
  }
  function periodToolbar() {return `<div class="period-toolbar card"><button class="icon-btn" data-action="prev-month" aria-label="Período anterior">‹</button><strong>${periodLabel()}</strong><button class="icon-btn" data-action="next-month" aria-label="Período siguiente">›</button><button class="btn btn-soft" data-action="today-month">Actual</button></div>`;}
  function migrateStorage() {
    if(load('pelado_migration_v2',false))return;
    const old=load('pelado_months_v1',{}),payments=load('pelado_real_payments_v1',{});
    const result=PeladoCore.migrate(old);
    if(!load('pelado_migration_backup_v1',null))save('pelado_migration_backup_v1',{created:new Date().toISOString(),months:old,realPayments:payments,config:state.config,profile:state.profile,conflicts:result.conflicts});
    for(const [k,v]of Object.entries(result.periods)){state.months[k]??={days:{}};for(const [d,r]of Object.entries(v.days))if(!state.months[k].days[d])state.months[k].days[d]=r;}
    save(STORAGE_KEYS.months,state.months);save('pelado_migration_v2',true);
  }
  function legacyAssignments(){const assigned=load("pelado_legacy_assignments_v2",{});for(const [period,payment]of Object.entries(state.realPayments))for(const source of payment.legacySources||[])assigned[source]=period;return assigned;}
  function legacyPaymentsUI(){
    const old=load('pelado_migration_backup_v1',{}).realPayments||{},assigned=legacyAssignments();
    return Object.entries(old).map(([k,v])=>`<div class="projection-line"><span>${escapeHtml(k)} · adelanto ${money(v.fortnight)}, cierre ${money(v.monthEnd)}</span>${assigned[k]?`<strong>Asignado a ${escapeHtml(assigned[k])}</strong>`:`<button class="btn btn-soft" data-action="assign-payment" data-legacy="${escapeAttr(k)}">Asignar al período visible</button>`}</div>`).join('')||'<p class="tiny">No hay pagos antiguos pendientes.</p>';
  }
  function assignLegacyPayment(k){
    const backup=load('pelado_migration_backup_v1',{}),r=backup.realPayments?.[k],assignments=legacyAssignments();
    if(!r||assignments[k])return;
    if(!confirm(`¿Asignar el pago antiguo ${k} al período ${periodLabel()}? Si ya hay un pago, se sumarán los importes.`))return;
    const v=getRealPaymentData();state.realPayments[monthKey()]={fortnight:truncateCents(Number(v.fortnight||0)+Number(r.fortnight||0)),monthEnd:truncateCents(Number(v.monthEnd||0)+Number(r.monthEnd||0)),legacySources:[...(v.legacySources||[]),k]};
    assignments[k]=monthKey();save(STORAGE_KEYS.realPayments,state.realPayments);save('pelado_legacy_assignments_v2',assignments);renderAll();toast('Pago asignado.');
  }
  function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function exportBackup(){
    const data={schema:'pelado-backup',version:2,created:new Date().toISOString(),values:{}};
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('pelado'))data.values[k]=localStorage.getItem(k);}
    download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'pelado-respaldo.json');
  }
  window.importPeladoBackup=async file=>{
    if(!file)return;
    try{
      if(file.size>20*1024*1024)throw Error('El respaldo supera 20 MB.');
      const data=JSON.parse(await file.text());
      if(data.schema!=='pelado-backup'||data.version!==2||!data.values||typeof data.values!=='object')throw Error('No es un respaldo Pelado versión 2.');
      const allowed=new Set([...Object.values(STORAGE_KEYS),'pelado_months_v1','pelado_real_payments_v1','pelado_migration_v2','pelado_migration_backup_v1','pelado_legacy_assignments_v2','peladoClaroData','pelado_remote_rates_cache','pelado_price_overrides_v1']);
      const entries=Object.entries(data.values);if(entries.some(([k,v])=>!allowed.has(k)||typeof v!=='string'))throw Error('El respaldo contiene claves no admitidas.');
      const parsed=Object.fromEntries(entries.map(([k,v])=>[k,JSON.parse(v)]));
      for(const key of [STORAGE_KEYS.months,'pelado_months_v1'])for(const bucket of Object.values(parsed[key]||{}))for(const [d,r]of Object.entries(bucket.days||{})){PeladoCore.parseDate(d);if(r.date!==d||!['trabajado','libre','falta'].includes(r.type))throw Error('Jornada inválida en respaldo.');for(const k of [...PeladoCore.keys,'libras'])if(r[k]!=null&&(!Number.isFinite(r[k])||r[k]<0))throw Error('Cantidad inválida en respaldo.');}
      const cfg=parsed[STORAGE_KEYS.config];
      if(cfg){
        if(typeof cfg!=="object"||Array.isArray(cfg))throw Error("Configuración inválida.");
        for(const k of ["nightSurcharge","holidayMultiplier","absenceDeduction","fortnightDeposit","freeDayRate","attendanceBonus","hourlyRate","hourHolidayMultiplier","splashDurationMs"])if(cfg[k]!=null&&(typeof cfg[k]!=="number"||!Number.isFinite(cfg[k])||cfg[k]<0))throw Error("Configuración numérica inválida: "+k);
        if(cfg.prices&&(typeof cfg.prices!=="object"||Array.isArray(cfg.prices)||Object.values(cfg.prices).some(v=>typeof v!=="number"||!Number.isFinite(v)||v<0)))throw Error("Tarifa inválida.");
        if(cfg.additionalName!=null&&typeof cfg.additionalName!=="string")throw Error("Nombre adicional inválido.");
      }
      const priceOverrides=parsed['pelado_price_overrides_v1'];if(priceOverrides&&(typeof priceOverrides!=='object'||Array.isArray(priceOverrides)||Object.entries(priceOverrides).some(([k,v])=>!PeladoCore.keys.includes(k)||typeof v!=='number'||!Number.isFinite(v)||v<0)))throw Error('Tarifas personalizadas inválidas.');
      const profile=parsed[STORAGE_KEYS.profile];if(profile&&(typeof profile.name!=="string"||(profile.age!==""&&(!Number.isFinite(profile.age)||profile.age<1||profile.age>120))))throw Error("Perfil inválido.");
      for(const key of [STORAGE_KEYS.realPayments,"pelado_real_payments_v1"])for(const payment of Object.values(parsed[key]||{}))for(const field of ["fortnight","monthEnd"])if(typeof payment[field]!=="number"||!Number.isFinite(payment[field])||payment[field]<0)throw Error("Pago real inválido.");

      if(!confirm('Se reemplazarán los datos Pelado de este dispositivo. Se descargará primero un respaldo de los actuales. ¿Continuar?'))return;
      exportBackup();const previous={};for(const k of allowed)previous[k]=localStorage.getItem(k);
      try{for(const k of allowed)localStorage.removeItem(k);for(const [k,v]of entries)localStorage.setItem(k,v);}catch(e){for(const k of allowed){if(previous[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,previous[k]);}throw e;}
      location.reload();
    }catch(e){toast('No se importó: '+e.message);}
  };
  function restoreDefaultRates(){
    if(!confirm('¿Usar las tarifas predeterminadas de esta versión y recalcular las estimaciones históricas?'))return;
    state.config.prices=structuredClone(APP_CONFIG.prices);
    save('pelado_price_overrides_v1',{});
    save(STORAGE_KEYS.config,state.config);renderAll();toast('Tarifas predeterminadas aplicadas.');
  }

  function applySavedConfig() {
    state.config = deepMerge(structuredClone(APP_CONFIG), state.config || {});
    state.config.sizes = structuredClone(APP_CONFIG.sizes);
    if(state.config.additionalName === "Adicional (provisional)")state.config.additionalName=APP_CONFIG.additionalName;
    let overrides=load('pelado_price_overrides_v1',null);
    if(overrides===null){
      // No se puede deducir si las tarifas v1 eran una personalización: se conservan.
      const existing=load(STORAGE_KEYS.config,null);
      overrides=existing?.prices?Object.fromEntries(PeladoCore.keys.filter(k=>Number.isFinite(existing.prices[k])).map(k=>[k,existing.prices[k]])):{};
      try{save('pelado_price_overrides_v1',overrides);}catch{}
    }
    for(const key of PeladoCore.keys)state.config.prices[key]=Number.isFinite(overrides[key])?overrides[key]:APP_CONFIG.prices[key];
  }

  function deepMerge(base, custom) {
    if (!custom || typeof custom !== "object") return base;
    Object.keys(custom).forEach(key => {
      if(["__proto__","constructor","prototype"].includes(key)) return;
      if (custom[key] && typeof custom[key] === "object" && !Array.isArray(custom[key])) {
        base[key] = deepMerge(base[key] || {}, custom[key]);
      } else {
        base[key] = custom[key];
      }
    });
    return base;
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { toast("No se pudo guardar: almacenamiento lleno o bloqueado. Exporta un respaldo."); throw e; }
  }

  function load(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function numberValue(selector) {
    const el = $(selector);
    const v = el ? Number(el.value || 0) : 0; return Number.isFinite(v) ? Math.max(0,v) : 0;
  }

  function truncateCents(value) {
    return Math.floor((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("es-EC", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function money(value) {
    return `$${formatMoney(value)}`;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("es-EC", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  function initials(name) {
    const parts = String(name || "P").trim().split(/\s+/);
    return parts.slice(0, 2).map(p => p[0]).join("").toUpperCase() || "P";
  }

  function formatLongDate(dateString) {
    const [y, m, d] = dateString.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-EC", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
  }

  function isToday(dateString) {
    const now = new Date();
    return dateString === dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
