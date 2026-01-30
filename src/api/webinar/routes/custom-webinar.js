module.exports = {
    routes: [
        {
            method: "POST",
            path: "/webinars/:id/dry-run-invite",
            handler: "webinar.sendDryRunInvite",
            config: {
                auth: false, // Using manual Portal Admin verification in controller
                policies: [],
                middlewares: [],
            },
        },
    ],
};
