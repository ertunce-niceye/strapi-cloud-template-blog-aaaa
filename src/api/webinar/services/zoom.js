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
            panelists_video: true, // Always ON for Webinars (Panelists are speakers)
            question_and_answer: { enable: zoomConfig.Question_And_Answer ?? false },
            // Only add practice_session if explicitly enabled in schema config (default false)
            ...(zoomConfig.Practice_Session ? { practice_session: true } : {})
        } : {
            ...commonSettings,
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

    generateSDKSignature(meetingNumber, role) {
        const sdkKey = process.env.NEXT_PUBLIC_ZOOM_MEETING_SDK_KEY;
        const sdkSecret = process.env.ZOOM_MEETING_SDK_SECRET;

        if (!sdkKey || !sdkSecret) {
            throw new Error('Zoom SDK credentials are missing.');
        }

        const iat = Math.round(new Date().getTime() / 1000) - 30;
        const exp = iat + 60 * 60 * 2;

        const oHeader = { alg: 'HS256', typ: 'JWT' };

        const oPayload = {
            sdkKey: sdkKey,
            mn: meetingNumber,
            role: role, // 0 for participant, 1 for host
            iat: iat,
            exp: exp,
            appKey: sdkKey,
            tokenExp: iat + 60 * 60 * 2
        };

        const sHeader = JSON.stringify(oHeader);
        const sPayload = JSON.stringify(oPayload);

        const base64Header = Buffer.from(sHeader).toString('base64url');
        const base64Payload = Buffer.from(sPayload).toString('base64url');

        const signature = crypto
            .createHmac('sha256', sdkSecret)
            .update(`${base64Header}.${base64Payload}`)
            .digest('base64url');

        return `${base64Header}.${base64Payload}.${signature}`;
    }
});
