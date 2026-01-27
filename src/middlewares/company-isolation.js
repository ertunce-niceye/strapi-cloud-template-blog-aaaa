"use strict";

/**
 * `team-isolation` middleware (formerly company-isolation)
 */

module.exports = (config, { strapi }) => {
    return async (ctx, next) => {
        // DISABLED BY USER REQUEST
        return next();

        // 1. Check if user is logged in via admin panel
        if (!ctx.state.user) {
            return next();
        }

        // 2. Load the user with TEAM relation (and Team's Company)
        const userWithTeam = await strapi.db.query("admin::user").findOne({
            where: { id: ctx.state.user.id },
            populate: {
                team: {
                    populate: ["Company"]
                }
            },
        });

        const userTeam = userWithTeam?.team;

        // 3. If no team assigned, treat as Super Admin (bypass isolation)
        if (!userTeam) {
            return next();
        }

        console.log(`[Team Isolation] Active for User ${ctx.state.user.id} (Team: ${userTeam.id} - ${userTeam.Name})`);

        const url = ctx.request.url;
        const method = ctx.request.method;

        // Using documentId if available (v5), else id
        const filterValue = userTeam.documentId || userTeam.id;
        const filterKey = userTeam.documentId ? 'documentId' : 'id';

        // Also get Company filter values
        const userCompany = userTeam.Company;
        const companyFilterValue = userCompany?.documentId || userCompany?.id;
        const companyFilterKey = userCompany?.documentId ? 'documentId' : 'id';

        // --- HANDLE MEDIA LIBRARY (/upload/files AND /upload/folders) ---
        if (url.startsWith("/upload")) {
            console.log(`[Team Isolation] Media Library Request: ${method} ${url}`);

            // SKIP POST requests entirely - they are file uploads and should not be filtered
            if (method === "POST") {
                console.log(`[Team Isolation] Skipping POST upload request`);
                return next();
            }

            // Only apply filters to GET requests for listing
            if (url.includes("/files") || url.includes("/folders")) {
                if (method === "GET") {
                    if (!ctx.query.filters) ctx.query.filters = {};
                    // Allow seeing files if they belong to Team OR if created by the user
                    ctx.query.filters.$or = [
                        { team: { [filterKey]: { $eq: filterValue } } },
                        { createdBy: { id: { $eq: ctx.state.user.id } } }
                    ];
                    console.log(`[Team Isolation] Applied Media Filter: Team=${filterValue} OR Owner=${ctx.state.user.id}`);
                }
            }
            return next();
        }

        // --- HANDLE CONTENT MANAGER ---
        if (!url.startsWith("/content-manager")) {
            return next();
        }

        // List of models to isolate and their TEAM relation path
        const modelMapping = {
            "api::webinar.webinar": "Team",
            "api::speaker.speaker": "Team",
            "api::ondemand-video.ondemand-video": "Team",
            "api::team.team": "id", // Users can only see their own team
            // Company has special handling below, not in modelMapping
        };

        // Case A: Relations (/content-manager/relations/:model/:field)
        if (url.includes("/relations/")) {
            const parts = url.split("/relations/");
            if (parts[1]) {
                const relParts = parts[1].split("/");
                const sourceModelUID = relParts[0];

                let sourceField = relParts[1]?.split("?")[0];

                // Fallback for older URL format
                const modelDef = strapi.getModel(sourceModelUID);
                if (modelDef && !modelDef.attributes[sourceField] && relParts[2]) {
                    sourceField = relParts[2]?.split("?")[0];
                }

                console.log(`[Team Isolation] Intercepting Relation: Model=${sourceModelUID}, Field=${sourceField}`);

                const sourceModel = strapi.getModel(sourceModelUID);
                if (sourceModel && sourceModel.attributes[sourceField]) {
                    const attr = sourceModel.attributes[sourceField];
                    const targetModelUID = attr.target;

                    console.log(`[Team Isolation] Relation Target: ${targetModelUID}`);

                    if (modelMapping[targetModelUID]) {
                        const relationPath = modelMapping[targetModelUID];

                        if (!ctx.query.filters) ctx.query.filters = {};

                        if (targetModelUID === "api::team.team") {
                            ctx.query.filters.id = { $eq: userTeam.id };
                        } else {
                            const pathParts = relationPath.split(".");
                            let currentFilter = ctx.query.filters;
                            for (let i = 0; i < pathParts.length - 1; i++) {
                                const part = pathParts[i];
                                if (!currentFilter[part]) currentFilter[part] = {};
                                currentFilter = currentFilter[part];
                            }
                            const lastPart = pathParts[pathParts.length - 1];
                            currentFilter[lastPart] = { [filterKey]: { $eq: filterValue } };
                        }
                        console.log(`[Team Isolation] Applied Relation Filter:`, JSON.stringify(ctx.query.filters));
                    }
                }
            }
            return next();
        }

        // Case B: Collection Types (/content-manager/collection-types/:model)
        if (url.includes("/collection-types/")) {
            const parts = url.split("/collection-types/");
            const modelUID = parts[1]?.split("?")[0];

            // Allow seeing own team entry only
            if (modelUID === "api::team.team") {
                if (method === "GET") {
                    if (!ctx.query.filters) ctx.query.filters = {};
                    const idKey = userTeam.documentId ? 'documentId' : 'id';
                    ctx.query.filters[idKey] = { $eq: filterValue };
                }
                return next();
            }

            // Allow seeing only own team's company
            if (modelUID === "api::company.company") {
                if (method === "GET" && userCompany) {
                    if (!ctx.query.filters) ctx.query.filters = {};
                    ctx.query.filters[companyFilterKey] = { $eq: companyFilterValue };
                    console.log(`[Team Isolation] Company Filter Applied: ${companyFilterKey}=${companyFilterValue}`);
                }
                return next();
            }

            if (!modelMapping[modelUID]) {
                return next();
            }

            const relationPath = modelMapping[modelUID];

            if (method === "GET") {
                if (!ctx.query.filters) ctx.query.filters = {};

                const pathParts = relationPath.split(".");
                let currentFilter = ctx.query.filters;
                for (let i = 0; i < pathParts.length - 1; i++) {
                    const part = pathParts[i];
                    if (!currentFilter[part]) currentFilter[part] = {};
                    currentFilter = currentFilter[part];
                }

                const lastPart = pathParts[pathParts.length - 1];
                currentFilter[lastPart] = { [filterKey]: { $eq: filterValue } };

                // CRITICAL: Also filter out records with NULL Company
                // User should only see records where BOTH Team AND Company match
                if (userCompany && companyFilterValue) {
                    ctx.query.filters.Company = {
                        [companyFilterKey]: { $eq: companyFilterValue }
                    };
                }

                console.log(`[Team Isolation] Filter Applied for ${modelUID}:`, JSON.stringify(ctx.query.filters, null, 2));


            } else if (method === "PUT" || method === "DELETE") {
                // Access control for editing/deleting
                const parts = url.split("/");
                const entityId = parts[parts.length - 1]?.split("?")[0];

                if (entityId && entityId !== 'undefined') {
                    const pathParts = relationPath.split(".");
                    let populateObj = {};

                    if (pathParts.length === 1) {
                        populateObj[pathParts[0]] = true;
                    } else {
                        populateObj[pathParts[0]] = { populate: { [pathParts[1]]: true } };
                    }

                    try {
                        const entity = await strapi.entityService.findOne(modelUID, entityId, {
                            populate: populateObj,
                        });

                        let entityTeamId = null;
                        if (entity) {
                            let teamObj = null;
                            if (pathParts.length === 1) {
                                teamObj = entity[pathParts[0]];
                            } else if (pathParts.length === 2 && entity[pathParts[0]]) {
                                teamObj = entity[pathParts[0]][pathParts[1]];
                            }

                            if (teamObj) {
                                entityTeamId = teamObj[filterKey];
                            }
                        }

                        if (!entityTeamId || entityTeamId !== filterValue) {
                            console.warn(`[Team Isolation] Forbidden Access. EntityTeam=${entityTeamId}, UserTeam=${filterValue}`);
                            return ctx.forbidden("You are not allowed to access this resource.");
                        }
                    } catch (err) {
                        console.error("[Team Isolation] Error checking permissions:", err);
                    }
                }
            }
        }

        await next();
    };
};
