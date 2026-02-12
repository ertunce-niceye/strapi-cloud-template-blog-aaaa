module.exports = {
    routes: [
        {
            method: "GET",
            path: "/webinars/:id/moderator-zak",
            handler: "api::webinar.webinar.getModeratorZak",
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
