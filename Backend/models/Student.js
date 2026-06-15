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
});

Student.belongsTo(Career, { foreignKey: 'careerId' });
Career.hasMany(Student, { foreignKey: 'careerId' });

module.exports = Student;
