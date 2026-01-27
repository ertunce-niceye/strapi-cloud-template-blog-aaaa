const Database = require('better-sqlite3');
try {
    const db = new Database('.tmp/data.db', { readonly: true });

    // List tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('--- ALL TABLES ---');
    console.log(tables.map(t => t.name).join(', '));
    console.log('------------------');

    const checkTable = (name) => {
        const t = tables.find(tbl => tbl.name === name);
        if (t) {
            const c = db.prepare(`SELECT count(*) as count FROM ${name}`).get();
            console.log(`Table '${name}': ${c.count} rows`);
        } else {
            console.log(`Table '${name}' NOT FOUND`); // Try partial match
            const partial = tables.find(tbl => tbl.name.includes(name));
            if (partial) {
                const c = db.prepare(`SELECT count(*) as count FROM ${partial.name}`).get();
                console.log(`Found similar table '${partial.name}': ${c.count} rows`);
            }
        }
    };

    checkTable('webinars');
    checkTable('admin_users');
    checkTable('up_users'); // Users-Permissions users
    checkTable('files'); // Uploads
    checkTable('companies'); // Is it companies or company?

} catch (e) {
    console.error(e);
}
