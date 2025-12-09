'use strict';

/**
 * platform-setting service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::platform-setting.platform-setting');
