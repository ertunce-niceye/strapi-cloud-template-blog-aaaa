module.exports = (plugin) => {
    const middlewareName = 'global::company-isolation';

    console.log("--------------------------------------------------------------------------------");
    console.log("✅ [Extension] Loading Content Manager Extension for Company Isolation");
    console.log("--------------------------------------------------------------------------------");

    const injectMiddleware = (routes) => {
        if (!Array.isArray(routes)) {
            console.warn("⚠️ [Extension] Routes is not an array:", typeof routes);
            return;
        }

        routes.forEach((route) => {
            // Target Collection Types ENDPOINTS
            if (route.path.includes('/collection-types/:model')) {
                if (!route.config) route.config = {};
                if (!route.config.middlewares) route.config.middlewares = [];

                // Avoid duplicates
                if (!route.config.middlewares.includes(middlewareName)) {
                    route.config.middlewares.push(middlewareName);
                    // console.log(`👉 [Injected] Middleware into route: ${route.method} ${route.path}`);
                }
            }
        });
    };

    // Content Manager routes structure can be:
    // plugin.routes = [ ... ] OR plugin.routes.admin = [ ... ]

    if (Array.isArray(plugin.routes)) {
        injectMiddleware(plugin.routes);
    } else {
        // Iterate over keys if it's an object (e.g. 'admin', 'content-api')
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
