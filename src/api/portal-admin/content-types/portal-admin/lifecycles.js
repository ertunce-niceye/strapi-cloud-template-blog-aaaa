const bcrypt = require('bcryptjs');

module.exports = {
    async beforeCreate(event) {
        const { data } = event.params;
        if (data.Password) {
            // Only hash if it doesn't look like a bcrypt hash already
            // Bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 chars
            const isBcryptHash = /^\$2[aby]\$/.test(data.Password) && data.Password.length === 60;
            if (!isBcryptHash) {
                data.Password = bcrypt.hashSync(data.Password, 10);
            }
        }
    },
    async beforeUpdate(event) {
        const { data } = event.params;
        if (data.Password) {
            // Only hash if it doesn't look like a bcrypt hash already
            const isBcryptHash = /^\$2[aby]\$/.test(data.Password) && data.Password.length === 60;
            if (!isBcryptHash) {
                data.Password = bcrypt.hashSync(data.Password, 10);
            }
        }
    },
};
