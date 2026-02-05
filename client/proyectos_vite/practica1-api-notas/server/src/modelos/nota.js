//Definición de esquema (Schema) que define la forma (campos y reglas)
//de los documentos. 
//timestamps: true agrega automáticamente campos de createdAt y updatedAt
const { time } = require('console');
const mongoose = require('mongoose');

const esquemaNota = new mongoose.Schema({
    texto: {
        type: String,
        required: true,
        trim: true }
    }, { timestamps: true }
); 

module.exports = mongoose.model('Nota', esquemaNota);
