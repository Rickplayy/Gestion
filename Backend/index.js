const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Sin JWT_SECRET los tokens serían falsificables: no arrancar sin él.
if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET no está definido en .env. El servidor no puede arrancar de forma segura.');
    process.exit(1);
}
if (!process.env.ADMIN_PASS) {
    console.warn('ADVERTENCIA: ADMIN_PASS no está definido; se usaría una contraseña por defecto insegura al sembrar el admin.');
}

const createDatabase = require('./db/init');
const sequelize = require('./config/database');
const Career = require('./models/Career');
const Student = require('./models/Student');
const Admin = require('./models/Admin');
const apiRoutes = require('./routes/api');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS restringido al origen del frontend (configurable vía FRONTEND_ORIGIN)
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRoutes);

const defaultCareers = [
    "Ingenieria en informatica",
    "Ciencias de la informatica",
    "Ingenieria Ferroviaria",
    "Ingenieria Industrial",
    "Administracion Industrial"
];

const startServer = async () => {
    try {
        // 1. Ensure DB exists
        await createDatabase();

        // 2. Sync Models (alter agrega columnas nuevas sin borrar tablas ni datos)
        await sequelize.sync({ alter: true });
        console.log('Database synced.');

        // 3. Seed Careers if empty
        const careerCount = await Career.count();
        if (careerCount === 0) {
            console.log('Seeding default careers...');
            await Career.bulkCreate(defaultCareers.map(name => ({ name })));
            console.log('Careers seeded.');
        }

        // 4. Seed Admin if empty
        const adminCount = await Admin.count();
        if (adminCount === 0) {
            console.log('Seeding default admin...');
            if (!process.env.ADMIN_PASS) {
                console.warn('ADVERTENCIA: sembrando admin con contraseña por defecto. Define ADMIN_PASS en .env y cámbiala.');
            }
            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASS || 'admin123', 10);
            await Admin.create({
                username: process.env.ADMIN_USER || 'admin',
                password: hashedPassword
            });
            console.log('Admin seeded.');
        }

        // Los alumnos se cargan desde el Excel Nuevo-ingreso.xlsx (Generador de
        // Grupos); no se siembran alumnos de prueba para que la tabla de Alumnos
        // refleje exactamente el archivo importado.

        // 5. Start App
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Unable to start server:', err);
    }
};

startServer();
