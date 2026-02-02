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

            if (!extrasString && webinar.DryRun_Context && webinar.DryRun_Context.extraEmails) {
                extrasString = webinar.DryRun_Context.extraEmails;
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
        const linkType = ctx.request.body.linkType || context.linkType || 'Phase7_Zoom';
        const customLink = ctx.request.body.customLink || context.customLink || '';

        if (linkType === 'Custom') {
            joinLink = customLink;
        } else {
            const zoom = webinar.Zoom_Setup_Config;
            if (zoom && zoom.Zoom_Webinar_ID) {
                joinLink = zoom.Zoom_Link || `https://zoom.us/j/${zoom.Zoom_Webinar_ID}`;
                if (zoom.Zoom_Passcode) joinLink += `?pwd=${zoom.Zoom_Passcode}`;
            }
        }

        if (!joinLink) {
            return ctx.badRequest('Dry Run Link could not be determined. Check Zoom Config or Custom Link.');
        }

        // 3. Send Emails
        const emailService = strapi.plugin('email').service('email');
        const emailPromises = Array.from(recipients).map(to => {
            return emailService.send({
                to,
                from: process.env.SENDGRID_DEFAULT_FROM || 'noreply@vistreamtv.com',
                subject: `Dry Run Invite: ${webinar.Webinar_Title}`,
                text: `You are invited to the Dry Run for "${webinar.Webinar_Title}".\n\nDate: ${new Date(targetDate).toLocaleString()}\nLink: ${joinLink}\n\nSee you there!`,
                html: `<p>You are invited to the Dry Run for <strong>${webinar.Webinar_Title}</strong>.</p>
               <p><strong>Date:</strong> ${new Date(targetDate).toLocaleString()}</p>
               <p><strong>Link:</strong> <a href="${joinLink}">${joinLink}</a></p>
               <p>See you there!</p>`,
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
}));
