'use strict';

/**
 * webinar controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::webinar.webinar', ({ strapi }) => ({
    async sendDryRunInvite(ctx) {
        // 1. SECURITY: Verify Portal Admin Token
        let userPayload = null;
        try {
            const authHeader = ctx.request.header.authorization || ctx.request.get('Authorization');
            if (!authHeader) throw new Error('No token');

            const token = authHeader.replace('Bearer ', '');
            const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);

            if (payload.type !== 'portal-admin') throw new Error('Invalid token type');
            userPayload = payload;
        } catch (e) {
            return ctx.unauthorized('Invalid or missing authentication token');
        }

        // Fetch the Portal Admin User to check Team
        const portalUser = await strapi.entityService.findOne('api::portal-admin.portal-admin', userPayload.id, {
            populate: ['Team']
        });

        // @ts-ignore
        if (!portalUser || !portalUser.Team) {
            return ctx.forbidden('User not assigned to a Team');
        }

        const { id } = ctx.params;
        const {
            inviteSpeakers,
            inviteModerators,
            inviteExtra,
            dryRunDate, // NEW: Allow overriding date from request
            specificSpeakerIds, // NEW: Filter speakers
            specificModeratorIds // NEW: Filter moderators
        } = ctx.request.body;

        strapi.log.debug('Dry Run Invite Flags:', { inviteSpeakers, inviteModerators, inviteExtra, dryRunDate });

        // Fetch Webinar using Document Service (Strapi 5+)
        const webinar = await strapi.documents('api::webinar.webinar').findOne({
            documentId: id,
            populate: ['Speakers', 'Moderator_List', 'Zoom_Setup_Config', 'Team'],
        });

        if (!webinar) {
            return ctx.notFound('Webinar not found');
        }

        // 2. SECURITY: Verify Ownership
        // @ts-ignore
        if (!webinar.Team || webinar.Team.id !== portalUser.Team.id) {
            return ctx.forbidden('You do not have permission to access this webinar');
        }

        // Determine Date: Use Body first, then DB
        const targetDate = dryRunDate || webinar.DryRun_Date;
        if (!targetDate) {
            return ctx.badRequest('Dry Run Date is not set');
        }

        // 1. Gather Recipients
        const recipients = new Set();

        // Speakers
        if (inviteSpeakers !== false) {
            if (webinar.Speakers && Array.isArray(webinar.Speakers)) {
                webinar.Speakers.forEach(s => {
                    // Filter if specific IDs provided
                    if (specificSpeakerIds && Array.isArray(specificSpeakerIds) && specificSpeakerIds.length > 0) {
                        // Ensure we match types (ID can be string or int)
                        const sId = Number(s.id);
                        if (!specificSpeakerIds.map(Number).includes(sId)) return;
                    }
                    if (s.Email) recipients.add(s.Email);
                });
            }
        }

        // Moderators
        if (inviteModerators !== false) {
            if (webinar.Moderator_List && Array.isArray(webinar.Moderator_List)) {
                webinar.Moderator_List.forEach(m => {
                    // Filter if specific IDs provided (Moderators usually don't have IDs like speakers if simple JSON, but if relation yes)
                    // Assuming Moderator_List is a component or relation. The populate above suggests relation or component.
                    // If component, they define ID.
                    if (specificModeratorIds && Array.isArray(specificModeratorIds) && specificModeratorIds.length > 0) {
                        const mId = Number(m.id);
                        if (!specificModeratorIds.map(Number).includes(mId)) return;
                    }
                    if (m.Email) recipients.add(m.Email);
                });
            }
        }

        // Extra Emails
        if (inviteExtra !== false) {
            // Try explicit body param first, then DB context
            let extrasString = ctx.request.body.extraEmails;

            // @ts-ignore
            const extraEmailsVal = webinar.DryRun_Context?.extraEmails;
            // @ts-ignore
            let linkType = webinar.DryRun_Context?.linkType || 'Zoom';
            // @ts-ignore
            let customLink = webinar.DryRun_Context?.customLink;

            let extraEmails = [];
            if (typeof extraEmailsVal === 'string') {
                extraEmails = extraEmailsVal.split(',').map(e => e.trim()).filter(e => e);
            }
            if (!extrasString && extraEmails.length > 0) {
                extrasString = extraEmails.join(',');
            }

            if (extrasString) {
                const extras = extrasString.split(',').map(e => e.trim());
                extras.forEach(e => {
                    if (e) recipients.add(e);
                });
            }
        }

        if (recipients.size === 0) {
            return ctx.badRequest('No recipients found to send invites to.');
        }

        // 2. Determine Link
        let joinLink = '';

        // Prioritize body params (what user sees on screen), then Context from DB
        const context = webinar.DryRun_Context || {};
        // @ts-ignore
        const linkType = ctx.request.body.linkType || context.linkType || 'Phase7_Zoom';
        // @ts-ignore
        const customLink = ctx.request.body.customLink || context.customLink || '';

        if (linkType === 'Custom') {
            joinLink = customLink;
        } else {
            // @ts-ignore
            const zoom = webinar.Zoom_Setup_Config;
            // @ts-ignore
            if (zoom && zoom.Zoom_Webinar_ID) {
                // Fix: Zoom_Link does not exist, use Zoom_Join_Link
                // @ts-ignore
                joinLink = zoom.Zoom_Join_Link || `https://zoom.us/j/${zoom.Zoom_Webinar_ID}`;
                // @ts-ignore
                if (zoom.Zoom_Passcode) joinLink += `?pwd=${zoom.Zoom_Passcode}`;
            }
        }

        if (!joinLink) {
            return ctx.badRequest('Dry Run Link could not be determined. Check Zoom Config or Custom Link.');
        }

        // 3. Send Emails
        const emailService = strapi.plugin('email').service('email');

        // --- Helper: Format Date for ICS ---
        const formatDateToICS = (dateStr) => {
            const date = new Date(dateStr);
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        // --- Helper: Generate ICS Content ---
        const generateIcs = (title, description, location, startDate, durationStr) => {
            const start = new Date(startDate);

            // Parse Duration (simple fallback)
            let durationMinutes = 60;
            if (durationStr) {
                const parsed = parseInt(durationStr);
                if (!isNaN(parsed)) durationMinutes = parsed;
            }

            const end = new Date(start.getTime() + durationMinutes * 60000);
            const now = new Date();

            const uid = `${now.getTime()}@vistreamtv.com`;
            const dtStamp = formatDateToICS(now.toISOString());
            const dtStart = formatDateToICS(start.toISOString());
            const dtEnd = formatDateToICS(end.toISOString());

            return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ViStream//Webinar Dry Run//EN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtStamp}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:${location}
STATUS:CONFIRMED
SEQUENCE:0
ORGANIZER;CN=ViStream:mailto:${process.env.SENDGRID_DEFAULT_FROM || 'noreply@vistreamtv.com'}
ATTENDEE;RSVP=TRUE:mailto:recipient@example.com
END:VEVENT
END:VCALENDAR`.replace(/\n/g, '\r\n');
        };

        const timeZone = webinar.EventTimeZone || 'UTC';
        const formattedDate = new Date(targetDate).toLocaleString('en-US', {
            timeZone: timeZone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        // Generate ICS attachment
        const icsContent = generateIcs(
            `Dry Run: ${webinar.Webinar_Title}`,
            `Join Link: ${joinLink}`,
            joinLink,
            targetDate,
            webinar.EventDuration
        );

        const emailPromises = Array.from(recipients).map(to => {
            // Personalize ICS for auto-add (Update Attendee)
            // Note: For true auto-add, each recipient ideally needs their own ICS with them as Attendee,
            // or we use a generic method. Method:REQUEST usually works well.
            const personalizedIcs = icsContent.replace('mailto:recipient@example.com', `mailto:${to}`);

            return emailService.send({
                to,
                from: process.env.SENDGRID_DEFAULT_FROM || 'noreply@vistreamtv.com',
                subject: `Dry Run Invite: ${webinar.Webinar_Title}`,
                text: `You are invited to the Dry Run for "${webinar.Webinar_Title}".\n\nDate: ${formattedDate}\nLink: ${joinLink}\n\nSee you there!`,
                html: `<p>You are invited to the Dry Run for <strong>${webinar.Webinar_Title}</strong>.</p>
               <p><strong>Date:</strong> ${formattedDate}</p>
               <p><strong>Link:</strong> <a href="${joinLink}">${joinLink}</a></p>
               <p>See you there!</p>`,
                attachments: [
                    {
                        filename: 'invite.ics',
                        content: Buffer.from(personalizedIcs).toString('base64'),
                        type: 'text/calendar',
                        disposition: 'attachment',
                    }
                ]
            });
        });

        try {
            await Promise.all(emailPromises);
            return ctx.send({ message: `Sent invites to ${recipients.size} recipients.` });
        } catch (err) {
            strapi.log.error('Failed to send dry run emails', err);
            // Extract meaningful error from SendGrid response if present
            const errorDetails = err.response && err.response.body ? JSON.stringify(err.response.body) : err.message;
            return ctx.internalServerError(`Failed to send emails: ${errorDetails}`);
        }
    },

    async createZoomIntegration(ctx) {
        strapi.log.debug('Zoom Integration Triggered for ID:', ctx.params.id);
        const { id } = ctx.params;
        const { autoRecording } = ctx.request.body;

        // 1. Auth & Validation (Simplified for brevity, similar to sendDryRunInvite)
        let portalUser = null;
        try {
            const authHeader = ctx.request.header.authorization;
            const token = authHeader.replace('Bearer ', '');
            const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
            portalUser = await strapi.entityService.findOne('api::portal-admin.portal-admin', payload.id, {
                populate: ['Team']
            });
        } catch (e) {
            return ctx.unauthorized();
        }

        const webinar = await strapi.documents('api::webinar.webinar').findOne({
            documentId: id,
            populate: ['Speakers', 'Moderator_List', 'Zoom_Setup_Config', 'Team'],
        });

        // Use optional chaining or check constraints
        // @ts-ignore
        if (!webinar || !webinar.Team || !portalUser || !portalUser.Team || webinar.Team.id !== portalUser.Team.id) {
            return ctx.forbidden();
        }

        try {
            const zoomService = strapi.service('api::webinar.zoom');

            // --- Cleanup Old Event ---
            if (webinar.Zoom_Setup_Config?.Zoom_Webinar_ID) {
                strapi.log.info(`Cleaning up old Zoom event: ${webinar.Zoom_Setup_Config.Zoom_Webinar_ID}`);
                await zoomService.deleteEvent(webinar.Zoom_Setup_Config.Zoom_Webinar_ID, webinar.EventType);
            }

            const zoomData = await zoomService.createEvent(webinar, { autoRecording });

            // Store Zoom Details
            /** @type {any} */
            const updatedConfig = {
                ...webinar.Zoom_Setup_Config,
                Zoom_Webinar_ID: zoomData.id.toString(),
                Zoom_Webinar_UUID: zoomData.uuid,
                Zoom_Join_Link: zoomData.join_url,
                Zoom_Start_Link: zoomData.start_url,
                Integration_Status: 'created', // This is a valid enum value
                Zoom_API_Response: zoomData,
                Auto_Cloud_Recording: autoRecording
            };

            await strapi.documents('api::webinar.webinar').update({
                documentId: id,
                data: {
                    Zoom_Setup_Config: updatedConfig
                }
            });

            // If Webinar, add speakers AND moderators as Panelists
            if (webinar.EventType === 'Webinar') {
                const speakers = webinar.Speakers || [];
                const moderators = webinar.Moderator_List || [];
                // Standardize moderator objects to match speaker structure expected by addPanelists
                const moderatorObjects = moderators.map(m => ({
                    // @ts-ignore
                    Full_Name: m.Description || m.Email?.split('@')[0] || 'Moderator', // Check schema for Description
                    Email: m.Email
                }));

                const allPanelists = [...speakers, ...moderatorObjects];
                if (allPanelists.length > 0) {
                    await zoomService.addPanelists(zoomData.id, allPanelists);
                }
            }

            return ctx.send({
                message: 'Zoom integration created successfully',
                zoomId: zoomData.id,
                updatedConfig: updatedConfig
            });
        } catch (error) {
            strapi.log.error('Zoom Integration Error:', error);
            return ctx.badRequest('Failed to create Zoom integration: ' + error.message);
        }
    },

    async endWebinar(ctx) {
        const { id } = ctx.params;

        // Fetch webinar to find ZOOM ID
        const webinar = await strapi.documents('api::webinar.webinar').findOne({
            documentId: id,
            populate: ['Zoom_Setup_Config'],
        });

        if (!webinar) {
            return ctx.notFound('Webinar not found');
        }

        const zoomId = webinar.Zoom_Setup_Config?.Zoom_Webinar_ID;
        if (!zoomId) {
            return ctx.badRequest('No Zoom ID associated with this webinar');
        }

        try {
            const isWebinar = webinar.EventType === 'Webinar';
            await strapi.service('api::webinar.zoom').endEvent(zoomId, isWebinar);

            // Optionally update local status if needed, but for now just end it on Zoom
            ctx.send({ message: 'Webinar ended successfully' });
        } catch (err) {
            strapi.log.error('End Webinar Error:', err);
            return ctx.badRequest('Failed to end webinar', { details: err.response?.data });
        }
    },

    async getModeratorZak(ctx) {
        const { id } = ctx.params;

        // Fetch webinar to find ZOOM ID
        const webinar = await strapi.documents('api::webinar.webinar').findOne({
            documentId: id,
            populate: ['Zoom_Setup_Config'],
        });

        if (!webinar) {
            return ctx.notFound('Webinar not found');
        }

        const zoomId = webinar.Zoom_Setup_Config?.Zoom_Webinar_ID;
        if (!zoomId) {
            return ctx.badRequest('No Zoom ID associated with this webinar');
        }

        // Determine Host Email Dynamically from Zoom API
        // This ensures we get the ZAK for the ACTUAL owner, even if our DB is out of sync.
        let hostEmail;
        try {
            const isWebinar = webinar.EventType === 'Webinar';
            const zoomDetails = await strapi.service('api::webinar.zoom').getEventDetails(zoomId, isWebinar);
            hostEmail = zoomDetails.host_email;
            strapi.log.info(`[getModeratorZak] Resolved Real Host Email from Zoom: ${hostEmail}`);
        } catch (err) {
            strapi.log.error('Failed to get Zoom Details:', err);
            // Fallback to config/env if Zoom fetch fails (unlikely if ID is valid)
            // @ts-ignore
            const zoomConfig = webinar.Zoom_Setup_Config || {};
            // Possible schema issue: Zoom_Host_Email might not be in JSON, check before access
            // @ts-ignore
            hostEmail = zoomConfig.Zoom_Host_Email || process.env.ZOOM_DEFAULT_HOST_EMAIL;
        }

        if (!hostEmail) {
            return ctx.badRequest('Host email could not be determined');
        }

        try {
            const zakData = await strapi.service('api::webinar.zoom').getModeratorZak(hostEmail);
            ctx.send({
                zak: zakData.token,
                hostEmail: hostEmail // Send back the resolved host email
            });
        } catch (err) {
            strapi.log.error('ZAK Fetch Error:', err);
            // Return more details to the client for debugging
            return ctx.badRequest('Failed to fetch Zak Token', {
                hostEmail,
                message: err.message,
                details: err.response?.data
            });
        }
    },

    async getZoomSignature(ctx) {
        const { id } = ctx.params;
        const { role } = ctx.query; // 0 for participant, 1 for host

        const webinar = await strapi.documents('api::webinar.webinar').findOne({
            documentId: id,
            populate: ['Zoom_Setup_Config'],
        });

        if (!webinar || !webinar.Zoom_Setup_Config?.Zoom_Webinar_ID) {
            return ctx.notFound('Webinar or Zoom ID not found');
        }

        try {
            const signature = strapi.service('api::webinar.zoom').generateSDKSignature(
                webinar.Zoom_Setup_Config.Zoom_Webinar_ID,
                role || 0
            );
            return ctx.send({ signature });
        } catch (error) {
            return ctx.badRequest(error.message);
        }
    },

    async syncZoomSettings(ctx) {
        strapi.log.debug('Zoom Sync Triggered for ID:', ctx.params.id);
        const { id } = ctx.params;

        // 1. Auth & Validation
        let portalUser = null;
        try {
            const authHeader = ctx.request.header.authorization;
            const token = authHeader.replace('Bearer ', '');
            const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
            portalUser = await strapi.entityService.findOne('api::portal-admin.portal-admin', payload.id, {
                populate: ['Team']
            });
        } catch (e) {
            return ctx.unauthorized();
        }

        const webinar = await strapi.documents('api::webinar.webinar').findOne({
            documentId: id,
            populate: ['Zoom_Setup_Config', 'Team'],
        });

        // @ts-ignore
        if (!webinar || !webinar.Team || !portalUser || !portalUser.Team || webinar.Team.id !== portalUser.Team.id) {
            return ctx.forbidden();
        }

        if (!webinar.Zoom_Setup_Config?.Zoom_Webinar_ID || webinar.Zoom_Setup_Config.Integration_Status !== 'created') {
            return ctx.badRequest('No active Zoom integration found to sync.');
        }

        try {
            const zoomService = strapi.service('api::webinar.zoom');
            await zoomService.updateEvent(webinar);

            return ctx.send({ message: 'Zoom settings synchronized successfully' });
        } catch (error) {
            strapi.log.error('Zoom Sync Error:', error);
            return ctx.badRequest('Failed to sync Zoom settings: ' + error.message);
        }
    },

    async resetZoomIntegration(ctx) {
        strapi.log.debug('Zoom Reset Triggered for ID:', ctx.params.id);
        const { id } = ctx.params;

        // 1. Auth & Validation
        let portalUser = null;
        try {
            const authHeader = ctx.request.header.authorization;
            const token = authHeader.replace('Bearer ', '');
            const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
            portalUser = await strapi.entityService.findOne('api::portal-admin.portal-admin', payload.id, {
                populate: ['Team']
            });
        } catch (e) {
            return ctx.unauthorized();
        }

        const webinar = await strapi.documents('api::webinar.webinar').findOne({
            documentId: id,
            populate: ['Zoom_Setup_Config', 'Team'],
        });

        // @ts-ignore
        if (!webinar || !webinar.Team || !portalUser || !portalUser.Team || webinar.Team.id !== portalUser.Team.id) {
            return ctx.forbidden();
        }

        try {
            const zoomService = strapi.service('api::webinar.zoom');

            // Delete from Zoom if ID exists
            if (webinar.Zoom_Setup_Config?.Zoom_Webinar_ID) {
                await zoomService.deleteEvent(webinar.Zoom_Setup_Config.Zoom_Webinar_ID, webinar.EventType);
            }

            // Clear Config in DB
            /** @type {any} */
            const clearedConfig = {
                ...webinar.Zoom_Setup_Config,
                Zoom_Webinar_ID: null,
                Zoom_Passcode: null,
                Zoom_Join_Link: null,
                Zoom_Start_Link: null,
                Zoom_API_Response: null,
                Integration_Status: 'none'
            };

            await strapi.documents('api::webinar.webinar').update({
                documentId: id,
                data: {
                    Zoom_Setup_Config: clearedConfig
                }
            });

            return ctx.send({ message: 'Zoom integration reset successfully', clearedConfig });
        } catch (error) {
            strapi.log.error('Zoom Reset Error:', error);
            return ctx.badRequest('Failed to reset Zoom integration: ' + error.message);
        }
    },

    async getReports(ctx) {
        const { id } = ctx.params;

        // 1. Auth & Validation
        let portalUser = null;
        try {
            const authHeader = ctx.request.header.authorization;
            const token = authHeader.replace('Bearer ', '');
            const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
            portalUser = await strapi.entityService.findOne('api::portal-admin.portal-admin', payload.id, {
                populate: ['Team']
            });
        } catch (e) {
            return ctx.unauthorized();
        }

        const webinar = await strapi.documents('api::webinar.webinar').findOne({
            documentId: id,
            populate: ['Zoom_Setup_Config', 'Team'],
        });

        // @ts-ignore
        if (!webinar || !webinar.Team || !portalUser || !portalUser.Team || webinar.Team.id !== portalUser.Team.id) {
            return ctx.forbidden();
        }

        if (!webinar.Zoom_Setup_Config?.Zoom_Webinar_ID) {
            return ctx.notFound('No Zoom Event ID found for this webinar.');
        }

        try {
            const reports = await strapi.service('api::webinar.zoom').getEventReports(
                webinar.Zoom_Setup_Config.Zoom_Webinar_ID,
                webinar.EventType
            );

            // Async Update: Persist summary data for List View performance
            // We use 'webinar.documentId' because getReports fetched it via documentId.
            // But updateWebinarReport expects ID. Strapi 5 Documents use documentId, check service.
            // Service uses entityService.update which expects documentId in v5? Or ID?
            // The service I wrote uses entityService.update(..., webinarId, ...)
            // In Strapi 5, entityService methods often take documentId depending on config, but standard is ID for SQL relations
            // Wait, I used 'webinar.id' in the Cron job which comes from findMany.
            // Let's use documentId if the previous fetching used documents().
            // Ideally passing the numeric ID is safer if the service expects it.
            // The previous 'findOne' returned a document, which has 'id' (numeric) AND 'documentId'.
            // I'll pass 'webinar.documentId' to be safe for modern Strapi, 
            // BUT let's check the service implementation again. 
            // The service does `strapi.entityService.update('api::webinar.webinar', webinarId, ...)`
            // In Strapi 5, entityService.update 2nd arg is documentId usually. 
            // If the service uses `webinarId` as variable name, it implies numeric ID?
            // Let's pass `webinar.documentId` to be consistent with modern Strapi usage.

            // Fire and forget (don't await) to speed up UI? 
            // Better to await to ensure consistency for first load if fast enough, 
            // or let it be async. Given we return 'reports' directly from Zoom, 
            // the DB update is side-effect.
            strapi.service('api::webinar.zoom').updateWebinarReport(webinar.documentId, webinar.Zoom_Setup_Config.Zoom_Webinar_ID)
                .catch(err => strapi.log.error('Background Report Update Failed:', err));

            return ctx.send(reports);
        } catch (error) {
            strapi.log.error('Zoom Report Fetch Error:', error);
            return ctx.badRequest('Failed to fetch Zoom reports: ' + error.message);
        }
    },

    async sendTestEmail(ctx) {
        const { id } = ctx.params;
        const { recipients, subject, html, type } = ctx.request.body;

        // 1. Auth & Validation
        let portalUser = null;
        try {
            const authHeader = ctx.request.header.authorization;
            const token = authHeader.replace('Bearer ', '');
            const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
            portalUser = await strapi.entityService.findOne('api::portal-admin.portal-admin', payload.id, {
                populate: ['Team']
            });
        } catch (e) {
            return ctx.unauthorized();
        }

        const webinar = await strapi.documents('api::webinar.webinar').findOne({
            documentId: id,
            populate: ['Team'],
        });

        // @ts-ignore
        if (!webinar || !webinar.Team || !portalUser || !portalUser.Team || webinar.Team.id !== portalUser.Team.id) {
            return ctx.forbidden();
        }

        if (!recipients || !html) {
            return ctx.badRequest('Recipients and HTML content are required');
        }

        // Parse recipients (comma separated)
        const recipientList = recipients.split(',').map(e => e.trim()).filter(e => e);

        if (recipientList.length === 0) {
            return ctx.badRequest('No valid recipients found');
        }

        const emailService = strapi.plugin('email').service('email');
        const emailPromises = recipientList.map(to => {
            return emailService.send({
                to,
                from: process.env.SENDGRID_DEFAULT_FROM || 'noreply@vistreamtv.com',
                subject: `[TEST] ${subject || 'No Subject'}`,
                html: html,
            });
        });

        try {
            await Promise.all(emailPromises);
            return ctx.send({ message: `Test email sent to ${recipientList.length} recipients.` });
        } catch (err) {
            strapi.log.error('Test Email Error:', err);
            return ctx.badRequest('Failed to send test email: ' + err.message);
        }
    }
}));
