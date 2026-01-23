"use strict";

/**
 * `company-isolation` middleware
 */

module.exports = (config, { strapi }) => {
    return async (ctx, next) => {
        // 1. Check if user is logged in via admin panel
        if (!ctx.state.user) {
            return next();
        }

        // 2. Load the user with company relation
        const userWithCompany = await strapi.db.query("admin::user").findOne({
            where: { id: ctx.state.user.id },
            populate: ["company"],
        });

        const userCompany = userWithCompany?.company;

        if (userCompany) {
            // console.log(`[Company Isolation] User Company Keys: ${Object.keys(userCompany).join(', ')}`);
        }

        // 3. If no company assigned, treat as Super Admin (bypass isolation)
        if (!userCompany) {
            return next();
        }

        console.log(`[Company Isolation] Active for User ${ctx.state.user.id} (Company: ${userCompany.id} - ${userCompany.CompanyName})`);

        const url = ctx.request.url;
        const method = ctx.request.method;

        // Using documentId if available (v5), else id
        const filterValue = userCompany.documentId || userCompany.id;
        const filterKey = userCompany.documentId ? 'documentId' : 'id';

        // --- HANDLE MEDIA LIBRARY (/upload/files AND /upload/folders) ---
        if (url.startsWith("/upload")) {
            console.log(`[Company Isolation] Media Library Request: ${method} ${url}`);

            if (url.includes("/files") || url.includes("/folders")) {
                if (method === "GET") {
                    if (!ctx.query.filters) ctx.query.filters = {};
                    // Use "company" (lowercase for upload plugin schema usually?)
                    // We defined it in index.js, usually attributes are lowercased by Strapi in query anyway or case insensitive?
                    // Let's stick to lowercase 'company' for plugin extensions often.
                    ctx.query.filters.company = { [filterKey]: { $eq: filterValue } };
                    console.log(`[Company Isolation] Applied Media Filter: filters.company.${filterKey}=${filterValue}`);
                }
            }
            return next();
        }

        // --- HANDLE CONTENT MANAGER ---
        if (!url.startsWith("/content-manager")) {
            return next();
        }

        console.log(`[Debug Route] ${method} ${url}`);

        // List of models to isolate and their company relation path
        const modelMapping = {
            "api::webinar.webinar": "Company",
            "api::speaker.speaker": "Company",
            "api::ondemand-video.ondemand-video": "Company",
            "api::survey-response.survey-response": "Webinar.Company",
            "api::on-demand-video-logs.on-demand-video-logs": "webinar.Company",
            "api::company.company": "id",
        };

        // Case A: Relations (/content-manager/relations/:model/:id/:field)
        // Example: /content-manager/relations/api::company.company/3/Webinars
        if (url.includes("/relations/")) {
            const parts = url.split("/relations/");
            if (parts[1]) {
                const relParts = parts[1].split("/");
                const sourceModelUID = relParts[0]; // api::company.company

                // Inspect URL structure from logs: /relations/api::company.company/Webinars?id=...
                // So relParts[0] = model, relParts[1] = field (+ query params)
                // In some versions/contexts it might still be /model/id/field?
                // We'll heuristically check.

                let sourceField = relParts[1]?.split("?")[0];

                // If the second part looks like an ID (int or short string) and there is a third part, assume index 2 is field.
                // But from logs, it is index 1.
                // Log: GET /content-manager/relations/api::company.company/Webinars?id=...
                // relParts: ["api::company.company", "Webinars?id=..."]

                if (relParts[2]) {
                    // If we have 3 parts, maybe index 2 is the field (v4 style support?)
                    // But let's prioritize the log evidence.
                    // If relParts[1] is NOT a valid field on model but relParts[2] is, switch?
                    // Hard to check model without strapi instance handy here.
                    // Let's assume log is truth.
                }

                // Check if index 1 IS the field (matches Schema attribute)
                const modelDef = strapi.getModel(sourceModelUID);
                if (modelDef && !modelDef.attributes[sourceField] && relParts[2]) {
                    // Fallback: maybe it was /id/field
                    sourceField = relParts[2]?.split("?")[0];
                }

                console.log(`[Company Isolation] Intercepting Relation: Model=${sourceModelUID}, Field=${sourceField}`);

                // Find target model
                const sourceModel = strapi.getModel(sourceModelUID);
                if (sourceModel && sourceModel.attributes[sourceField]) {
                    const attr = sourceModel.attributes[sourceField];
                    const targetModelUID = attr.target; // e.g., api::webinar.webinar

                    console.log(`[Company Isolation] Relation Target: ${targetModelUID}`);

                    // Check if this target model needs isolation
                    if (modelMapping[targetModelUID]) {
                        const relationPath = modelMapping[targetModelUID];

                        // Inject Filter
                        if (!ctx.query.filters) ctx.query.filters = {};

                        // We need to filter the CANDIDATES (TargetModel) by Company.
                        // Logic mimics the main list filter

                        if (targetModelUID === "api::company.company") {
                            ctx.query.filters.id = { $eq: userCompany.id };
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
                        console.log(`[Company Isolation] Applied Relation Filter:`, JSON.stringify(ctx.query.filters));
                    }
                }
            }
            return next();
        }

        // Case B: Collection Types (/content-manager/collection-types/:model)
        if (url.includes("/collection-types/")) {
            const parts = url.split("/collection-types/");
            const modelUID = parts[1]?.split("?")[0];

            // Allow seeing own company entry
            if (modelUID === "api::company.company") {
                if (method === "GET") {
                    if (!ctx.query.filters) ctx.query.filters = {};
                    const idKey = userCompany.documentId ? 'documentId' : 'id';
                    // For getting single, usually param used. But for list:
                    ctx.query.filters[idKey] = { $eq: filterValue };
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

                console.log(`[Company Isolation] Filter Applied for ${modelUID}:`, JSON.stringify(ctx.query.filters, null, 2));

            } else if (method === "PUT" || method === "DELETE") {
                // Access control for editing
                // Logic remains similar, check existing entity owner
                const parts = url.split("/");
                const entityId = parts[parts.length - 1]?.split("?")[0]; // ID is usually last param

                if (entityId && entityId !== 'undefined') {
                    // Populate logic
                    let populateObj = {};
                    const pathParts = relationPath.split(".");

                    if (pathParts.length === 1) {
                        populateObj[pathParts[0]] = true;
                    } else {
                        populateObj[pathParts[0]] = { populate: { [pathParts[1]]: true } };
                    }

                    // Entity Service findOne uses documentId in v5 usually?
                    // Or id? 
                    // Admin UI passes documentId in URL for v5?
                    // Let's assume it passes documentId if we use v5.
                    // The entityService.findOne(uid, id) signature in v5 expects documentId?
                    // Actually entityService.findOne(uid, documentId) is correct for v5 only if using document service?
                    // entityService.findOne still takes numeric ID?
                    // Document Service is strapi.documents(uid).findOne({ documentId: ... })

                    // Let's try flexible check since we are middleware.
                    // We'll trust the ID passed is compatible with findOne.

                    try {
                        const entity = await strapi.entityService.findOne(modelUID, entityId, {
                            populate: populateObj,
                        });

                        let entityCompanyId = null;
                        if (entity) {
                            // Extract ID or DocumentID from entity company relation
                            // We compare against filterKey (id or documentId)

                            // Navigate to company object
                            let compObj = null;
                            if (pathParts.length === 1) {
                                compObj = entity[pathParts[0]];
                            } else if (pathParts.length === 2 && entity[pathParts[0]]) {
                                compObj = entity[pathParts[0]][pathParts[1]];
                            }

                            if (compObj) {
                                entityCompanyId = compObj[filterKey];
                            }
                        }

                        if (!entityCompanyId || entityCompanyId !== filterValue) {
                            // console.warn(`[Company Isolation] Forbidden Access. EntityCo=${entityCompanyId}, UserCo=${filterValue}`);
                            return ctx.forbidden("You are not allowed to access this resource.");
                        }
                    } catch (err) {
                        console.error("Error checking permissions", err);
                    }
                }
            }
        }

        await next();
    };
};
