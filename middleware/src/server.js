const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const pool = mysql.createPool({
  host: 'mysql',
  user: 'user',
  password: 'password',
  database: 'image_manager',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function loadStorageNodes() {
  try {
    const nodesPath = path.join(__dirname, 'config', 'nodes.txt');
    const nodesContent = fs.readFileSync(nodesPath, 'utf8');
    const nodesList = nodesContent.split('\n').filter(line => line.trim() !== '');
    
    for (const nodeInfo of nodesList) {
      const [ip, port] = nodeInfo.split(':');
      if (ip && port) {
        const [existingNodes] = await pool.query(
          'SELECT * FROM storage_nodes WHERE ip = ? AND port = ?',
          [ip, port]
        );
        
        if (existingNodes.length === 0) {
          await pool.query(
            'INSERT INTO storage_nodes (ip, port, max_storage, available_storage) VALUES (?, ?, ?, ?)',
            [ip, parseInt(port), 104857600, 104857600]  
          );
        }
      }
    }
    console.log('Nodos de almacenamiento cargados correctamente');
  } catch (error) {
    console.error('Error al cargar nodos de almacenamiento:', error);
  }
}

async function getBestStorageNode() {
  try {
    const [nodes] = await pool.query(
      'SELECT * FROM storage_nodes WHERE status = "active" ORDER BY available_storage DESC'
    );
    
    if (nodes.length === 0) {
      throw new Error('No hay nodos de almacenamiento disponibles');
    }
    
    for (const node of nodes) {
      try {
        const response = await axios.get(`http://${node.ip}:${node.port}/available-space`);
        
        await pool.query(
          'UPDATE storage_nodes SET available_storage = ? WHERE id = ?',
          [response.data.availableSpace, node.id]
        );
        
        if (response.data.availableSpace > 0) {
          return {
            id: node.id,
            ip: node.ip,
            port: node.port,
            availableSpace: response.data.availableSpace
          };
        }
      } catch (error) {
        console.error(`Error al consultar nodo ${node.ip}:${node.port}:`, error.message);
        await pool.query(
          'UPDATE storage_nodes SET status = "inactive" WHERE id = ?',
          [node.id]
        );
      }
    }
    
    throw new Error('No hay nodos con espacio disponible');
  } catch (error) {
    throw error;
  }
}

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }
    
    const { filename, originalname, mimetype, size, path: tempPath } = req.file;
    
    const bestNode = await getBestStorageNode();
    
    if (size > bestNode.availableSpace) {
      return res.status(400).json({ 
        error: 'El tamaño de la imagen excede el espacio disponible' 
      });
    }
    
    const fileBuffer = fs.readFileSync(tempPath);
    
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimetype });
    formData.append('image', blob, originalname);
    
    const uploadResponse = await axios.post(
      `http://${bestNode.ip}:${bestNode.port}/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    
    const [result] = await pool.query(
      'INSERT INTO images (filename, original_name, size, mime_type, node_id, path) VALUES (?, ?, ?, ?, ?, ?)',
      [
        uploadResponse.data.filename,
        originalname,
        size,
        mimetype,
        bestNode.id,
        uploadResponse.data.path
      ]
    );
    
    await pool.query(
      'UPDATE storage_nodes SET available_storage = available_storage - ? WHERE id = ?',
      [size, bestNode.id]
    );
    
    fs.unlinkSync(tempPath);
    
    res.status(201).json({
      id: result.insertId,
      filename: uploadResponse.data.filename,
      originalName: originalname,
      size,
      nodeId: bestNode.id
    });
    
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

app.get('/images', async (req, res) => {
  try {
    const [images] = await pool.query(`
      SELECT i.*, s.ip, s.port 
      FROM images i
      JOIN storage_nodes s ON i.node_id = s.id
      ORDER BY i.created_at DESC
    `);
    
    res.json(images);
  } catch (error) {
    console.error('Error al listar imágenes:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

app.get('/images/:id', async (req, res) => {
  try {
    const [images] = await pool.query(
      `SELECT i.*, s.ip, s.port 
       FROM images i
       JOIN storage_nodes s ON i.node_id = s.id
       WHERE i.id = ?`,
      [req.params.id]
    );
    
    if (images.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    
    const image = images[0];
    
    const response = await axios.get(
      `http://${image.ip}:${image.port}/images/${image.filename}`,
      { responseType: 'arraybuffer' }
    );
    
    res.set('Content-Type', image.mime_type);
    res.set('Content-Disposition', `inline; filename="${image.original_name}"`);
    res.send(Buffer.from(response.data));
    
  } catch (error) {
    console.error('Error al obtener imagen:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

app.delete('/images/:id', async (req, res) => {
  try {
    const [images] = await pool.query(
      `SELECT i.*, s.ip, s.port 
       FROM images i
       JOIN storage_nodes s ON i.node_id = s.id
       WHERE i.id = ?`,
      [req.params.id]
    );
    
    if (images.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    
    const image = images[0];
    
    await axios.delete(`http://${image.ip}:${image.port}/images/${image.filename}`);
    
    await pool.query(
      'UPDATE storage_nodes SET available_storage = available_storage + ? WHERE id = ?',
      [image.size, image.node_id]
    );
    
    await pool.query('DELETE FROM images WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Imagen eliminada correctamente' });
    
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

async function initializeApp() {
  try {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    
    await loadStorageNodes();
    
    app.listen(PORT, () => {
      console.log(`Middleware escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al inicializar la aplicación:', error);
  }
}

initializeApp();