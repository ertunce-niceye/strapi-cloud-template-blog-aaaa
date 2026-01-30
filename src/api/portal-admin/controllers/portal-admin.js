// @ts-nocheck
'use strict';

/**
 * portal-admin controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const utils = require('@strapi/utils');
const bcrypt = require('bcryptjs');
const { ApplicationError, ValidationError } = utils.errors;

module.exports = createCoreController('api::portal-admin.portal-admin', ({ strapi }) => ({
    // Helper for safe auth
    async verifyAuth(ctx) {
        const authHeader = ctx.request.header.authorization || ctx.request.get('Authorization');
        if (!authHeader) return null;
        const token = authHeader.replace('Bearer ', '');
        try {
            const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
            if (payload.type !== 'portal-admin') return null;

            const user = await strapi.entityService.findOne('api::portal-admin.portal-admin', payload.id, {
                populate: ['Team', 'Company']
            });
            return user;
        } catch (e) {
            console.error('Auth verification failed:', e.message);
            return null;
        }
    },

    async login(ctx) {
        const { email, password } = ctx.request.body;

        if (!email || !password) {
            throw new ValidationError('Email and password are required');
        }

        const user = await strapi.db.query('api::portal-admin.portal-admin').findOne({
            where: { Email: email },
            populate: ['Team', 'Company'],
        });

        if (!user) throw new ValidationError('Invalid credentials');

        const validPassword = await bcrypt.compare(password, user.Password);
        if (!validPassword) throw new ValidationError('Invalid credentials');

        const token = strapi.plugin('users-permissions').service('jwt').issue({
            id: user.id,
            type: 'portal-admin',
        });

        const sanitizedUser = await this.sanitizeOutput(user, ctx);

        return { jwt: token, user: sanitizedUser };
    },

    async me(ctx) {
        const user = await this.verifyAuth(ctx);
        if (!user) return ctx.unauthorized('Invalid token');
        return await this.sanitizeOutput(user, ctx);
    },

    async myWebinars(ctx) {
        const user = await this.verifyAuth(ctx);
        if (!user || !user.Team) return [];

        const webinars = await strapi.documents('api::webinar.webinar').findMany({
            filters: { Team: user.Team.id },
            sort: { createdAt: 'desc' },
            populate: ['Team'],
            status: 'draft' // Explicitly fetch drafts to edit
        });

        // Enrich with published status
        const enriched = await Promise.all(webinars.map(async (w) => {
            try {
                const pub = await strapi.documents('api::webinar.webinar').findOne({
                    documentId: w.documentId,
                    fields: ['publishedAt', 'updatedAt'],
                    status: 'published'
                });
                if (pub) {
                    w.publishedAt = pub.publishedAt;
                    // Check Modified
                    if (new Date(w.updatedAt).getTime() > new Date(pub.updatedAt).getTime()) {
                        w.isModified = true;
                    }
                }
            } catch (e) { }
            return w;
        }));

        return enriched;
    },

    async mySpeakers(ctx) {
        const user = await this.verifyAuth(ctx);
        if (!user || !user.Team) return [];

        try {
            const speakers = await strapi.documents('api::speaker.speaker').findMany({
                publicationState: 'preview',
                filters: { Team: user.Team.id },
                populate: '*'
            });
            return speakers;
        } catch (e) {
            return [];
        }
    },

    async hasPendingWebinar(ctx) {
        return { hasPending: false };
    },

    async getWebinar(ctx) {
        const user = await this.verifyAuth(ctx);
        if (!user || !user.Team) return ctx.notFound();

        const { documentId } = ctx.params;

        const webinar = await strapi.documents('api::webinar.webinar').findOne({
            documentId: documentId,
            populate: [
                'Team',
                'Speakers',
                'Related_Webinars',
                'Moderator_List',
                'Evaluation_Survey',
                'Registration_Definition',
                'Landing_Page_Layout',
                'Watching_Page_Layout',
                'OnDemandVideos',
                'Email_Config',
                'Zoom_Setup_Config',
                'Company',
                'Company.CompanyLogo'
            ],
            status: 'draft'
        });

        if (!webinar || !webinar.Team || webinar.Team.id !== user.Team.id) {
            return ctx.forbidden('Access denied');
        }

        // Check for Published version to sync status
        try {
            const published = await strapi.documents('api::webinar.webinar').findOne({
                documentId: documentId,
                fields: ['publishedAt', 'updatedAt'],
                status: 'published'
            });
            if (published) {
                webinar.publishedAt = published.publishedAt; // Sync published status

                // Check if Modified (Draft is newer than Published)
                const draftTime = new Date(webinar.updatedAt).getTime();
                const pubTime = new Date(published.updatedAt).getTime();

                // Allow a small buffer (e.g. 1s) or just strict check
                if (draftTime > pubTime) {
                    webinar.isModified = true;
                }
            }
        } catch (e) {
            // Ignore if error looking up published
        }

        return webinar;
    },

    async createSpeaker(ctx) {
        console.log('[PortalAdmin] CreateSpeaker called');
        const user = await this.verifyAuth(ctx);
        if (!user || !user.Team) {
            console.error('[PortalAdmin] No user/team');
            throw new ApplicationError('No Team assigned');
        }

        const { Full_Name, Email, Title, Affiliation, Photo, Bio } = ctx.request.body;
        console.log('[PortalAdmin] Payload:', { Full_Name, Email, Title, Affiliation, Photo });

        // Construct Bio Blocks if Bio string provided
        let BioBlocks = null;
        if (Bio && Bio.trim().length > 0) {
            BioBlocks = [
                {
                    type: 'paragraph',
                    children: [
                        { type: 'text', text: Bio }
                    ]
                }
            ];
        }

        try {
            const newSpeaker = await strapi.documents('api::speaker.speaker').create({
                data: {
                    Full_Name: Full_Name,
                    Email: Email,
                    Title: Title,
                    Affiliation: Affiliation,
                    Photo: Photo,
                    Bio: BioBlocks, // Pass null if empty, might be safer than []
                    Team: user.Team.id,
                    Company: user.Company ? user.Company.id : null
                },
                status: 'published'
            });
            return newSpeaker;
        } catch (err) {
            console.error('[PortalAdmin] CreateSpeaker DB Error:', err);
            throw new ApplicationError('Database create failed: ' + err.message);
        }
    },

    async createWebinar(ctx) {
        const user = await this.verifyAuth(ctx);
        if (!user || !user.Team) throw new ApplicationError('No Team assigned to user');

        const { data } = ctx.request.body;

        const payload = {
            ...data,
            Certificate_Active: false, // Force default false
            Survey_Active: false,      // Force default false
            Team: user.Team.id,
            Company: user.Company ? user.Company.id : null,
        };

        const newWebinar = await strapi.documents('api::webinar.webinar').create({
            data: payload,
            status: 'draft'
        });

        return { data: newWebinar };
    },

    async updateWebinar(ctx) {
        const user = await this.verifyAuth(ctx);
        if (!user || !user.Team) throw new ApplicationError('No Team assigned');

        const { documentId } = ctx.params;
        const { data } = ctx.request.body;

        const existing = await strapi.documents('api::webinar.webinar').findOne({
            documentId: documentId,
            populate: ['Team'],
            status: 'draft'
        });

        if (!existing) return ctx.notFound();

        if (!existing.Team || existing.Team.id !== user.Team.id) {
            return ctx.forbidden('You do not have permission to edit this webinar');
        }

        const updated = await strapi.documents('api::webinar.webinar').update({
            documentId: documentId,
            data: data,
            status: 'draft',
            populate: ['Speakers', 'Moderator_List', 'Zoom_Setup_Config']
        });

        // Restore publishedAt info if exists
        try {
            const published = await strapi.documents('api::webinar.webinar').findOne({
                documentId: documentId,
                fields: ['publishedAt', 'updatedAt'],
                status: 'published'
            });
            if (published) {
                updated.publishedAt = published.publishedAt;
                // Since we just updated the draft, it IS modified relative to published (conceptually)
                // or we check timestamp:
                updated.isModified = true;
            }
        } catch (e) {
            // ignore
        }

        return { data: updated };
    },

    async publishWebinar(ctx) {
        const user = await this.verifyAuth(ctx);
        if (!user || !user.Team) throw new ApplicationError('No Team assigned');

        const { documentId } = ctx.params;

        const existing = await strapi.documents('api::webinar.webinar').findOne({
            documentId: documentId,
            populate: ['Team'],
            status: 'draft'
        });

        if (!existing) return ctx.notFound();

        if (!existing.Team || existing.Team.id !== user.Team.id) {
            return ctx.forbidden('You do not have permission to publish this webinar');
        }

        try {
            const published = await strapi.documents('api::webinar.webinar').publish({
                documentId: documentId
            });
            // When just published, it is not modified
            return { data: { ...published, isModified: false } };
        } catch (err) {
            console.error('[PortalAdmin] Publish Error:', err);
            throw new ApplicationError('Publish failed: ' + err.message);
        }
    },

    async unpublishWebinar(ctx) {
        const user = await this.verifyAuth(ctx);
        if (!user || !user.Team) throw new ApplicationError('No Team assigned');

        const { documentId } = ctx.params;

        const existing = await strapi.documents('api::webinar.webinar').findOne({
            documentId: documentId,
            populate: ['Team'],
            status: 'published'
        });

        if (!existing) return ctx.notFound();

        if (!existing.Team || existing.Team.id !== user.Team.id) {
            return ctx.forbidden('You do not have permission to unpublish this webinar');
        }

        try {
            const unpublished = await strapi.documents('api::webinar.webinar').unpublish({
                documentId: documentId
            });
            // When unpublished, it's just a draft (publishedAt is null in 'unpublished')
            return { data: { ...unpublished, publishedAt: null, isModified: false } };
        } catch (err) {
            console.error('[PortalAdmin] Unpublish Error:', err);
            throw new ApplicationError('Unpublish failed: ' + err.message);
        }
    },

    async upload(ctx) {
        console.log('[PortalAdmin] Upload called');
        const user = await this.verifyAuth(ctx);
        if (!user) {
            console.error('[PortalAdmin] Upload Unauthorized');
            return ctx.unauthorized();
        }

        // Check files
        const files = ctx.request.files && ctx.request.files.files;
        if (!files) {
            console.error('[PortalAdmin] No files found in request');
            return ctx.badRequest('No files uploaded');
        }

        try {
            console.log('[PortalAdmin] Delegating upload to plugin...');
            // Use Service directly
            const uploadedFiles = await strapi.plugin('upload').service('upload').upload({
                data: {},
                files: files
            });
            console.log('[PortalAdmin] Upload success', uploadedFiles.length);
            return uploadedFiles;
        } catch (e) {
            strapi.log.error('Portal upload failed:', e);
            console.error('[PortalAdmin] Upload Exception:', e);
            throw new ApplicationError('Upload service failed: ' + e.message);
        }
    },

    async myOnDemandVideos(ctx) {
        const user = await this.verifyAuth(ctx);
        if (!user || !user.Team) return [];

        try {
            const videos = await strapi.documents('api::ondemand-video.ondemand-video').findMany({
                publicationState: 'preview',
                filters: { Team: user.Team.id },
                populate: '*'
            });
            return videos;
        } catch (e) {
            return [];
        }
    },

    async createOnDemandVideo(ctx) {
        console.log('[PortalAdmin] CreateOnDemandVideo called');
        const user = await this.verifyAuth(ctx);
        if (!user || !user.Team) {
            console.error('[PortalAdmin] No user/team');
            throw new ApplicationError('No Team assigned');
        }

        const { VideoTitle, Slug, RecordingDate, DurationSeconds, VideoFile, Speakers } = ctx.request.body;
        console.log('[PortalAdmin] Payload:', { VideoTitle, Slug, RecordingDate, DurationSeconds, VideoFile, Speakers });

        try {
            const newVideo = await strapi.documents('api::ondemand-video.ondemand-video').create({
                data: {
                    VideoTitle: VideoTitle,
                    Slug: Slug || VideoTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
                    RecordingDate: RecordingDate || null,
                    DurationSeconds: DurationSeconds || null,
                    VideoFile: VideoFile,
                    Speakers: Speakers,
                    Team: user.Team.id,
                    Company: user.Company ? user.Company.id : null
                },
                status: 'published'
            });
            return newVideo;
        } catch (err) {
            console.error('[PortalAdmin] CreateOnDemandVideo DB Error:', err);
            throw new ApplicationError('Database create failed: ' + err.message);
        }
    },

    async updateOnDemandVideo(ctx) {
        const user = await this.verifyAuth(ctx);
        if (!user || !user.Team) throw new ApplicationError('No Team assigned');

        const { documentId } = ctx.params;
        const { VideoTitle, Slug, RecordingDate, DurationSeconds, VideoFile, Speakers } = ctx.request.body;

        try {
            // Verify ownership
            const existing = await strapi.documents('api::ondemand-video.ondemand-video').findOne({
                documentId: documentId,
                filters: { Team: user.Team.id }
            });

            if (!existing) return ctx.notFound();

            const updatedVideo = await strapi.documents('api::ondemand-video.ondemand-video').update({
                documentId: documentId,
                data: {
                    VideoTitle: VideoTitle,
                    Slug: Slug,
                    RecordingDate: RecordingDate || null,
                    DurationSeconds: DurationSeconds || null,
                    VideoFile: VideoFile,
                    Speakers: Speakers
                },
                status: 'published'
            });
            return updatedVideo;
        } catch (err) {
            console.error('[PortalAdmin] UpdateOnDemandVideo Error:', err);
            throw new ApplicationError('Update failed: ' + err.message);
        }
    },

    async getMediaLibrary(ctx) {
        const user = await this.verifyAuth(ctx);
        if (!user) return ctx.unauthorized();

        const { folder } = ctx.request.query;
        // Parse folder: null string or 'null' should be actual null
        const folderId = (folder && folder !== 'null' && folder !== 'undefined') ? folder : null;

        try {
            // 1. Fetch Folders
            // plugin::upload.folder
            const folders = await strapi.db.query('plugin::upload.folder').findMany({
                where: {
                    parent: folderId ? folderId : null
                },
                orderBy: { name: 'asc' }
            });

            // 2. Fetch Files
            // plugin::upload.file
            const files = await strapi.db.query('plugin::upload.file').findMany({
                where: {
                    folder: folderId ? folderId : null,
                    // Optional: Filter by mime type if needed, but UI does it for now
                },
                orderBy: { createdAt: 'desc' }
            });

            // 3. Get Current Folder Info (for breadcrumbs)
            let currentFolder = null;
            if (folderId) {
                currentFolder = await strapi.db.query('plugin::upload.folder').findOne({
                    where: { id: folderId },
                    populate: ['parent']
                });
            }

            return {
                folders,
                files,
                currentFolder
            };
        } catch (err) {
            console.error('[PortalAdmin] Media Library Error:', err);
            throw new ApplicationError('Failed to fetch media library');
        }
    }
}));
