module.exports = {
    async beforeCreate(event) {
        const { data } = event.params;

        // Validate that at least one Team is assigned
        if (!data.Teams || (Array.isArray(data.Teams) && data.Teams.length === 0)) {
            throw new Error('Company must have at least one Team assigned. Users are managed through Teams.');
        }
    },

    async beforeUpdate(event) {
        const { data } = event.params;

        // Only validate if Teams field is being updated
        if (data.Teams !== undefined) {
            if (!data.Teams || (Array.isArray(data.Teams) && data.Teams.length === 0)) {
                throw new Error('Company must have at least one Team assigned. Users are managed through Teams.');
            }
        }
    },
};
