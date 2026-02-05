//Script para conectar a MONGODB
//Si falla, se detiene el proceso sin BD.
//Si no hay BD se muestra error de conexión a la API
const mongoose = require('mongoose');

async function conectarBaseDeDatos(uriMongo){
    try{
        await mongoose.connect(uriMongo);
        console.log("Conexión a la base de datos exitosa");
    }catch(error){
        console.error("Error al conectar a la base de datos:", error);
        process.exit(1); // Detener el proceso si no se puede conectar a la base de datos
    }
}

module.exports = conectarBaseDeDatos;