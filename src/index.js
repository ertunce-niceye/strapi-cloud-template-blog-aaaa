'use strict';

module.exports = {
  register({ strapi }) {
    // Extend the Admin User content type to link with Company
    strapi.contentType("admin::user").attributes.company = {
      type: "relation",
      relation: "manyToOne",
      target: "api::company.company",
      inversedBy: "AdminUsers",
      private: false,
      configurable: false,
    };

    // Extend the Upload File (Media Library) content type to link with Company
    strapi.contentType("plugin::upload.file").attributes.company = {
      type: "relation",
      relation: "manyToOne",
      target: "api::company.company",
      private: false,
      configurable: false,
    };

    // Extend the Upload Folder to link with Company
    strapi.contentType("plugin::upload.folder").attributes.company = {
      type: "relation",
      relation: "manyToOne",
      target: "api::company.company",
      private: false,
      configurable: false,
    };

    console.log("✅ [src/index.js] Extended schemas with Company relation (User, File, Folder)");

    // --- INJECT MIDDLEWARE INTO PLUGINS ---
    const middlewareName = 'global::company-isolation';

    // Helper to inject
    const injectIntoRoutes = (pluginName, routeCheck) => {
      const plugin = strapi.plugin(pluginName);
      if (plugin) {
        const routes = plugin.routes;
        let count = 0;

        const processList = (list) => {
          if (!Array.isArray(list)) return;
          list.forEach(route => {
            if (routeCheck(route)) {
              if (!route.config) route.config = {};
              if (!route.config.middlewares) route.config.middlewares = [];
              if (!route.config.middlewares.includes(middlewareName)) {
                route.config.middlewares.push(middlewareName);
                count++;
              }
            }
          });
        };

        if (Array.isArray(routes)) {
          processList(routes);
        } else {
          for (const key in routes) {
            const val = routes[key];
            if (Array.isArray(val)) processList(val);
            else if (val.routes) processList(val.routes);
          }
        }
        console.log(`✅ [src/index.js] Injected ${middlewareName} into ${count} routes of ${pluginName}`);
      } else {
        console.warn(`⚠️ [src/index.js] Plugin ${pluginName} not found during register`);
      }
    };

    // 1. Content Manager (Collection Types AND Relations)
    injectIntoRoutes('content-manager', (route) => {
      return route.path.includes('/collection-types/:model') || route.path.includes('/relations/:model');
    });

    // 2. Upload (Media Library)
    injectIntoRoutes('upload', (route) => {
      // Target /files, /folders (GET) specifically
      return route.path === '/files' || route.path === '/folders' || route.path === '/';
    });
  },

  bootstrap({ strapi }) {
    console.log("✅ [src/index.js] bootstrap çalıştı");

    strapi.db.lifecycles.subscribe({
      // Hook into both Files and Folders
      models: ["plugin::upload.file", "plugin::upload.folder"],

      async beforeCreate(event) {
        const ctx = strapi.requestContext.get();
        if (!ctx || !ctx.state.user) return;

        // Fetch user with company
        const userWithCompany = await strapi.db.query("admin::user").findOne({
          where: { id: ctx.state.user.id },
          populate: ["company"],
        });

        const userCompany = userWithCompany?.company;

        if (userCompany) {
          console.log(`[Lifecycle] Auto-assigning ${event.model.singularName} to Company: ${userCompany.CompanyName} (ID: ${userCompany.id})`);
          event.params.data.company = userCompany.id;
        }
      },
    });
  },
};
