module.exports = ({ env }) => ({
    email: {
        config: {
            provider: 'sendgrid',
            providerOptions: {
                apiKey: env('SENDGRID_API_KEY'),
            },
            settings: {
                defaultFrom: env('SENDGRID_DEFAULT_FROM', 'no-reply@webinar-platform.com'),
                defaultReplyTo: env('SENDGRID_DEFAULT_REPLY_TO', 'no-reply@webinar-platform.com'),
            },
        },
    },
    upload: {
        config: {
            provider: 'local',
            sizeLimit: 250 * 1024 * 1024,
            // key 'breakpoints' must be missing or empty to disable responsive completely?
            // Setting it to null might error, let's use empty object or just omit.
            // But if defaults are applied, omitting might keep defaults.
            // Let's try empty object.
            breakpoints: {},
            responsiveDimensions: false,
            sizeOptimization: false,
            autoOrientation: false,
            // providerOptions for local are strictly needed?
            providerOptions: {
                sizeLimit: 250 * 1024 * 1024,
            }
        },
    },
});
