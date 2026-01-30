'use strict';

module.exports = {
    routes: [
        { method: 'POST', path: '/portal-admins/login', handler: 'portal-admin.login', config: { auth: false } },
        { method: 'GET', path: '/portal-admins/me', handler: 'portal-admin.me', config: { auth: false } },
        { method: 'GET', path: '/portal-admins/webinars', handler: 'portal-admin.myWebinars', config: { auth: false } },
        { method: 'GET', path: '/portal-admins/webinar/:documentId', handler: 'portal-admin.getWebinar', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/webinar/create', handler: 'portal-admin.createWebinar', config: { auth: false } },
        { method: 'PUT', path: '/portal-admins/webinar/:documentId', handler: 'portal-admin.updateWebinar', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/webinar/:documentId/publish', handler: 'portal-admin.publishWebinar', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/webinar/:documentId/unpublish', handler: 'portal-admin.unpublishWebinar', config: { auth: false } },
        { method: 'GET', path: '/portal-admins/speakers', handler: 'portal-admin.mySpeakers', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/speakers/create', handler: 'portal-admin.createSpeaker', config: { auth: false } },
        { method: 'GET', path: '/portal-admins/ondemand-videos', handler: 'portal-admin.myOnDemandVideos', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/ondemand-videos/create', handler: 'portal-admin.createOnDemandVideo', config: { auth: false } },
        { method: 'PUT', path: '/portal-admins/ondemand-videos/:documentId', handler: 'portal-admin.updateOnDemandVideo', config: { auth: false } }, // Added Update Route
        { method: 'GET', path: '/portal-admins/media-library', handler: 'portal-admin.getMediaLibrary', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/upload', handler: 'portal-admin.upload', config: { auth: false } }
    ],
};
