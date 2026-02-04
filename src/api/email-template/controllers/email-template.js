'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::email-template.email-template', ({ strapi }) => ({
    async find(ctx) {
        // Use default find with company isolation
        return await super.find(ctx);
    },

    async findOne(ctx) {
        return await super.findOne(ctx);
    },

    async create(ctx) {
        return await super.create(ctx);
    },

    async update(ctx) {
        return await super.update(ctx);
    },

    async delete(ctx) {
        return await super.delete(ctx);
    }
}));
