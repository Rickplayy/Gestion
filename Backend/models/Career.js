const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Career = sequelize.define('Career', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
}, {
    timestamps: false,
});

module.exports = Career;
