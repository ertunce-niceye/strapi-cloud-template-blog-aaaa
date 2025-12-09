'use strict';

/**
 * registration-data service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::registration-data.registration-data');
