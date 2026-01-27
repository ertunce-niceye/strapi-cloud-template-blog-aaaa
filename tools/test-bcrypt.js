const bcrypt = require('bcryptjs');

const password = '123123';
const hash = bcrypt.hashSync(password, 10);
console.log('Generated Hash:', hash);

const dbHash = '$2b$10$ia58dDOhVpvLK9o3ZCkzseGyiFfuiwFU8gE67MYKmAedMfJ2pX8xK';
console.log('DB Hash:', dbHash);

const matchStart = bcrypt.compareSync(password, hash);
console.log('Match matching hash:', matchStart);

const matchDB = bcrypt.compareSync(password, dbHash);
console.log('Match DB hash:', matchDB);

// Force $2a$ test
const dbHash2a = dbHash.replace('$2b$', '$2a$');
const matchDB2a = bcrypt.compareSync(password, dbHash2a);
console.log('Match DB hash (forced 2a):', matchDB2a);
