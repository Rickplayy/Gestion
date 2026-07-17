const { Client } = require('pg');
require('dotenv').config();

const createDatabase = async () => {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

    const dbName = process.env.DB_NAME;
    // CREATE DATABASE no acepta parámetros, así que validamos el nombre
    // estrictamente antes de interpolarlo (solo letras, números y guion bajo).
    if (!dbName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
        throw new Error(`DB_NAME inválido: "${dbName}". Usa solo letras, números y guion bajo.`);
    }

    try {
        await client.connect();
        const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);

        if (res.rowCount === 0) {
            console.log(`Database ${dbName} does not exist. Creating...`);
            await client.query(`CREATE DATABASE "${dbName}"`);
            console.log(`Database ${dbName} created successfully.`);
        } else {
            console.log(`Database ${dbName} already exists.`);
        }
    } catch (err) {
        console.error('Error creating database:', err);
    } finally {
        await client.end();
    }
};

module.exports = createDatabase;
