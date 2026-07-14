const express = require('express');
const router = express.Router();
const Career = require('../models/Career');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Admin Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ where: { username } });
        
        if (!admin) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Middleware to protect routes (optional for now, but good practice)
const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: 'Acceso denegado' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.admin = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: 'Token no válido' });
    }
};

// Get all careers
router.get('/careers', async (req, res) => {
    try {
        const careers = await Career.findAll();
        res.json(careers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Register a student (Public or protected? User said "generes la interfaz base", usually public for registration)
router.post('/students', async (req, res) => {
    try {
        const { name, boleta, address, careerId } = req.body;
        const student = await Student.create({ name, boleta, address, careerId });
        res.status(201).json(student);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all students (Admin only)
router.get('/students', async (req, res) => {
    try {
        const students = await Student.findAll({ include: Career });
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk register students (Excel import)
router.post('/students/bulk', async (req, res) => {
    try {
        const studentsData = req.body; // Array of parsed excel records
        
        // Get all careers to map PROGRAMA_EDUCATIVO to careerId
        const careers = await Career.findAll();
        
        const newStudents = [];
        
        for (const record of studentsData) {
            // Find career by name case insensitive using JS or DB
            let career = careers.find(c => 
                c.name.toLowerCase().replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u') === 
                String(record.PROGRAMA_EDUCATIVO || '').toLowerCase().replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
            );
            
            // If not found, you could set a default or create it, for now we will just use the first career if none matched (or leave it null if possible)
            const careerId = career ? career.id : (careers[0] ? careers[0].id : null);
            
            newStudents.push({
                name: record.NOMBRE || 'Sin nombre',
                boleta: record.BOLETA || `N/A-${Math.floor(Math.random() * 10000)}`,
                address: record.DOMICILIO || 'Sin dirección',
                careerId: careerId
            });
        }
        
        // bulkCreate with ignoreDuplicates: true allows it to skip if boleta is duplicate
        const createdStudents = await Student.bulkCreate(newStudents, { ignoreDuplicates: true });
        
        res.status(201).json({ message: `${createdStudents.length} alumnos procesados exitosamente.` });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
