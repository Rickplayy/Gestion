const express = require('express');
const cors = require('cors');
require('dotenv').config();
const createDatabase = require('./db/init');
const sequelize = require('./config/database');
const Career = require('./models/Career');
const Student = require('./models/Student');
const Admin = require('./models/Admin');
const apiRoutes = require('./routes/api');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
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

        // 2. Sync Models (SAFE MODE - DOES NOT DROP TABLES)
        await sequelize.sync();
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
            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASS || 'admin123', 10);
            await Admin.create({
                username: process.env.ADMIN_USER || 'admin',
                password: hashedPassword
            });
            console.log('Admin seeded.');
        }

        // 5. Seed 30 Mock Students if empty
        const studentCount = await Student.count();
        if (studentCount === 0) {
            console.log('Seeding 30 mock students...');
            const careers = await Career.findAll();
            if (careers.length > 0) {
                const firstNames = ['Juan', 'María', 'Roberto', 'Ana', 'Carlos', 'Elena', 'Diego', 'Lucía', 'Fernando', 'Sofía'];
                const lastNames = ['Pérez', 'García', 'Martínez', 'Rodríguez', 'López', 'Hernández', 'Sánchez', 'Ramírez', 'Torres', 'Flores'];
                const streets = ['Av. Juan de Dios Bátiz', 'Calle 5 de Mayo', 'Lindavista', 'Insurgentes Sur', 'Reforma', 'Eje Central', 'Churubusco', 'Tlalpan'];
                
                const mockStudents = [];
                for (let i = 1; i <= 30; i++) {
                    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
                    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
                    const street = streets[Math.floor(Math.random() * streets.length)];
                    const career = careers[Math.floor(Math.random() * careers.length)];
                    
                    mockStudents.push({
                        name: `${firstName} ${lastName}`,
                        boleta: `202360${i.toString().padStart(4, '0')}`,
                        address: `${street} #${Math.floor(Math.random() * 500) + 1}, CDMX`,
                        careerId: career.id
                    });
                }
                await Student.bulkCreate(mockStudents);
                console.log('30 mock students seeded.');
            }
        }

        // 6. Start App
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Unable to start server:', err);
    }
};

startServer();
