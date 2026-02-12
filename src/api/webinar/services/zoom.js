'use strict';

const axios = require('axios');
const crypto = require('crypto');

/**
 * zoom service
 */

module.exports = ({ strapi }) => ({
    async getAccessToken() {
        const clientId = process.env.ZOOM_CLIENT_ID;
        const clientSecret = process.env.ZOOM_CLIENT_SECRET;
        const accountId = process.env.ZOOM_ACCOUNT_ID;

        if (!clientId || !clientSecret || !accountId) {
            throw new Error('Zoom API credentials are missing in environment variables.');
        }

        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        try {
            const response = await axios.post(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`, {}, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data.access_token;
        } catch (error) {
            strapi.log.error('Zoom Auth Error:', error.response?.data || error.message);
            throw new Error('Failed to get Zoom access token');
        }
    },

    async checkUserLicense(email) {
        const token = await this.getAccessToken();
        try {
            // Check User Type and Features
            const userRes = await axios.get(`https://api.zoom.us/v2/users/${email}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const user = userRes.data;
            strapi.log.info(`Zoom User Check: ${email} - Type: ${user.type}`);

            // type 1: Basic, 2: Licensed, 99: None
            // Licensed users usually have webinar features if purchased

            // Should verify if they have webinar capability?
            // "feature" object in response usually contains "webinar": true/false

            const settingsRes = await axios.get(`https://api.zoom.us/v2/users/${email}/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            return {
                type: user.type,  // 2 is Licensed
                webinar: settingsRes.data?.feature?.webinar === true
            };

        } catch (err) {
            strapi.log.error(`Zoom User Check Error for ${email}:`, err.response?.data || err.message);
            // Default to allow if check fails, to not block on network glitch, but log it
            return { type: 0, webinar: false };
        }
    },

    async getModeratorZak(email) {
        const token = await this.getAccessToken();
        try {
            const response = await axios.get(`https://api.zoom.us/v2/users/${email}/token?type=zak`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data; // { token: "zak_..." }
        } catch (error) {
            strapi.log.error(`Zoom ZAK Error for ${email}:`, error.response?.data || error.message);
            throw new Error('Failed to get ZAK token');
        }
    },

    async getEventDetails(eventId, isWebinar = true) {
        const token = await this.getAccessToken();
        const endpoint = isWebinar ? `/webinars/${eventId}` : `/meetings/${eventId}`;
        try {
            const response = await axios.get(`https://api.zoom.us/v2${endpoint}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            strapi.log.error(`Zoom Get Details Error for ${eventId}:`, error.response?.data || error.message);
            throw error;
        }
    },

    async createEvent(webinar, options = {}) {
        const token = await this.getAccessToken();
        const { Webinar_Title, EventStartDate, EventStartTime, EventDuration, EventTimeZone, EventType } = webinar;

        const hostEmail = process.env.ZOOM_DEFAULT_HOST_EMAIL || 'ertunc@vistream.com.tr';
        const isWebinar = EventType === 'Webinar';

        // --- LICENSE CHECK START ---
        // Verify if user can create this event type
        const userLicense = await this.checkUserLicense(hostEmail);
        if (isWebinar && !userLicense.webinar) {
            throw new Error(`Host email (${hostEmail}) does not have a Webinar license. Please check Zoom plan.`);
        }
        // --- LICENSE CHECK END ---

        const endpoint = isWebinar ? `/users/${hostEmail}/webinars` : `/users/${hostEmail}/meetings`;

        // Combine Date and Time for Zoom (Format: yyyy-MM-ddTHH:mm:ssZ)
        // Zoom expects ISO 8601, but we use Luxon-like logic if possible, or just string manipulation
        const zoomConfig = webinar.Zoom_Setup_Config || {};
        const moderators = webinar.Moderator_List || [];
        const alternativeHosts = moderators.map(m => m.Email).filter(Boolean).join(',');

        const cleanStartTime = String(EventStartTime || '09:00:00').split('.')[0];
        const formattedStartTime = cleanStartTime.length === 5 ? `${cleanStartTime}:00` : cleanStartTime;
        const startDateTime = `${EventStartDate}T${formattedStartTime}`;

        // Clean duration
        const rawDuration = String(EventDuration || '60').replace(/[^0-9]/g, '');
        const durationInt = Math.min(parseInt(rawDuration) || 60, 1440);
        const commonSettings = {
            host_video: zoomConfig.Host_Video ?? true,
            audio: 'both',
            auto_recording: (zoomConfig.Auto_Cloud_Recording ?? true) ? 'cloud' : 'none',
            approval_type: 2 // No Registration Required
        };

        const settings = isWebinar ? {
            ...commonSettings,
            // alternative_hosts: alternativeHosts, // REMOVED: Support for External Mods (they use ZAK now)
            panelists_video: true, // Always ON for Webinars (Panelists are speakers)
            question_and_answer: { enable: zoomConfig.Question_And_Answer ?? false },
            // Only add practice_session if explicitly enabled in schema config (default false)
            ...(zoomConfig.Practice_Session ? { practice_session: true } : {})
        } : {
            ...commonSettings,
            // alternative_hosts: alternativeHosts, // REMOVED: Support for External Mods (they use ZAK now)
            participant_video: zoomConfig.Participant_Video ?? true,
            mute_upon_entry: zoomConfig.Mute_Upon_Entry ?? true,
            join_before_host: false,
            waiting_room: false
        };

        const data = {
            topic: Webinar_Title,
            type: isWebinar ? 5 : 2, // 5: Webinar, 2: Scheduled Meeting
            start_time: startDateTime,
            duration: durationInt,
            timezone: EventTimeZone || 'Europe/Istanbul',
            ...(zoomConfig.Zoom_Passcode ? { password: zoomConfig.Zoom_Passcode } : {}),
            settings: settings
        };

        strapi.log.info('Zoom Create Payload (Minimal):', JSON.stringify(data, null, 2));

        try {
            const response = await axios.post(`https://api.zoom.us/v2${endpoint}`, data, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });

            return response.data;
        } catch (error) {
            strapi.log.error('Zoom Create Event Error:', error.response?.data || error.message);
            throw error;
        }
    },

    async addPanelists(zoomId, people) {
        if (!people || people.length === 0) return;
        const token = await this.getAccessToken();

        const panelists = people.map(p => ({
            name: p.Full_Name || p.Email?.split('@')[0] || 'Panelist',
            email: p.Email
        })).filter(p => p.email);

        if (panelists.length === 0) return;

        try {
            await axios.post(`https://api.zoom.us/v2/webinars/${zoomId}/panelists`, { panelists }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            strapi.log.error('Zoom Add Panelists Error:', error.response?.data || error.message);
        }
    },

    async updateEvent(webinar) {
        const token = await this.getAccessToken();
        const zoomConfig = webinar.Zoom_Setup_Config || {};
        const zoomId = zoomConfig.Zoom_Webinar_ID;

        if (!zoomId) throw new Error('No Zoom Event ID found to update.');

        const isWebinar = webinar.EventType === 'Webinar';
        const endpoint = isWebinar ? `/webinars/${zoomId}` : `/meetings/${zoomId}`;

        // Prepare update data (similar to createEvent but for PATCH)
        const commonSettings = {
            host_video: zoomConfig.Host_Video ?? true,
            audio: 'both',
            auto_recording: (zoomConfig.Auto_Cloud_Recording ?? true) ? 'cloud' : 'none',
            approval_type: 2 // No Registration Required
        };

        const settings = isWebinar ? {
            ...commonSettings,
            panelists_video: true, // Always ON for Webinars (Panelists are speakers)
            question_and_answer: { enable: zoomConfig.Question_And_Answer ?? false }
        } : {
            ...commonSettings,
            participant_video: zoomConfig.Participant_Video ?? true,
            mute_upon_entry: zoomConfig.Mute_Upon_Entry ?? true,
            join_before_host: false,
            waiting_room: false
        };

        const data = { settings };

        try {
            await axios.patch(`https://api.zoom.us/v2${endpoint}`, data, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            strapi.log.info(`Zoom Event Updated: ${zoomId}`);
            return true;
        } catch (error) {
            strapi.log.error('Zoom Update Event Error:', error.response?.data || error.message);
            throw error;
        }
    },

    async endEvent(zoomId, isWebinar = true) {
        const token = await this.getAccessToken();
        const endpoint = isWebinar ? `/webinars/${zoomId}/status` : `/meetings/${zoomId}/status`;

        try {
            await axios.put(`https://api.zoom.us/v2${endpoint}`,
                { action: 'end' },
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            strapi.log.info(`Zoom Event Ended: ${zoomId}`);
            return true;
        } catch (error) {
            strapi.log.error('Zoom End Event Error:', error.response?.data || error.message);
            throw error;
        }
    },

    async deleteEvent(zoomId, eventType = 'Webinar') {
        if (!zoomId) return;
        const token = await this.getAccessToken();
        const isWebinar = eventType === 'Webinar';
        const endpoint = isWebinar ? `/webinars/${zoomId}` : `/meetings/${zoomId}`;

        try {
            await axios.delete(`https://api.zoom.us/v2${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            strapi.log.info(`Zoom Event Deleted: ${zoomId}`);
        } catch (error) {
            // If it's 404, it's already gone, no problem
            if (error.response?.status !== 404) {
                strapi.log.error('Zoom Delete Event Error:', error.response?.data || error.message);
            }
        }
    },

    getZoomSignature(meetingNumber, role) {
        const iat = Math.round(new Date().getTime() / 1000) - 30;
        const exp = iat + 60 * 60 * 2;

        const oHeader = { alg: 'HS256', typ: 'JWT' };
        const oPayload = {
            sdkKey: process.env.ZOOM_SDK_KEY,
            mn: meetingNumber,
            role: role,
            iat: iat,
            exp: exp,
            appKey: process.env.ZOOM_SDK_KEY,
            tokenExp: exp
        };

        const sHeader = JSON.stringify(oHeader);
        const sPayload = JSON.stringify(oPayload);
        const base64Header = Buffer.from(sHeader).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        const base64Payload = Buffer.from(sPayload).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        const signature = crypto.createHmac('sha256', process.env.ZOOM_SDK_SECRET)
            .update(`${base64Header}.${base64Payload}`)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        return `${base64Header}.${base64Payload}.${signature}`;
    },

    async getEventReports(zoomId, eventType = 'Webinar') {
        const token = await this.getAccessToken();
        const isWebinar = eventType === 'Webinar';
        const resource = isWebinar ? 'webinars' : 'meetings';

        const endpoints = {
            participants: `https://api.zoom.us/v2/report/${resource}/${zoomId}/participants?page_size=300`,
            qa: `https://api.zoom.us/v2/${resource}/${zoomId}/qa`, // Note: Q&A is often under event resource, not report, or vice versa depending on exact need. 
            // Zoom Docs:
            // Webinar Q&A: GET /report/webinars/{webinarId}/qa
            // Meeting Q&A: GET /report/meetings/{meetingId}/qa (if enabled)
            // Correction: Use Report endpoints for past events.
            qa_report: `https://api.zoom.us/v2/report/${resource}/${zoomId}/qa`,
            polls_report: `https://api.zoom.us/v2/report/${resource}/${zoomId}/polls`,
            survey_report: `https://api.zoom.us/v2/report/${resource}/${zoomId}/survey` // Webinar only usually, but some meetings
        };

        // Helper to fetch or return null
        const fetchSafe = async (url, name) => {
            try {
                // strapi.log.debug(`[ZoomService] Fetching ${name}: ${url}`);
                const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` } });
                return res.data;
            } catch (err) {
                // 404 means report not found (e.g. no Q&A happened), which is fine
                if (err.response?.status === 404) return null;
                strapi.log.warn(`[ZoomService] Zoom Report Access Failed (${name}):`, err.response?.data || err.message);
                return null;
            }
        };

        const getParticipants = async () => {
            const metricsUrl = `https://api.zoom.us/v2/metrics/${resource}/${zoomId}/participants?type=past&page_size=300`;
            const reportUrl = `https://api.zoom.us/v2/report/${resource}/${zoomId}/participants?page_size=300`;

            try {
                // Fetch both concurrently
                const [reportRes, metricsRes] = await Promise.all([
                    fetchSafe(reportUrl, 'participants-report'),
                    fetchSafe(metricsUrl, 'participants-metrics')
                ]);

                const reportParticipants = reportRes?.participants || [];
                const metricsParticipants = metricsRes?.participants || [];

                // Create a map of Metrics data for fast lookup by user_id or registrant_id
                const metricsMap = new Map();
                metricsParticipants.forEach(p => {
                    // Use user_id as primary key if available, fallback to combination of name/email maybe?
                    // user_id seems fairly reliable between endpoints for the same meeting instance
                    if (p.user_id) metricsMap.set(p.user_id, p);
                    else if (p.registrant_id) metricsMap.set(p.registrant_id, p);
                    else if (p.name) metricsMap.set(p.name, p); // fallback
                });

                // Merge: Base on Report Data (proven reliable for basic info + email), enrich with Metrics (location/guest info)
                const merged = reportParticipants.map(rp => {
                    const metric = metricsMap.get(rp.user_id) || metricsMap.get(rp.registrant_id) || metricsMap.get(rp.name);

                    return {
                        ...rp,
                        // Priority: Report Email > Metric Email
                        user_email: rp.user_email || metric?.email || rp.email,
                        // Enrich with location from Metrics
                        location: metric?.location || rp.location,
                        country: metric?.location ? undefined : rp.country, // use location if available, else country from report
                        // Infer Is Guest: If 'id' is empty string or undefined, they are likely external/guest. 
                        // Metrics might return 'role'='attendee' which is vague. 
                        // Report 'id' is usually the Zoom User ID.
                        is_guest: !rp.id || rp.id.trim() === '' || metric?.is_guest
                    };
                });

                // Also add any participants found in Metrics but NOT in Report (edge case?)
                // Usually report covers everyone. We stick to merged array based on report.

                strapi.log.info(`[ZoomService] Merged ${merged.length} participants (Report+Metrics).`);

                return { participants: merged };

            } catch (error) {
                strapi.log.warn('[ZoomService] Error merging participant data, falling back to basic Report API.', error.message);
                return await fetchSafe(reportUrl, 'participants');
            }
        };

        const [participantsData, qa, polls, survey, webinarDetails] = await Promise.all([
            getParticipants(),
            fetchSafe(endpoints.qa_report, 'questions'),
            fetchSafe(endpoints.polls_report, 'questions'),
            fetchSafe(endpoints.survey_report, 'questions'),
            fetchSafe(`https://api.zoom.us/v2/report/${resource}/${zoomId}`, 'webinar-details')
        ]);

        return {
            participants: participantsData?.participants || [],
            qa: qa?.questions || [],
            polls: polls?.questions || [],
            survey: survey?.questions || [],
            summary: webinarDetails || {}
        };
    },

    async updateWebinarReport(webinarId, zoomId) {
        if (!zoomId) {
            // webinarId is expected to be documentId in v5 context if passed from controller
            try {
                const webinar = await strapi.documents('api::webinar.webinar').findOne({
                    documentId: webinarId,
                    populate: ['Zoom_Setup_Config']
                });
                zoomId = webinar?.Zoom_Setup_Config?.Zoom_Webinar_ID;
            } catch (e) {
                strapi.log.warn(`[ZoomService] Could not find webinar by documentId: ${webinarId}`);
            }
        }

        if (!zoomId) {
            strapi.log.warn(`[ZoomService] No Zoom ID found for Webinar ${webinarId}, skipping report update.`);
            return;
        }

        try {
            const reports = await this.getEventReports(zoomId, 'Webinar'); // Assuming 'Webinar' type for now, or fetch from webinar entity

            const participants = reports.participants || [];
            const summary = reports.summary || {};

            // Filter: Only count guests (exclude moderators, speakers, panelists)
            const guestParticipants = participants.filter(p => p.is_guest);

            // Calculate Metrics (using guest-only participants)
            const totalDuration = summary.duration || 0;
            const uniqueViewers = new Set(guestParticipants.map(p => p.user_email || p.id || p.name)).size;

            let totalWatchTime = 0;
            guestParticipants.forEach(p => {
                totalWatchTime += (p.duration || 0);
            });

            const avgWatchTime = guestParticipants.length > 0 ? totalWatchTime / guestParticipants.length : 0;
            const avgPercentage = totalDuration > 0 ? (avgWatchTime / totalDuration) * 100 : 0;

            // Location Stats (guests only)
            const locationStats = {};
            guestParticipants.forEach(p => {
                const loc = p.location || p.country || 'Unknown';
                locationStats[loc] = (locationStats[loc] || 0) + 1;
            });

            const reportData = {
                actual_duration: totalDuration,
                total_duration: totalDuration,
                participants_count: summary.participants_count || participants.length,
                unique_viewers: uniqueViewers, // Guest-only unique viewers
                guest_attendees: guestParticipants.length, // Total guest log entries
                total_users: participants.length, // All participants including moderators/speakers
                total_watch_time: totalWatchTime,
                avg_watch_time: Math.round(avgWatchTime * 100) / 100,
                avg_percentage: Math.round(avgPercentage * 100) / 100,
                location_stats: locationStats,
                last_updated_at: new Date().toISOString()
            };

            // Use Document Service for v5 compatibility (using documentId)
            await strapi.documents('api::webinar.webinar').update({
                documentId: webinarId,
                data: {
                    Report_Summary: reportData
                }
            });

            strapi.log.info(`[ZoomService] Updated Report_Summary for Webinar ${webinarId} (Zoom: ${zoomId})`);
            return reportData;

        } catch (error) {
            strapi.log.error(`[ZoomService] Failed to update webinar report for ${webinarId}:`, error.message);
            throw error;
        }
    }
});
