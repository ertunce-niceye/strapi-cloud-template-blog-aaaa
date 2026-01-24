'use strict';

/**
 * company controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::company.company', ({ strapi }) => ({
    async create(ctx) {
        // Validate Teams before creating
        const { data } = ctx.request.body;

        if (!data.Teams || (Array.isArray(data.Teams) && data.Teams.length === 0)) {
            return ctx.badRequest('Company must have at least one Team assigned. Users are managed through Teams.');
        }

        // Call the default create method
        const response = await super.create(ctx);
        return response;
    },

    async update(ctx) {
        // Validate Teams before updating (if Teams field is being updated)
        const { data } = ctx.request.body;

        if (data.Teams !== undefined) {
            if (!data.Teams || (Array.isArray(data.Teams) && data.Teams.length === 0)) {
                return ctx.badRequest('Company must have at least one Team assigned. Users are managed through Teams.');
            }
        }

        // Call the default update method
        const response = await super.update(ctx);
        return response;
    },
}));
