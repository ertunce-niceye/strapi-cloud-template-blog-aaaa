'use strict';

module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/webinars/:id/zoom-integrate',
            handler: 'api::webinar.webinar.createZoomIntegration',
            config: {
                auth: false, // Handled inside controller for simplicity or use policies
            },
        },
        {
            method: 'GET',
            path: '/webinars/:id/zoom-signature',
            handler: 'api::webinar.webinar.getZoomSignature',
            config: {
                auth: false,
            },
        },
        {
            method: 'POST',
            path: '/webinar-sync/:id',
            handler: 'api::webinar.webinar.syncZoomSettings',
            config: {
                auth: false,
            }
        },
        {
            method: 'POST',
            path: '/portal-admins/webinar/:id/dry-run-invite',
            handler: 'api::webinar.webinar.sendDryRunInvite',
            config: {
                auth: false,
            }
        },
        {
            method: 'POST',
            path: '/webinar-reset/:id',
            handler: 'api::webinar.webinar.resetZoomIntegration',
            config: {
                auth: false,
            }
        },
        {
            method: 'GET',
            path: '/webinars/:id/zoom-reports',
            handler: 'api::webinar.webinar.getReports',
            config: {
                auth: false,
            }
        }
    ],
};
