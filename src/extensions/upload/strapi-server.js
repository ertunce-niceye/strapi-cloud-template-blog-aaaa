module.exports = (plugin) => {
    const middlewareName = 'global::company-isolation';

    console.log("--------------------------------------------------------------------------------");
    console.log("✅ [Extension] Loading Upload Plugin Extension for Company Isolation");
    console.log("--------------------------------------------------------------------------------");

    const injectMiddleware = (routes) => {
        if (!Array.isArray(routes)) return;

        routes.forEach((route) => {
            // ONLY apply middleware to GET /files (listing)
            // DO NOT apply to POST / (upload) - this was causing the upload failures
            // The upload should be allowed, then the file will be associated with Team/Company
            // when it's linked to a Speaker/Webinar entity

            if (route.method === 'GET' && route.path === '/files') {
                if (!route.config) route.config = {};
                if (!route.config.middlewares) route.config.middlewares = [];

                if (!route.config.middlewares.includes(middlewareName)) {
                    route.config.middlewares.push(middlewareName);
                    console.log("✅ [Upload Extension] Applied company-isolation to GET /files");
                }
            }

            // Explicitly log that we're skipping POST /
            if (route.method === 'POST' && route.path === '/') {
                console.log("✅ [Upload Extension] Skipping middleware for POST / (upload endpoint)");
            }
        });
    };

    if (Array.isArray(plugin.routes)) {
        injectMiddleware(plugin.routes);
    } else {
        for (const key in plugin.routes) {
            const routesOrObj = plugin.routes[key];
            if (Array.isArray(routesOrObj)) {
                injectMiddleware(routesOrObj);
            } else if (routesOrObj.routes && Array.isArray(routesOrObj.routes)) {
                injectMiddleware(routesOrObj.routes);
            }
        }
    }

    return plugin;
};
