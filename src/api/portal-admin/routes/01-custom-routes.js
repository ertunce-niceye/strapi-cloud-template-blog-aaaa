'use strict';
console.log('Loading 01-custom-routes.js');

module.exports = {
    routes: [
        { method: 'GET', path: '/portal-admins/debug-fix', handler: 'portal-admin.debugFix', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/login', handler: 'portal-admin.login', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/auth/login', handler: 'portal-admin.login', config: { auth: false } }, // Alias for frontend consistency
        { method: 'POST', path: '/portal-admins/auth/otp-verify', handler: 'portal-admin.otpVerify', config: { auth: false } }, // New OTP Route
        { method: 'GET', path: '/portal-admins/me', handler: 'portal-admin.me', config: { auth: false } },
        { method: 'PUT', path: '/portal-admins/settings', handler: 'portal-admin.updateSettings', config: { auth: false } },
        { method: 'GET', path: '/portal-admins/dashboard-stats', handler: 'portal-admin.dashboardStats', config: { auth: false } },
        { method: 'GET', path: '/portal-admins/my-webinars', handler: 'portal-admin.myWebinars', config: { auth: false } },
        { method: 'GET', path: '/portal-admins/webinar/:documentId', handler: 'portal-admin.getWebinar', config: { auth: false } },
        { method: 'GET', path: '/portal-admins/webinar/:documentId/registrations', handler: 'portal-admin.getRegistrants', config: { auth: false } }, // New Reg Route
        { method: 'GET', path: '/portal-admins/reports/:slug', handler: 'portal-admin.getReport', config: { auth: false } }, // New Report Route
        { method: 'POST', path: '/portal-admins/webinar/create', handler: 'portal-admin.createWebinar', config: { auth: false } },
        { method: 'PUT', path: '/portal-admins/webinar/:documentId', handler: 'portal-admin.updateWebinar', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/webinar/:documentId/publish', handler: 'portal-admin.publishWebinar', config: { auth: false } }, // existing
        { method: 'POST', path: '/portal-admins/webinar/:documentId/swap-type', handler: 'portal-admin.swapEventType', config: { auth: false } }, // New Swap Route
        { method: 'POST', path: '/portal-admins/webinar/:documentId/unpublish', handler: 'portal-admin.unpublishWebinar', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/webinar/:documentId/retire', handler: 'portal-admin.retireWebinar', config: { auth: false } }, // New Retire Route
        { method: 'DELETE', path: '/portal-admins/webinar/:documentId', handler: 'portal-admin.deleteWebinar', config: { auth: false } }, // New Delete Route
        { method: 'GET', path: '/portal-admins/speakers', handler: 'portal-admin.mySpeakers', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/speakers/create', handler: 'portal-admin.createSpeaker', config: { auth: false } },
        { method: 'PUT', path: '/portal-admins/speakers/:id', handler: 'portal-admin.updateSpeaker', config: { auth: false } },
        { method: 'GET', path: '/portal-admins/ondemand-videos', handler: 'portal-admin.myOnDemandVideos', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/ondemand-videos/create', handler: 'portal-admin.createOnDemandVideo', config: { auth: false } },
        { method: 'PUT', path: '/portal-admins/ondemand-videos/:documentId', handler: 'portal-admin.updateOnDemandVideo', config: { auth: false } }, // Added Update Route
        { method: 'GET', path: '/portal-admins/media-library', handler: 'portal-admin.getMediaLibrary', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/upload', handler: 'portal-admin.upload', config: { auth: false } },

        // Email Templates
        { method: 'GET', path: '/portal-admins/email-templates', handler: 'portal-admin.getEmailTemplates', config: { auth: false } },
        { method: 'POST', path: '/portal-admins/email-templates/create', handler: 'portal-admin.createEmailTemplate', config: { auth: false } },
        { method: 'PUT', path: '/portal-admins/email-templates/:id', handler: 'portal-admin.updateEmailTemplate', config: { auth: false } },
        { method: 'DELETE', path: '/portal-admins/email-templates/:id', handler: 'portal-admin.deleteEmailTemplate', config: { auth: false } }
    ],
};
