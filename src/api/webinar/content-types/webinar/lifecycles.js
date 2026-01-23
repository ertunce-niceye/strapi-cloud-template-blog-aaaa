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


function normalizeEmail(e) {
  return String(e || "").trim().toLowerCase();
}

async function syncModerators(result, strapi) {
  try {
    strapi.log.info(`[ModeratorSync] Starting sync for documentId: ${result?.documentId}`);

    // Strapi v5: requires documentId
    if (!result || !result.documentId) {
      strapi.log.warn("[ModeratorSync] No documentId found in result");
      return;
    }

    // 1. Fetch full webinar with Moderator List
    const webinar = await strapi.documents('api::webinar.webinar').findOne({
      documentId: result.documentId,
      populate: ['Moderator_List']
    });

    if (!webinar) {
      strapi.log.warn(`[ModeratorSync] Webinar not found for documentId: ${result.documentId}`);
      return;
    }

    const moderators = webinar.Moderator_List || [];
    const modEmails = new Set(
      moderators.map(m => normalizeEmail(m.Email)).filter(e => e.length > 0)
    );

    strapi.log.info(`[ModeratorSync] Found ${modEmails.size} moderators.`);

    // 2. Fetch registrations linked to this webinar
    const registrations = await strapi.documents('api::registration-data.registration-data').findMany({
      filters: {
        Webinar: {
          documentId: result.documentId
        }
      }
    });

    strapi.log.info(`[ModeratorSync] checking ${registrations.length} registrations`);

    // 3. Update status
    for (const reg of registrations) {
      if (!reg.Email_Address) continue;

      const email = normalizeEmail(reg.Email_Address);
      const shouldBeModerator = modEmails.has(email);
      const currentStatus = Boolean(reg.Is_Moderator);

      if (shouldBeModerator !== currentStatus) {
        strapi.log.info(`[ModeratorSync] Updating ${email}: ${currentStatus} -> ${shouldBeModerator}`);

        await strapi.documents('api::registration-data.registration-data').update({
          documentId: reg.documentId,
          data: { Is_Moderator: shouldBeModerator },
          status: 'published'
        });
      }
    }
  } catch (err) {
    strapi.log.error(`[ModeratorSync] Sync failed: ${err.message}`);
    strapi.log.error(err.stack); // Print stack trace
  }
}

// Safe implementation: Updates the record AFTER creation
async function addCreatorToModerators(result, strapi) {
  try {
    if (!result || !result.documentId) return;

    // In Strapi v5, createdBy might not be populated in result by default
    const webinar = await strapi.documents('api::webinar.webinar').findOne({
      documentId: result.documentId,
      populate: ['Moderator_List', 'createdBy']
    });

    if (!webinar || !webinar.createdBy) return;

    const adminUser = webinar.createdBy;
    if (!adminUser.email) return;

    const email = normalizeEmail(adminUser.email);
    const moderators = webinar.Moderator_List || [];

    // Check if already in list
    const exists = moderators.some(m => m && normalizeEmail(m.Email) === email);

    if (!exists) {
      strapi.log.info(`[webinar] Auto-adding creator ${email} to Moderator_List (afterCreate)`);

      const newList = [...moderators, { Email: email }];

      await strapi.documents('api::webinar.webinar').update({
        documentId: webinar.documentId,
        data: {
          Moderator_List: newList
        },
        status: 'draft' // Maintain draft status if it was just created as draft
      });
    }
  } catch (err) {
    strapi.log.error(`[webinar] Failed to auto-add creator (afterCreate): ${err.message}`);
  }
}

module.exports = {
  async beforeCreate(event) {
    try {
      strapi.log.info("🔥 [webinar] beforeCreate fired");
      applyComputedStartDateTime(event);
      applyComputedRegistrationClosedTime(event);
    } catch (err) {
      strapi.log.error(`[webinar] beforeCreate failed: ${err.message}`);
      strapi.log.error(err.stack);
    }
  },

  async afterCreate(event) {
    // Run this logic after creation is successful
    await addCreatorToModerators(event.result, strapi);
  },

  async beforeUpdate(event) {
    try {
      strapi.log.info("🔥 [webinar] beforeUpdate fired");
      applyComputedStartDateTime(event);
      applyComputedRegistrationClosedTime(event);
    } catch (err) {
      strapi.log.error(`[webinar] beforeUpdate failed: ${err.message}`);
      strapi.log.error(err.stack);
    }
  },

  async afterUpdate(event) {
    // syncModerators already has its own try/catch
    await syncModerators(event.result, strapi);
  },
};
