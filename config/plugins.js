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
});
