module.exports = (plugin) => {
    const middlewareName = 'global::company-isolation';

    console.log("--------------------------------------------------------------------------------");
    console.log("✅ [Extension] Loading Upload Plugin Extension for Company Isolation");
    console.log("--------------------------------------------------------------------------------");

    const injectMiddleware = (routes) => {
        if (!Array.isArray(routes)) return;

        routes.forEach((route) => {
            // Target /upload/files (and maybe /upload itself if used strictly for files)
            // The main listing is GET /files
            // The upload is POST /
            // Need to check exact paths used by Media Library.
            // Usually GET /files, POST /, DELETE /files/:id

            // Let's target broadly but carefully
            if (route.path === '/files' || route.path === '/') {
                // Note: Upload plugin routes are usually prefixed by /upload in strict config but here paths are relative
                // Strapi prefixes them. 
                // GET /files is standard for listing.

                if (!route.config) route.config = {};
                if (!route.config.middlewares) route.config.middlewares = [];

                if (!route.config.middlewares.includes(middlewareName)) {
                    route.config.middlewares.push(middlewareName);
                }
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
