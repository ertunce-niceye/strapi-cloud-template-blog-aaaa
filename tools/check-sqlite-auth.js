const Database = require('better-sqlite3');
try {
    const db = new Database('.tmp/data.db', { readonly: true });

    // Find table name
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const table = tables.find(t => t.name.includes('portal_admin'));

    if (table) {
        console.log(`Table found: ${table.name}`);
        const rows = db.prepare(`SELECT * FROM ${table.name}`).all();
        console.log(`Rows: ${rows.length}`);
        rows.forEach(row => {
            console.log('User:', row);
        });
    } else {
        console.log('Portal Admins table not found.');
        console.log('Tables:', tables.map(t => t.name).join(', '));
    }
} catch (e) {
    console.error(e);
}
