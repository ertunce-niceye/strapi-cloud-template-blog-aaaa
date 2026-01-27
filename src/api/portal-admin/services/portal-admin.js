'use strict';

/**
 * portal-admin service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::portal-admin.portal-admin');
