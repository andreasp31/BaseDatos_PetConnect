const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Definimos el Esquema
const usuarioEsquema = new mongoose.Schema({
    nombre: { type: String, required: true },
    apellidos: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    clave: { type: String, required: true }
});

const actividadEsquema = new mongoose.Schema({
    nombre:{
        type:String, required:true
    },
    descripcion:{
        type:String, required:true
    },
    plazas:{
        type:Number, required:true
    },
    fechaHora:{
        type:Date, required:true
    },
    personasApuntadas:[{
        usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
        hora: String
    }]
})

const Usuario = mongoose.model("Usuario", usuarioEsquema);
const Actividades = mongoose.model("Actividades",actividadEsquema);

// Función de conexión mejorada
async function connectarBd() {
    try {
        console.log("Iniciando conexión a MongoDB...");
        
        // Usamos la URI directamente o desde el env
        const uri = process.env.MONGODB_URI || "mongodb+srv://admin_proyecto:PetConnect2026@cluster0.5vapmej.mongodb.net/";

        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 8000,
            family: 4, // Fuerza IPv4 para evitar el error anterior
        });

        console.log("¡Conectado a MongoDB con éxito!");

    } catch(error) {
        console.error("Error en conexión a MongoDB: ", error.message);
    }
}

// Ruta de Login
app.post("/api/login", async (req, res) => {
    const { email, clave } = req.body;
    try {
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        if (usuario.clave !== clave) {
            return res.status(401).json({ message: "Contraseña incorrecta" });
        }
        
        const { clave: _, ...usuarioSinClave } = usuario.toObject();
        res.json(usuarioSinClave);
    }
    catch(error) {
        console.log("Error al hacer login", error);
        res.status(500).json({ message: "Error del servidor" });
    }
});

app.post("/api/registro", async (req, res) => {
    const { nombre, apellidos, email, clave, clave2 } = req.body;
    
    try {
        // 1. Comprobar si el correo ya existe en la base de datos
        const existeUsuario = await Usuario.findOne({ email });
        if (existeUsuario) {
            return res.status(400).json({ message: "El correo ya está registrado" });
        }
        if(clave === clave2){
             // 2. Si no existe, crear el nuevo usuario
            const nuevoUsuario = new Usuario({
                nombre,
                apellidos,
                email,
                clave // Nota: En un proyecto real aquí usaríamos bcrypt para encriptar
            });
            // 3. Guardar en MongoDB
            await nuevoUsuario.save();
            res.status(201).json({ message: "Usuario creado con éxito", usuario: nuevoUsuario });
        }
        else{
            res.status(201).json({ message: "Las contraseñas no coinciden"});
        }
    } catch (error) {
        console.error("Error al registrar:", error);
        res.status(500).json({ message: "Error al guardar el usuario" });
    }
});

app.post("/api/actividades/inscribir", async(req,res)=>{
    const { actividadId, usuarioId } = req.body;
    try{
        await Actividades.findByIdAndUpdate(actividadId,{
            $push: { personasApuntadas: { usuarioId, hora } }
        });
        res.json({message:"Te has inscrito correctamente"});
    }
    catch(error){
        res.status(500).json({ message: "Error al inscribirse" });
    }
})

app.post("/api/actividades/crear", async (req, res) => {
    const { nombre, descripcion, plazas, fechaHora } = req.body;
    try {
        const nuevaActividad = new Actividades({
            nombre,
            descripcion,
            plazas,
            fechaHora,
            personasApuntadas: []
        });
        await nuevaActividad.save();
        res.status(201).json({ message: "Actividad creada", actividad: nuevaActividad });
    } catch (error) {
        res.status(500).json({ message: "Error al crear actividad" });
    }
});

app.get("/api/actividades", async (req, res) => {
    try {
        const lista = await Actividades.find();
        res.json(lista);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener actividades" });
    }
});

app.get("/api/mis-actividades/:usuarioId", async (req, res) => {
    try {
        const misActividades = await Actividades.find({
            personasApuntadas: req.params.usuarioId
        });
        res.json(misActividades);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener mis actividades" });
    }
});

// Iniciamos todo
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    connectarBd(); // Conectamos a la BD después de levantar el servidor
});