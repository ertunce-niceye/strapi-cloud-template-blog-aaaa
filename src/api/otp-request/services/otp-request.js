'use strict';

/**
 * otp-request service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::otp-request.otp-request');
