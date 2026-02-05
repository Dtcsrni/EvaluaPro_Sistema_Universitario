//Definicion de frontend que consume API

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const rutasNotas = require('./rutas/notas.rutas');
const conectarBaseDeDatos = require('./bd');

const app = express();
//Cors permite que un frontend en otro origen o puerto consuma la API
app.use(cors());
//express.json se encarga de hacer parsing JSON y devolverlos como req.body
app.use(express.json());
app.use('/api/notas', rutasNotas);
//Ruta de healthcheck para comprobar el estado del servidor
app.use('/api/salud', (req, res) => res.json({ ok: true }));

const PUERTO = process.env.PUERTO || 3000;

conectarBaseDeDatos(process.env.URI_MONGO).then(() => {
    app.listen(PUERTO, () => {
        console.log(`Servidor escuchando en el puerto ${PUERTO}`);
        });
}).catch((error) => {
    console.error("No se pudo iniciar el servidor debido a un error de conexión a la base de datos:", error);
});

