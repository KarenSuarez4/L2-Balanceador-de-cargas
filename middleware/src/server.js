const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const pool = mysql.createPool({
  host: "mysql",
  user: "user",
  password: "password",
  database: "image_manager",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

async function loadStorageNodes() {
  try {
    const configDir = path.join(__dirname, "config");
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const nodesPath = path.join(configDir, "nodes.txt");
    if (!fs.existsSync(nodesPath)) {
      const defaultNodes = `storage-node-1:3002
storage-node-2:3002
storage-node-3:3002`;
      fs.writeFileSync(nodesPath, defaultNodes, "utf8");
    }

    const nodesContent = fs.readFileSync(nodesPath, "utf8");
    const nodesList = nodesContent
      .split("\n")
      .filter((line) => line.trim() !== "");

    console.log("Nodos encontrados en el archivo:", nodesList);

    for (const nodeInfo of nodesList) {
      const [ip, port] = nodeInfo.split(":");
      if (ip && port) {
        try {
          const [existingNodes] = await pool.query(
            "SELECT * FROM storage_nodes WHERE ip = ? AND port = ?",
            [ip, port]
          );

          if (existingNodes.length === 0) {
            await pool.query(
              "INSERT INTO storage_nodes (ip, port, max_storage, available_storage) VALUES (?, ?, ?, ?)",
              [ip, parseInt(port), 104857600, 104857600]
            );
            console.log(`Nodo registrado: ${ip}:${port}`);
          } else {
            console.log(`Nodo ya existe: ${ip}:${port}`);
          }
        } catch (err) {
          console.error(`Error al procesar nodo ${ip}:${port}:`, err);
        }
      }
    }
    console.log("Nodos de almacenamiento cargados correctamente");
  } catch (error) {
    console.error("Error al cargar nodos de almacenamiento:", error);
  }
}
async function getBestStorageNode() {
  try {
    const [nodes] = await pool.query(
      "SELECT * FROM storage_nodes ORDER BY available_storage DESC"
    );

    if (nodes.length === 0) {
      await loadStorageNodes();
      const [freshNodes] = await pool.query(
        "SELECT * FROM storage_nodes ORDER BY available_storage DESC"
      );

      if (freshNodes.length === 0) {
        throw new Error("No hay nodos de almacenamiento disponibles");
      }
      nodes = freshNodes;
    }

    let availableNode = null;

    for (const node of nodes) {
      try {
        console.log(`Intentando conectar con nodo ${node.ip}:${node.port}...`);
        const response = await axios.get(
          `http://${node.ip}:${node.port}/available-space`,
          { timeout: 5000 }
        );

        await pool.query(
          "UPDATE storage_nodes SET available_storage = ?, status = 'active' WHERE id = ?",
          [response.data.availableSpace, node.id]
        );

        if (response.data.availableSpace > 0) {
          console.log(`Nodo disponible encontrado: ${node.ip}:${node.port}`);
          availableNode = {
            id: node.id,
            ip: node.ip,
            port: node.port,
            availableSpace: response.data.availableSpace,
          };
          break;
        }
      } catch (error) {
        console.error(
          `Error al consultar nodo ${node.ip}:${node.port}:`,
          error.message
        );
        await pool.query(
          'UPDATE storage_nodes SET status = "inactive" WHERE id = ?',
          [node.id]
        );
      }
    }

    if (!availableNode) {
      throw new Error("No hay nodos con espacio disponible o están inactivos");
    }

    return availableNode;
  } catch (error) {
    throw error;
  }
}

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No se proporcionó ninguna imagen" });
    }

    const { filename, originalname, mimetype, size, path: tempPath } = req.file;

    const bestNode = await getBestStorageNode();

    if (size > bestNode.availableSpace) {
      return res.status(400).json({
        error: "El tamaño de la imagen excede el espacio disponible",
      });
    }

    const fileBuffer = fs.readFileSync(tempPath);

    const formData = new FormData();
    formData.append("image", fs.createReadStream(tempPath), {
      filename: originalname,
      contentType: mimetype,
    });
    const uploadResponse = await axios.post(
      `http://${bestNode.ip}:${bestNode.port}/upload`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );

    const [result] = await pool.query(
      "INSERT INTO images (filename, original_name, size, mime_type, node_id, path) VALUES (?, ?, ?, ?, ?, ?)",
      [
        uploadResponse.data.filename,
        originalname,
        size,
        mimetype,
        bestNode.id,
        uploadResponse.data.path,
      ]
    );

    await pool.query(
      "UPDATE storage_nodes SET available_storage = available_storage - ? WHERE id = ?",
      [size, bestNode.id]
    );

    fs.unlinkSync(tempPath);

    res.status(201).json({
      id: result.insertId,
      filename: uploadResponse.data.filename,
      originalName: originalname,
      size,
      nodeId: bestNode.id,
    });
  } catch (error) {
    console.error("Error al subir imagen:", error);

    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error(
          "Error al eliminar archivo temporal después de un fallo:",
          unlinkError
        );
      }
    }

    if (error.response) {
      res.status(500).json({
        error: "Error en el nodo de almacenamiento",
        details: error.response.data || error.response.statusText,
      });
    } else if (error.request) {
      res.status(500).json({
        error: "No se pudo conectar con el nodo de almacenamiento",
        details: error.message,
      });
    } else {
      res.status(500).json({
        error: "Error al procesar la solicitud",
        details: error.message,
      });
    }
  }
});

