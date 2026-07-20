const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Career = require('./Career');

const Student = sequelize.define('Student', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    boleta: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    gender: {
        type: DataTypes.STRING, // 'Masculino' | 'Femenino' | null
        allowNull: true,
    },
    // Origen del registro: 'excel' (importado de Nuevo-ingreso.xlsx) o 'manual'
    // (alta desde el formulario de Registro). Permite reemplazar el set del
    // Excel sin borrar los registros manuales.
    source: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'manual',
    },
});

Student.belongsTo(Career, { foreignKey: 'careerId' });
Career.hasMany(Student, { foreignKey: 'careerId' });

module.exports = Student;
