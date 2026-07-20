const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const Career = require('../models/Career');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// --- Rate limiting simple en memoria para /login (5 intentos por IP cada 15 min) ---
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const loginRateLimit = (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const entry = loginAttempts.get(ip);

    if (entry && now - entry.first < WINDOW_MS) {
        if (entry.count >= MAX_ATTEMPTS) {
            return res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' });
        }
        entry.count++;
    } else {
        loginAttempts.set(ip, { first: now, count: 1 });
    }
    next();
};

// Limpieza periódica para que el mapa no crezca sin límite
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts) {
        if (now - entry.first >= WINDOW_MS) loginAttempts.delete(ip);
    }
}, WINDOW_MS).unref();

// --- Middleware de autenticación (acepta "Bearer <token>" o el token directo) ---
const auth = (req, res, next) => {
    const header = req.header('Authorization');
    if (!header) return res.status(401).json({ error: 'Acceso denegado' });

    const token = header.startsWith('Bearer ') ? header.slice(7) : header;

    try {
        req.admin = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token no válido o expirado' });
    }
};

// Admin Login
router.post('/login', loginRateLimit, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }

        const admin = await Admin.findOne({ where: { username } });
        // Mensaje único para no revelar si el usuario existe (anti-enumeración)
        const isMatch = admin && await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Login exitoso: resetear contador de intentos de esta IP
        loginAttempts.delete(req.ip);

        const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error('Error en /login:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Get all careers (público: lo usa el formulario de registro)
router.get('/careers', async (req, res) => {
    try {
        const careers = await Career.findAll();
        res.json(careers);
    } catch (err) {
        console.error('Error en GET /careers:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Validación básica de un alumno
const validateStudent = ({ name, boleta, address }) => {
    if (typeof name !== 'string' || !name.trim() || name.length > 200) return 'Nombre inválido';
    if (typeof boleta !== 'string' || !boleta.trim() || boleta.length > 20) return 'Boleta inválida';
    if (typeof address !== 'string' || !address.trim() || address.length > 500) return 'Dirección inválida';
    return null;
};

// Register a student (solo admin: el registro requiere sesión iniciada)
const VALID_GENDERS = ['Masculino', 'Femenino'];

router.post('/students', auth, async (req, res) => {
    try {
        const { name, boleta, address, careerId, gender } = req.body;

        const invalid = validateStudent({ name, boleta, address });
        if (invalid) return res.status(400).json({ error: invalid });

        if (gender != null && gender !== '' && !VALID_GENDERS.includes(gender)) {
            return res.status(400).json({ error: 'Sexo inválido' });
        }

        const career = await Career.findByPk(careerId);
        if (!career) return res.status(400).json({ error: 'Carrera inválida' });

        const student = await Student.create({
            name: name.trim(),
            boleta: boleta.trim(),
            address: address.trim(),
            gender: gender || null,
            careerId: career.id,
            source: 'manual'
        });
        res.status(201).json(student);
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: 'Esa boleta ya está registrada' });
        }
        console.error('Error en POST /students:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Get all students (solo admin)
router.get('/students', auth, async (req, res) => {
    try {
        const students = await Student.findAll({ include: Career });
        res.json(students);
    } catch (err) {
        console.error('Error en GET /students:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Bulk register students - importación de Excel (solo admin)
const MAX_BULK_RECORDS = 5000;

router.post('/students/bulk', auth, async (req, res) => {
    try {
        const studentsData = req.body;

        if (!Array.isArray(studentsData)) {
            return res.status(400).json({ error: 'Se esperaba un arreglo de registros' });
        }
        if (studentsData.length === 0) {
            return res.status(400).json({ error: 'El archivo no contiene registros' });
        }
        if (studentsData.length > MAX_BULK_RECORDS) {
            return res.status(400).json({ error: `Máximo ${MAX_BULK_RECORDS} registros por importación` });
        }

        // Get all careers to map PROGRAMA_EDUCATIVO to careerId
        const careers = await Career.findAll();

        const normalize = (s) => String(s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        const newStudents = [];

        for (const record of studentsData) {
            if (!record || typeof record !== 'object') continue;

            const career = careers.find(c => normalize(c.name) === normalize(record.PROGRAMA_EDUCATIVO));
            const careerId = career ? career.id : (careers[0] ? careers[0].id : null);

            // GENERO viene del Excel como 'F' / 'M' (o ya escrito completo)
            const generoRaw = String(record.GENERO || '').trim().toUpperCase();
            let gender = null;
            if (generoRaw === 'F' || generoRaw === 'FEMENINO') gender = 'Femenino';
            else if (generoRaw === 'M' || generoRaw === 'MASCULINO') gender = 'Masculino';

            // Identidad estable: algunos aspirantes aún no tienen boleta asignada.
            // Se usa la CURP (siempre presente y única) para no generar duplicados
            // nuevos en cada importación. Si tampoco hubiera CURP, se descarta.
            const boletaRaw = String(record.BOLETA || '').trim();
            const curp = String(record.CURP || '').trim();
            const identidad = boletaRaw || (curp ? `SB-${curp}` : '');
            if (!identidad) continue;

            newStudents.push({
                name: String(record.NOMBRE || 'Sin nombre').slice(0, 200),
                boleta: identidad.slice(0, 40),
                address: String(record.DOMICILIO || 'Sin dirección').slice(0, 500),
                gender: gender,
                careerId: careerId,
                source: 'excel'
            });
        }

        // Deduplicar por boleta dentro del mismo archivo (la última gana)
        const byBoleta = new Map();
        for (const s of newStudents) byBoleta.set(s.boleta, s);
        const dedupedStudents = [...byBoleta.values()];

        // La tabla de Alumnos es un RESUMEN del Excel: se reemplaza por completo
        // el set importado (source='excel') para que coincida exactamente con el
        // archivo, sin acumular datos viejos. Los registros manuales se conservan.
        // Todo dentro de una transacción para no dejar la tabla a medias.
        await sequelize.transaction(async (t) => {
            await Student.destroy({ where: { source: 'excel' }, transaction: t });
            await Student.bulkCreate(dedupedStudents, { transaction: t });
        });

        res.status(201).json({ message: `${dedupedStudents.length} alumnos cargados del Excel.` });
    } catch (err) {
        console.error('Error en POST /students/bulk:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
