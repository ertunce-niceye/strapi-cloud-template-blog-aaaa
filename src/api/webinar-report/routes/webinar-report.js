'use strict';

module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/webinar-reports/:slug',
            handler: 'webinar-report.getReport',
            config: {
                policies: [],
                middlewares: [],
                auth: false, // We rely on API Token strictness or IP, usually Next.js proxy calls this.
            },
        },
    ],
};
