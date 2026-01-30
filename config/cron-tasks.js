module.exports = {
    /**
     * Dry Run Reminder Job
     * Runs every day at 8:00 AM
     */
    'dryRunReminder': {
        task: async ({ strapi }) => {
            try {
                const today = new Date();
                const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
                const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

                // Find webinars with Dry Run scheduled for today
                const webinars = await strapi.entityService.findMany('api::webinar.webinar', {
                    filters: {
                        DryRun_Date: {
                            $gte: startOfDay,
                            $lte: endOfDay,
                        },
                        DryRun_Available: true,
                    },
                    populate: ['Speakers', 'Moderator_List', 'Zoom_Setup_Config'],
                });

                strapi.log.info(`[DryRunReminder] Found ${webinars.length} webinars for today.`);

                for (const webinar of webinars) {
                    // Logic is similar to Invite
                    // Check Context for specific invite rules
                    const context = webinar.DryRun_Context || { inviteSpeakers: true, inviteModerators: true, inviteExtra: false, extraEmails: '' };

                    // 2. Gather Recipients
                    const recipients = new Set();

                    // Speakers
                    if (context.inviteSpeakers !== false) {
                        if (webinar.Speakers && Array.isArray(webinar.Speakers)) {
                            webinar.Speakers.forEach(s => {
                                if (s.Email) recipients.add(s.Email);
                            });
                        }
                    }

                    // Moderators
                    if (context.inviteModerators !== false) {
                        if (webinar.Moderator_List && Array.isArray(webinar.Moderator_List)) {
                            webinar.Moderator_List.forEach(m => {
                                if (m.Email) recipients.add(m.Email);
                            });
                        }
                    }

                    // Extra Emails
                    if (context.inviteExtra === true && context.extraEmails) {
                        const extras = context.extraEmails.split(',').map(e => e.trim());
                        extras.forEach(e => {
                            if (e) recipients.add(e);
                        });
                    }

                    if (recipients.size === 0) continue;

                    // 2. Determine Link
                    let joinLink = '';
                    const linkType = context.linkType || 'Phase7_Zoom';
                    const customLink = context.customLink || '';

                    if (linkType === 'Custom') {
                        joinLink = customLink;
                    } else {
                        const zoom = webinar.Zoom_Setup_Config;
                        if (zoom && zoom.Zoom_Webinar_ID) {
                            joinLink = zoom.Zoom_Link || `https://zoom.us/j/${zoom.Zoom_Webinar_ID}`;
                            if (zoom.Zoom_Passcode) joinLink += `?pwd=${zoom.Zoom_Passcode}`;
                        }
                    }

                    if (!joinLink) continue;

                    // 3. Send Emails
                    const emailService = strapi.plugin('email').service('email');
                    for (const to of recipients) {
                        try {
                            await emailService.send({
                                to,
                                from: process.env.SENDGRID_DEFAULT_FROM || 'noreply@vistreamtv.com',
                                subject: `Reminder: Dry Run Today for ${webinar.Webinar_Title}`,
                                text: `Reminder: The Dry Run for "${webinar.Webinar_Title}" is happening today.\n\nTime: ${new Date(webinar.DryRun_Date).toLocaleTimeString()}\nLink: ${joinLink}`,
                                html: `<p>Reminder: The Dry Run for <strong>${webinar.Webinar_Title}</strong> is happening today.</p>
                       <p><strong>Time:</strong> ${new Date(webinar.DryRun_Date).toLocaleTimeString()}</p>
                       <p><strong>Link:</strong> <a href="${joinLink}">${joinLink}</a></p>`,
                            });
                        } catch (err) {
                            strapi.log.error(`[DryRunReminder] Failed to send to ${to}`, err);
                        }
                    }
                }
            } catch (err) {
                strapi.log.error('[DryRunReminder] Job failed', err);
            }
        },
        options: {
            rule: '0 8 * * *', // Daily at 8 AM
        },
    },
};