app.get("/images", async (req, res) => {
  try {
    const [images] = await pool.query(`
      SELECT i.*, s.ip, s.port 
      FROM images i
      JOIN storage_nodes s ON i.node_id = s.id
      ORDER BY i.created_at DESC
    `);

    res.json(images);
  } catch (error) {
    console.error("Error al listar imágenes:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

app.get("/images/:id", async (req, res) => {
  try {
    const [images] = await pool.query(
      `SELECT i.*, s.ip, s.port 
       FROM images i
       JOIN storage_nodes s ON i.node_id = s.id
       WHERE i.id = ?`,
      [req.params.id]
    );

    if (images.length === 0) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    const image = images[0];

    const response = await axios.get(
      `http://${image.ip}:${image.port}/images/${image.filename}`,
      { responseType: "arraybuffer" }
    );

    res.set("Content-Type", image.mime_type);
    res.set("Content-Disposition", `inline; filename="${image.original_name}"`);
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error("Error al obtener imagen:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

app.delete("/images/:id", async (req, res) => {
  try {
    const [images] = await pool.query(
      `SELECT i.*, s.ip, s.port 
       FROM images i
       JOIN storage_nodes s ON i.node_id = s.id
       WHERE i.id = ?`,
      [req.params.id]
    );

    if (images.length === 0) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    const image = images[0];

    await axios.delete(
      `http://${image.ip}:${image.port}/images/${image.filename}`
    );

    await pool.query(
      "UPDATE storage_nodes SET available_storage = available_storage + ? WHERE id = ?",
      [image.size, image.node_id]
    );

    await pool.query("DELETE FROM images WHERE id = ?", [req.params.id]);

    res.json({ message: "Imagen eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar imagen:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

async function initializeApp() {
  try {
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads");
    }
    let connected = false;
    let retries = 0;
    const maxRetries = 10;

    while (!connected && retries < maxRetries) {
      try {
        console.log(`Intentando conectar a MySQL (intento ${retries + 1})...`);
        await pool.query("SELECT 1");
        connected = true;
        console.log("Conexión a MySQL establecida correctamente.");
      } catch (error) {
        retries++;
        console.log(
          `Error al conectar a MySQL: ${error.message}. Reintentando en 5 segundos...`
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    if (!connected) {
      throw new Error("No se pudo conectar a MySQL después de varios intentos");
    }

    await loadStorageNodes();

    app.listen(PORT, () => {
      console.log(`Middleware escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error("Error al inicializar la aplicación:", error);
  }
}

app.get("/", (req, res) => {
  res.send("Hola mundo");
});

initializeApp();