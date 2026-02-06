//Elementos de API
//POST /api/notas   -> crear nueva nota

const express = require('express');
const Nota = require('../modelos/nota');

const router = express.Router();

//Crear nueva nota
//POST /api/notas
//-Recibe texto
//-Valida entrada minima
//Guarda en MongoDB

router.post("/", async (req, res) => {
    try {
        const { texto } = req.body;
        //Validar entrada minima
        if(!texto || texto.length < 5) {
            console.log("Texto de nota inválido recibido:", texto);
            return res.status(400).json({ mensaje: "El texto de la nota es obligatorio y debe tener al menos 5 caracteres." });
        }
        //Crear una nueva nota
        console.log("Creando nueva nota con texto:", texto);
        const notaCreada = await Nota.create({ texto:texto.trim() });
        return res.status(201).json(notaCreada);
    } catch (error) {
        console.log("Contenido del error:",error.body);
        console.error("Error al crear la nota:", error);
        return res.status(500).json({ mensaje: "Error interno del servidor." });
    }
});

router.get("/", async (req, res) => {
    try {
        const notas = await Nota.find().sort({ createdAt: -1 });
        if (!notas) {
            console.log("No se encontraron notas en la base de datos.");
            return res.status(404).json({ mensaje: "No se encontraron notas." });
        }
        return res.status(200).json(notas);
    } catch (error) {
        console.error("Error al obtener las notas:", error);
        return res.status(500).json({ mensaje: "Error interno del servidor." });
    }
});

module.exports = router;
