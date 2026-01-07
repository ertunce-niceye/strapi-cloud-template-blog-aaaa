"use strict";

const { DateTime } = require("luxon");

/**
 * Normalize helpers
 */
function normalizeDateOnly(v) {
  if (!v) return null;

  // expected: "YYYY-MM-DD"
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // sometimes Strapi may send Date object or ISO
  const dt = DateTime.fromISO(String(v), { zone: "utc" });
  if (!dt.isValid) return null;
  return dt.toFormat("yyyy-LL-dd");
}

function normalizeTimeOnly(v) {
  if (!v) return null;

  // Accept: "HH:mm", "HH:mm:ss", "HH:mm:ss.SSS"
  const s = String(v).trim();

  // If it's a full ISO datetime, reject (we don't want that here)
  if (s.includes("T")) return null;

  // HH:mm
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00.000`;

  // HH:mm:ss
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return `${s}.000`;

  // HH:mm:ss.SSS (1-3 digits)
  if (/^\d{2}:\d{2}:\d{2}\.\d{1,3}$/.test(s)) {
    const [hms, ms] = s.split(".");
    const ms3 = (ms + "000").slice(0, 3);
    return `${hms}.${ms3}`;
  }

  // HH:mm:ss.000 (already)
  if (/^\d{2}:\d{2}:\d{2}\.\d{3}$/.test(s)) return s;

  return null;
}

function computeUtcIso({ dateOnly, timeOnly, timeZone }) {
  // dateOnly: YYYY-MM-DD, timeOnly: HH:mm:ss.SSS
  const isoLocal = `${dateOnly}T${timeOnly}`;

  const dt = DateTime.fromISO(isoLocal, { zone: timeZone });
  if (!dt.isValid) {
    return {
      isoUtc: null,
      reason: dt.invalidExplanation || dt.invalidReason || "invalid",
    };
  }

  return {
    isoUtc: dt.toUTC().toISO({ suppressMilliseconds: false }),
    reason: null,
  };
}

/**
 * Start_DateTime = EventStartDate + EventStartTime + EventTimeZone
 */
function applyComputedStartDateTime(event) {
  const data = event?.params?.data;
  if (!data) return;

  const tz = data.EventTimeZone;
  const dateOnly = normalizeDateOnly(data.EventStartDate);
  const timeOnly = normalizeTimeOnly(data.EventStartTime);

  if (!tz || !dateOnly || !timeOnly) {
    // Don’t overwrite Start_DateTime if inputs are incomplete
    return;
  }

  const { isoUtc, reason } = computeUtcIso({
    dateOnly,
    timeOnly,
    timeZone: tz,
  });

  if (!isoUtc) {
    strapi.log.warn(
      `⚠️ [webinar] Invalid datetime for Start_DateTime: ${dateOnly}T${timeOnly} zone=${tz} (${reason})`
    );
    return;
  }

  data.Start_DateTime = isoUtc;

  strapi.log.info(
    `✅ [webinar] Start_DateTime computed from ${dateOnly} ${timeOnly} (${tz}) -> ${isoUtc}`
  );
}

/**
 * Registration_Closed_Time = RegistrationCloseDate + RegistrationCloseTime + EventTimeZone
 */
function applyComputedRegistrationClosedTime(event) {
  const data = event?.params?.data;
  if (!data) return;

  const tz = data.EventTimeZone;

  // senin eklediğin alanlar:
  const closeDateOnly = normalizeDateOnly(data.RegistrationCloseDate);
  const closeTimeOnly = normalizeTimeOnly(data.RegistrationCloseTime);

  if (!tz || !closeDateOnly || !closeTimeOnly) {
    // Don’t overwrite Registration_Closed_Time if inputs are incomplete
    return;
  }

  const { isoUtc, reason } = computeUtcIso({
    dateOnly: closeDateOnly,
    timeOnly: closeTimeOnly,
    timeZone: tz,
  });

  if (!isoUtc) {
    strapi.log.warn(
      `⚠️ [webinar] Invalid datetime for Registration_Closed_Time: ${closeDateOnly}T${closeTimeOnly} zone=${tz} (${reason})`
    );
    return;
  }

  data.Registration_Closed_Time = isoUtc;

  strapi.log.info(
    `✅ [webinar] Registration_Closed_Time computed from ${closeDateOnly} ${closeTimeOnly} (${tz}) -> ${isoUtc}`
  );
}

module.exports = {
  async beforeCreate(event) {
    strapi.log.info("🔥 [webinar] beforeCreate fired");
    applyComputedStartDateTime(event);
    applyComputedRegistrationClosedTime(event);
  },

  async beforeUpdate(event) {
    strapi.log.info("🔥 [webinar] beforeUpdate fired");
    applyComputedStartDateTime(event);
    applyComputedRegistrationClosedTime(event);
  },
};
