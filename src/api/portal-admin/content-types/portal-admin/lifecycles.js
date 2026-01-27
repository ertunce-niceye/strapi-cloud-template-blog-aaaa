const bcrypt = require('bcryptjs');

module.exports = {
    async beforeCreate(event) {
        const { data } = event.params;
        if (data.Password) {
            data.Password = bcrypt.hashSync(data.Password, 10);
        }
    },
    async beforeUpdate(event) {
        const { data } = event.params;
        if (data.Password) {
            data.Password = bcrypt.hashSync(data.Password, 10);
        }
    },
};
