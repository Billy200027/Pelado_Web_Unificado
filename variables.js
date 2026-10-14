/* =========================================================
   CONFIGURACIÓN EDITABLE DE LA APLICACIÓN
   Cambia aquí los valores que pueden variar en el futuro.
   No necesitas tocar app.js para modificar precios.
   ========================================================= */

const APP_CONFIG = {
  appName: "Pelado",

  // Tiempo del splash en milisegundos.
  splashDurationMs: 3000,

  // Valores económicos base.
  prices: {
    grande: 0.11,
    mediano: 0.14,
    pequeno: 0.22,
    adicional: 0.08
  },

  // Recargo por libra para turno nocturno.
  nightSurcharge: 0.01,

  // El feriado multiplica el precio final por este valor.
  holidayMultiplier: 2,

  // Descuento por una falta.
  absenceDeduction: 32,

  // Pago unitario de día libre. Provisional y editable localmente.
  freeDayRate: 16.07,

  // Bono de asistencia de fin de mes.
  attendanceBonus: 70,

  additionalName: "Adicional (provisional)",
  hourlyRate: 2.01,
  hourHolidayMultiplier: 1,

  // Nombres y tallas solo como información de referencia.
  sizes: {
    grande: "15, 16, 21, 26",
    mediano: "31, 36, 41",
    pequeno: "51"
  }
};

const STORAGE_KEYS = {
  profile: "pelado_profile_v1",
  config: "pelado_config_v1",
  months: "pelado_periods_v2",
  realPayments: "pelado_period_payments_v2"
};
