'use strict';

module.exports = {
  register({ strapi }) {
    // Extend the Upload File (Media Library) content type to link with Company
    strapi.contentType("plugin::upload.file").attributes.company = {
      type: "relation",
      relation: "manyToOne",
      target: "api::company.company",
      private: false,
      configurable: false,
    };

    // Extend the Admin User content type to link with Team
    strapi.contentType("admin::user").attributes.team = {
      type: "relation",
      relation: "manyToOne",
      target: "api::team.team",
      inversedBy: "Users",
      private: false,
      configurable: true,
      visible: true,
    };

    // Extend the Upload File (Media Library) content type to link with Team
    strapi.contentType("plugin::upload.file").attributes.team = {
      type: "relation",
      relation: "manyToOne",
      target: "api::team.team",
      inversedBy: "MediaFiles",
      private: false,
      configurable: false,
    };

    // Extend the Upload Folder to link with Team
    strapi.contentType("plugin::upload.folder").attributes.team = {
      type: "relation",
      relation: "manyToOne",
      target: "api::team.team",
      inversedBy: "MediaFolders",
      private: false,
      configurable: false,
    };

    // Keep Company relation for now if needed for top-level grouping, or we can rely on Team->Company.
    // User requested "Team" based isolation.
    // We already have Company relations defined above (lines 5-29). We can keep them or remove them?
    // "Company" relation on User might still be useful as "Parent Organization".
    // But "Company" relation on File/Folder might be redundant if Team owns it.
    // Let's Keep Company for now to avoid breaking existing data immediately, 
    // BUT the Middleware will focus on Team.

    console.log("✅ [src/index.js] Extended schemas with Team relation (User, File, Folder)");

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

    // Register custom field for template configurator
    // We are only registering it in the frontend (src/admin/app.js) to override the input component.
    // Backend registration is skipped to avoid "plugin not found" errors, as we rely on 'json' type in schema.
  },

  bootstrap({ strapi }) {
    strapi.log.info('bootstrap çalıştı');

    strapi.db.lifecycles.subscribe({
      // Hook into all isolated models
      models: [
        "plugin::upload.file",
        "plugin::upload.folder",
        "api::webinar.webinar",
        "api::speaker.speaker",
        "api::ondemand-video.ondemand-video"
      ],

      async beforeCreate(event) {
        const ctx = strapi.requestContext.get();
        if (!ctx || !ctx.state.user) return;

        // Fetch user with Team AND Company (via Team)
        // Note: Admin User -> Team -> Company
        const userWithTeam = await strapi.db.query("admin::user").findOne({
          where: { id: ctx.state.user.id },
          populate: {
            team: {
              populate: ["Company"]
            }
          },
        });

        const userTeam = userWithTeam?.team;

        if (userTeam) {
          console.log(`[Lifecycle] Auto-assigning ${event.model.singularName} to Team: ${userTeam.Name} (ID: ${userTeam.id})`);

          // Assign Team
          event.params.data.Team = userTeam.id; // Uppercase 'Team' for content types usually? Check schema.
          // For plugin::upload, fields are lowercase usually.
          // For API content types (Webinar, Speaker), fields are configured in schema (usually capitalized locally but lowercased in API?)
          // Strapi DB query uses attribute names as defined in Schema.
          // Our schemas have "Team". plugin::upload has "team".
          // We need to check model UID to decide casing? Or just set both?

          const isPlugin = event.model.uid.startsWith("plugin::");
          if (isPlugin) {
            event.params.data.team = userTeam.id;
            if (userTeam.Company) {
              event.params.data.company = userTeam.Company.id;
            }
          } else {
            event.params.data.Team = userTeam.id; // Schema has "Team"
            // If the model has "Company" field, assign it too
            if (userTeam.Company) {
              // Check if model has Company attribute
              // We can check strapi.getModel(uid).attributes.Company
              if (event.model.attributes.Company) {
                event.params.data.Company = userTeam.Company.id;
              }
            }
          }
        }
      },
    });
  },
};
