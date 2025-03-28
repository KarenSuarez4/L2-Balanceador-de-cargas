const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3002;
const NODE_ID = process.env.NODE_ID || '1';
const MAX_STORAGE = process.env.MAX_STORAGE || 104857600; // 100MB en bytes
const STORAGE_PATH = path.join(__dirname, 'storage');

// Configurar multer para almacenamiento de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_PATH);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({ storage });

// Middleware
app.use(express.json());

// Asegurar que el directorio de almacenamiento exista
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// Calcular espacio utilizado
function getStorageInfo() {
  let usedSpace = 0;
  
  const files = fs.readdirSync(STORAGE_PATH);
  files.forEach(file => {
    const filePath = path.join(STORAGE_PATH, file);
    const stats = fs.statSync(filePath);
    usedSpace += stats.size;
  });
  
  const availableSpace = MAX_STORAGE - usedSpace;
  
  return {
    maxStorage: MAX_STORAGE,
    usedSpace,
    availableSpace: availableSpace > 0 ? availableSpace : 0,
    files: files.length
  };
}

// Endpoints

// Consultar espacio disponible
app.get('/available-space', (req, res) => {
  const storageInfo = getStorageInfo();
  res.json(storageInfo);
});

// Subir imagen
app.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }
    
    const { filename, path: filePath } = req.file;
    
    // Verificar espacio disponible
    const storageInfo = getStorageInfo();
    if (req.file.size > storageInfo.availableSpace) {
      // Si no hay espacio, eliminar el archivo y devolver error
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'No hay suficiente espacio disponible' });
    }
    
    res.status(201).json({
      message: 'Imagen subida correctamente',
      nodeId: NODE_ID,
      filename,
      path: filePath
    });
    
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// Obtener una imagen
app.get('/images/:filename', (req, res) => {
  try {
    const filePath = path.join(STORAGE_PATH, req.params.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    
    res.sendFile(filePath);
    
  } catch (error) {
    console.error('Error al obtener imagen:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// Eliminar una imagen
app.delete('/images/:filename', (req, res) => {
  try {
    const filePath = path.join(STORAGE_PATH, req.params.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    
    fs.unlinkSync(filePath);
    
    res.json({ message: 'Imagen eliminada correctamente' });
    
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// Información del nodo
app.get('/info', (req, res) => {
  const storageInfo = getStorageInfo();
  res.json({
    nodeId: NODE_ID,
    ...storageInfo
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Nodo de almacenamiento ${NODE_ID} escuchando en el puerto ${PORT}`);
  console.log(`Espacio máximo de almacenamiento: ${MAX_STORAGE} bytes`);
});