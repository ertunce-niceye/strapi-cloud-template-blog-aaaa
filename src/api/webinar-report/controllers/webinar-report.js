'use strict';

module.exports = {
    async getReport(ctx) {
        try {
            const { slug } = ctx.params;

            if (!slug) {
                return ctx.badRequest('Slug is required');
            }

            // 1. Find Webinar by Slug to get ID
            const webinars = await strapi.entityService.findMany('api::webinar.webinar', {
                filters: { Slug: slug },
                populate: {
                    createdBy: true,
                },
            });

            if (!webinars || webinars.length === 0) {
                return ctx.notFound('Webinar not found');
            }
            const webinar = webinars[0];

            // 2. Fetch All Videos used in this Webinar to get Metadata (Duration, Speakers)
            // We fetch this separately to build a metadata map.
            const videos = await strapi.entityService.findMany('api::ondemand-video.ondemand-video', {
                filters: { webinar: { id: webinar.id } },
                populate: { Speakers: true }
            });

            // Map Video Metadata
            let totalWebinarDuration = 0;
            const videoMeta = {};
            videos.forEach(v => {
                const dur = v.DurationSeconds || 0;
                totalWebinarDuration += dur;
                videoMeta[v.id] = {
                    duration: dur,
                    // Fix: Use bracket notation to avoid IDE type warnings since 'Speakers' comes from populate
                    speakers: (v['Speakers'] || []).map(s => s.Full_Name).join(", "),
                    title: v.VideoTitle
                };
            });

            // 3. Fetch Logs (This can be large, we might consider pagination if it grows too much)
            const logs = await strapi.entityService.findMany('api::on-demand-video-logs.on-demand-video-logs', {
                filters: {
                    webinar: { id: webinar.id },
                },
                populate: {
                    on_demand_video: {
                        fields: ['id'], // Just get ID, we have meta in videoMeta
                    },
                },
                limit: -1, // Fetch all logs for aggregation
            });

            // 4. Aggregate Data

            // Summary Variables
            let totalSecondsWatched = 0;
            const uniqueViewers = new Set();
            const videoStats = {}; // videoId -> { ...stats }
            const userStats = {};  // identity -> { ...stats }

            // Initialize videoStats from metadata (ensure videos with 0 views appear)
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

            // Process Logs
            logs.forEach(log => {
                const seconds = log.secondsWatched || 0;
                totalSecondsWatched += seconds;

                if (log.identity) {
                    uniqueViewers.add(log.identity);

                    // User Stats Aggregate
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

                // Video Stats Aggregate
                // Use bracket notation to avoid IDE warnings
                const vid = log['on_demand_video'];
                if (vid) {
                    const vId = vid.id;
                    if (videoStats[vId]) {
                        videoStats[vId].totalSeconds += seconds;
                        videoStats[vId].playCount += (log.playCount || 0);

                        if (log.identity) {
                            if (!videoStats[vId].uniqueUsers.has(log.identity)) {
                                videoStats[vId].uniqueUsers.add(log.identity);
                            }
                            if (userStats[log.identity]) {
                                userStats[log.identity].videosWatched.add(videoStats[vId].title);
                            }
                        }
                    }
                }
            });

            // Refined Aggregation for Completion/Percentage (Per User-Video Total)
            // We need logs grouped by (VideoID + Identity) to see total time spent by one user on one video.
            const userVideoTotals = {}; // key: "vid_identity" -> totalSeconds

            logs.forEach(log => {
                if (log['on_demand_video'] && log.identity) {
                    const key = `${log['on_demand_video'].id}_${log.identity}`;
                    userVideoTotals[key] = (userVideoTotals[key] || 0) + (log.secondsWatched || 0);
                }
            });

            // Calculate per-video completion and avg percentage
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

            // Calculate Global Averages for Summary
            const uniqueViewersCount = uniqueViewers.size;
            let avgWatchTime = 0;
            let avgPercentage = 0;

            if (uniqueViewersCount > 0) {
                // Avg Watch Time = Total Seconds Watched / Unique Users
                avgWatchTime = totalSecondsWatched / uniqueViewersCount;

                // Avg Percentage = (Avg Watch Time / Total Content Duration) * 100
                if (totalWebinarDuration > 0) {
                    avgPercentage = (avgWatchTime / totalWebinarDuration) * 100;
                }
            }

            // Format Output
            const summaryData = {
                webinarTitle: webinar.Webinar_Title,
                totalUniqueViewers: uniqueViewersCount,
                totalSecondsWatched,
                totalLogEntries: logs.length,
                // New Global Metrics
                totalVideoDuration: totalWebinarDuration,
                avgWatchTime: Math.round(avgWatchTime),
                avgPercentage: Math.round(avgPercentage)
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

            // Build Detailed User-Video Watch List
            const userVideoWatchesList = [];
            Object.keys(userVideoTotals).forEach(key => {
                const [vIdStr, identity] = key.split('_');
                const vId = parseInt(vIdStr);
                const userTotal = userVideoTotals[key];

                if (videoStats[vId]) {
                    const duration = videoStats[vId].duration;
                    const watchedPercent = duration > 0 ? Math.min(100, (userTotal / duration) * 100) : 0;
                    const completed = watchedPercent >= 90;

                    userVideoWatchesList.push({
                        user: identity,
                        videoTitle: videoStats[vId].title,
                        totalWatchTime: userTotal,
                        watchedPercent: Math.round(watchedPercent * 10) / 10, // 1 decimal
                        completed: completed
                    });
                }
            });

            // Sort by user, then by video title
            userVideoWatchesList.sort((a, b) => {
                if (a.user < b.user) return -1;
                if (a.user > b.user) return 1;
                return a.videoTitle.localeCompare(b.videoTitle);
            });

            return {
                summary: summaryData,
                videos: videosList,
                users: usersList,
                userVideoWatches: userVideoWatchesList
            };

        } catch (err) {
            strapi.log.error('Webinar Report Error:', err);
            return ctx.internalServerError('Failed to generate report');
        }
    }
};
