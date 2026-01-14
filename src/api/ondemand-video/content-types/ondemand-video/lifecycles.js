"use strict";

function normalizeDurationSeconds(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

module.exports = {
  beforeCreate(event) {
    const data = event.params?.data || {};
    if (data.DurationSeconds == null) return;

    const normalized = normalizeDurationSeconds(data.DurationSeconds);
    if (normalized == null) delete data.DurationSeconds;
    else data.DurationSeconds = normalized;
  },

  beforeUpdate(event) {
    const data = event.params?.data || {};
    if (data.DurationSeconds == null) return;

    const normalized = normalizeDurationSeconds(data.DurationSeconds);
    if (normalized == null) delete data.DurationSeconds;
    else data.DurationSeconds = normalized;
  },
};
