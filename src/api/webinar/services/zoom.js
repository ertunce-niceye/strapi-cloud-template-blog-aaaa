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

    async createEvent(webinar, options = {}) {
        const token = await this.getAccessToken();
        const { Webinar_Title, EventStartDate, EventStartTime, EventDuration, EventTimeZone, EventType } = webinar;

        const hostEmail = process.env.ZOOM_DEFAULT_HOST_EMAIL || 'ertunc@vistream.com.tr';
        const isWebinar = EventType === 'Webinar';
        const endpoint = isWebinar ? `/users/${hostEmail}/webinars` : `/users/${hostEmail}/meetings`;

        // Combine Date and Time for Zoom (Format: yyyy-MM-ddTHH:mm:ssZ)
        // Zoom expects ISO 8601, but we use Luxon-like logic if possible, or just string manipulation
        const startDateTime = `${EventStartDate}T${EventStartTime}`;

        const data = {
            topic: Webinar_Title,
            type: 2, // Scheduled
            start_time: startDateTime,
            duration: parseInt(EventDuration) || 60,
            timezone: EventTimeZone || 'Europe/Istanbul',
            password: Zoom_Setup_Config.Zoom_Passcode || '',
            settings: {
                host_video: Zoom_Setup_Config.Host_Video ?? true,
                panelists_video: Zoom_Setup_Config.Participant_Video ?? true,
                participant_video: Zoom_Setup_Config.Participant_Video ?? true,
                mute_upon_entry: Zoom_Setup_Config.Mute_Upon_Entry ?? true,
                watermark: false,
                use_pmi: false,
                approval_type: 0, // Automatically Approve
                registration_type: 1,
                audio: 'both',
                auto_recording: options.autoRecording ? 'cloud' : 'none',
                enforce_login: false,
                email_registrants: false,
                email_panelists: false,
            }
        };

        try {
            const response = await axios.post(`https://api.zoom.us/v2${endpoint}`, data, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            strapi.log.error('Zoom Create Event Error:', error.response?.data || error.message);
            throw error;
        }
    },

    async addPanelists(zoomId, speakers) {
        const token = await this.getAccessToken();

        const panelists = speakers.map(s => ({
            name: s.Full_Name,
            email: s.Email
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
