module.exports = {
    routes: [
        {
            method: "PUT",
            path: "/webinars/:id/end",
            handler: "webinar.endWebinar",
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
