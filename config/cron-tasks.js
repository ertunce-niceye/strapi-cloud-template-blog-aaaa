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
    /**
     * Zoom Report Sync Job
     * Runs every 15 minutes
     */
    'zoomReportSync': {
        task: async ({ strapi }) => {
            try {
                strapi.log.info('[ZoomReportSync] Starting sync job...');
                const now = new Date();
                const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

                // Find webinars that started within the last 24 hours (so they might have ended recently)
                // Filter: Start_DateTime >= 24h ago AND Start_DateTime <= Now
                const webinars = await strapi.entityService.findMany('api::webinar.webinar', {
                    filters: {
                        Start_DateTime: {
                            $gte: twentyFourHoursAgo.toISOString(),
                            $lte: now.toISOString(),
                        },
                        // Optimization: Only update if Report_Summary is missing OR last_updated_at is old?
                        // For now, let's just attempt update for recent webinars to ensure data is fresh.
                        // We can add a check inside the loop or filter here if schema allows deep filtering on JSON.
                        // JSON filtering is tricky in Strapi. Better fetch and check in code.
                    },
                    populate: ['Zoom_Setup_Config'],
                });

                strapi.log.info(`[ZoomReportSync] Found ${webinars.length} recent webinars to check.`);

                for (const webinar of webinars) {
                    const zoomId = webinar.Zoom_Setup_Config?.Zoom_Webinar_ID;
                    if (!zoomId) continue;

                    // Check if webinar has effectively ended
                    const start = new Date(webinar.Start_DateTime); // assuming UTC or ISO
                    // Clean duration
                    const rawDuration = String(webinar.EventDuration || '60').replace(/[^0-9]/g, '');
                    const durationMins = parseInt(rawDuration) || 60;
                    const endDateTime = new Date(start.getTime() + durationMins * 60 * 1000);

                    // If it hasn't ended yet, skip
                    if (now < endDateTime) continue;

                    // If it ended more than 30 mins ago (give Zoom time to process report)
                    // adjust logic as needed. User said "start + duration + 1 hour".
                    const collectionTime = new Date(endDateTime.getTime() + 60 * 60 * 1000);

                    if (now >= collectionTime) {
                        // Check if we already have a recent report (e.g. updated in last 1 hour)
                        const lastUpdated = webinar.Report_Summary?.last_updated_at ? new Date(webinar.Report_Summary.last_updated_at) : null;
                        if (lastUpdated && (now.getTime() - lastUpdated.getTime()) < 60 * 60 * 1000) {
                            // Already updated recently, skip to save API calls
                            continue;
                        }

                        strapi.log.info(`[ZoomReportSync] Updating report for: ${webinar.Webinar_Title}`);
                        try {
                            await strapi.service('api::webinar.zoom').updateWebinarReport(webinar.id, zoomId);
                        } catch (err) {
                            strapi.log.error(`[ZoomReportSync] Error updating ${webinar.Webinar_Title}: ${err.message}`);
                        }
                    }
                }
            } catch (err) {
                strapi.log.error('[ZoomReportSync] Job failed', err);
            }
        },
        options: {
            rule: '*/15 * * * *', // Every 15 minutes
        },
    },
};
