const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const app = express();
app.use(express.json());
app.use(cors());

//nivel de seguridad
const SALT_ROUNDS = 10

const JWT_SECRET = process.env.JWT_SECRET;

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

//Esquemas de validacion
const RegistroSchema = z.object({
    nombre: z.string().min(2,"Nombre demasiado corto"),
    apellidos: z.string().min(2,"Apellidos obligatorios"),
    email: z.string().email("Email inválido"),
    clave: z.string().min(6, "La clave debe tener al menos 6 caracteres"),
    clave2: z.string()
}).refine((data) => data.clave === data.clave2, {
    message: "Las contraseñas no coinciden",
    path: ["clave2"],
});

const LoginSchema = z.object({
    email: z.string().email(),
    clave: z.string()
});


const Usuario = mongoose.model("Usuario", usuarioEsquema);
const Actividades = mongoose.model("Actividades",actividadEsquema);

// Función de conexión mejorada
async function connectarBd() {
    try {
        console.log("Iniciando conexión a MongoDB...");
        
        // Usamos la URI directamente o desde el env
        const uri = process.env.MONGODB_URI;

        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 8000,
            family: 4,
        });

        console.log("¡Conectado a MongoDB con éxito!");

    } catch(error) {
        console.error("Error en conexión a MongoDB: ", error.message);
    }
}

// Ruta de Login
app.post("/api/login", async (req, res) => {
    try {
        // Validar con zod
        const validacion = LoginSchema.safeParse(req.body);
        if (!validacion.success) return res.status(400).json({ message: "Datos inválidos" });

        const { email, clave } = validacion.data;

        const usuario = await Usuario.findOne({ email });
        if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

        // BCRYPT,comparar contraseña enviada con el hash de la BD
        const esValida = await bcrypt.compare(clave, usuario.clave);
        if (!esValida) return res.status(401).json({ message: "Contraseña incorrecta" });

        // JWT,generar Token
        const token = jwt.sign(
            { id: usuario._id, role: usuario.role },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({
            token,
            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                role: usuario.role
            }
        });
    } catch(error) {
        res.status(500).json({ message: "Error del servidor" });
    }
});

app.post("/api/registro", async (req, res) => {
    try {
        // Validar con zod
        const validacion = RegistroSchema.safeParse(req.body);
        if (!validacion.success) {
            const erroresFormateados = validacion.error.format();
            return res.status(400).json({ 
                message: "Error de validación",
                detalles: erroresFormateados 
            });
        }

        const { nombre, apellidos, email, clave } = validacion.data;

        const existeUsuario = await Usuario.findOne({ email });
        if (existeUsuario) {
            return res.status(400).json({ message: "El correo ya está registrado" });
        }

        //Hashear la contraseña
        const passwordHash = await bcrypt.hash(clave, SALT_ROUNDS);

        const nuevoUsuario = new Usuario({
            nombre,
            apellidos,
            email,
            clave: passwordHash // se guarda el hash
        });

        await nuevoUsuario.save();
        res.status(201).json({ message: "Usuario creado con éxito" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error interno" });
    }
});

app.post("/api/actividades/inscribir", async(req,res)=>{
    const { actividadId, usuarioId, hora } = req.body;
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
            fechaHora: fecha || fechaHora,
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