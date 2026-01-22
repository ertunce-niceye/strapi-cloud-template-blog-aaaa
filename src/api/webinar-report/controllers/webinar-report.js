'use strict';

module.exports = {
    async getReport(ctx) {
        try {
            const { slug } = ctx.params;

            if (!slug) {
                return ctx.badRequest('Slug is required');
            }

            // 1. Find Webinar by Slug to get ID and Creator info (optional check here, but mainly for ID)
            const webinars = await strapi.entityService.findMany('api::webinar.webinar', {
                filters: { Slug: slug },
                populate: {
                    createdBy: true,
                    // We might need to check creator here if we wanted strict check in Strapi, 
                    // but we are delegating auth to Next.js for now.
                },
            });

            if (!webinars || webinars.length === 0) {
                return ctx.notFound('Webinar not found');
            }
            const webinar = webinars[0];

            // 2. Fetch Logs for this webinar
            // We rely on 'webinar' relation in the log
            // Also need to fetch the VIDEO metadata (Duration, Speakers) - ideally we fetch videos separately or populate deeply.
            // Populating deeply in logs might be heavy if many logs.
            // Better approach: Fetch all OnDemandVideos for this webinar first to get metadata map.

            const videos = await strapi.entityService.findMany('api::ondemand-video.ondemand-video', {
                filters: { webinar: webinar.id },
                populate: { Speakers: true }
            });

            // Map Video Metadata
            const videoMeta = {};
            videos.forEach(v => {
                videoMeta[v.id] = {
                    duration: v.DurationSeconds || 0,
                    speakers: (v.Speakers || []).map(s => s.Name_Surname).join(", "),
                    title: v.VideoTitle
                };
            });

            const logs = await strapi.entityService.findMany('api::on-demand-video-logs.on-demand-video-logs', {
                filters: {
                    webinar: webinar.id,
                },
                populate: {
                    on_demand_video: {
                        fields: ['id'], // Just get ID, we have meta
                    },
                },
                limit: -1, // Fetch all logs for aggregation
            });

            // 3. Aggregate Data

            // Summary
            let totalSecondsWatched = 0;
            const uniqueViewers = new Set();
            const videoStats = {}; // videoId -> { title, views, totalSeconds, uniqueUsers, completions, sumPct }
            const userStats = {};  // identity -> { identity, totalSeconds, videos: Set() }

            // Init videoStats from metadata (so we show videos even with 0 views)
            Object.keys(videoMeta).forEach(vId => {
                videoStats[vId] = {
                    id: parseInt(vId),
                    title: videoMeta[vId].title,
                    duration: videoMeta[vId].duration,
                    speakers: videoMeta[vId].speakers,
                    totalSeconds: 0,
                    playCount: 0,
                    uniqueUsers: new Set(),
                    completions: 0,
                    sumPercentage: 0
                };
            });

            logs.forEach(log => {
                const seconds = log.secondsWatched || 0;
                totalSecondsWatched += seconds;

                if (log.identity) {
                    uniqueViewers.add(log.identity);

                    // User Stats
                    if (!userStats[log.identity]) {
                        userStats[log.identity] = {
                            identity: log.identity,
                            totalSeconds: 0,
                            lastEventAt: log.lastEventAt,
                            videosWatched: new Set()
                        };
                    }
                    userStats[log.identity].totalSeconds += seconds;
                    if (log.lastEventAt > userStats[log.identity].lastEventAt) {
                        userStats[log.identity].lastEventAt = log.lastEventAt;
                    }
                }

                // Video Stats
                const vid = log.on_demand_video;
                if (vid) {
                    const vId = vid.id;
                    if (videoStats[vId]) {
                        videoStats[vId].totalSeconds += seconds;
                        videoStats[vId].playCount += (log.playCount || 0);

                        if (log.identity) {
                            if (!videoStats[vId].uniqueUsers.has(log.identity)) {
                                videoStats[vId].uniqueUsers.add(log.identity);

                                // Calculate stats PER USER for completion/percentage
                                // Note: 'log' is per-session usually? Or per user-video aggregate?
                                // If logs are fragmented (multiple logs per user per video), we need to aggregate FIRST by user-video.
                                // Assuming 'log' here is one entry per user per video (unique constraints? or multiple?)
                                // If multiple, this logic is flawed. 
                                // Let's assume log entries are per session. We need to aggregate user-video totals first to determine completion.
                            }
                            if (userStats[log.identity]) {
                                userStats[log.identity].videosWatched.add(videoStats[vId].title);
                            }
                        }
                    }
                }
            });

            // Refined Aggregation for Completion/Percentage
            // We need to group logs by (VideoID + Identity) to get TOTAL watched by that user on that video
            const userVideoTotals = {}; // key: "vid_identity" -> totalSeconds

            logs.forEach(log => {
                if (log.on_demand_video && log.identity) {
                    const key = `${log.on_demand_video.id}_${log.identity}`;
                    userVideoTotals[key] = (userVideoTotals[key] || 0) + (log.secondsWatched || 0);
                }
            });

            // Now calculate completion & avg percentage based on userVideoTotals
            Object.keys(userVideoTotals).forEach(key => {
                const [vIdStr, identity] = key.split('_');
                const vId = parseInt(vIdStr);
                const userTotal = userVideoTotals[key];

                if (videoStats[vId] && videoStats[vId].duration > 0) {
                    const duration = videoStats[vId].duration;
                    const pct = Math.min(100, (userTotal / duration) * 100);

                    videoStats[vId].sumPercentage += pct;

                    // Completion threshold: 90%
                    if (pct >= 90) {
                        videoStats[vId].completions++;
                    }
                }
            });

            // Format Output
            const summaryData = {
                webinarTitle: webinar.Webinar_Title,
                totalUniqueViewers: uniqueViewers.size,
                totalSecondsWatched,
                totalLogEntries: logs.length
            };

            const videosList = Object.values(videoStats).map(v => ({
                id: v.id,
                title: v.title,
                speakers: v.speakers,
                duration: v.duration,
                totalSeconds: v.totalSeconds,
                playCount: v.playCount,
                uniqueViewers: v.uniqueUsers.size,
                completionCount: v.completions,
                avgPercentage: v.uniqueUsers.size > 0 ? Math.round(v.sumPercentage / v.uniqueUsers.size) : 0
            })).sort((a, b) => b.uniqueViewers - a.uniqueViewers);

            const usersList = Object.values(userStats).map(u => ({
                identity: u.identity,
                totalSeconds: u.totalSeconds,
                lastAccess: u.lastEventAt,
                videosCallback: Array.from(u.videosWatched)
            })).sort((a, b) => b.totalSeconds - a.totalSeconds);

            return {
                summary: summaryData,
                videos: videosList,
                users: usersList
            };

        } catch (err) {
            strapi.log.error('Webinar Report Error:', err);
            return ctx.internalServerError('Failed to generate report');
        }
    }
};
