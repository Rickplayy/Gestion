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

module.exports = router;
