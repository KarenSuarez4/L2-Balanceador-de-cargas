# Sistema de Gestión de Imágenes Distribuido con Balanceo de Cargas

Sistema distribuido de almacenamiento y gestión de imágenes con balanceo de cargas automático, desarrollado con Node.js, Express y Docker. Implementa una arquitectura de microservicios con múltiples nodos de almacenamiento y un middleware inteligente para la distribución de carga.

## Contenidos

- [Características](#-características)
- [Arquitectura](#-arquitectura)
- [Tecnologías](#-tecnologías)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Uso](#-uso)
- [API Reference](#-api-reference)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Configuración](#-configuración)

## ✨ Características

- **Balanceo de Cargas Automático**: Distribución inteligente de imágenes entre múltiples nodos de almacenamiento
- **Alta Disponibilidad**: Sistema de fallback automático si un nodo falla
- **Arquitectura Distribuida**: Múltiples nodos de almacenamiento independientes
- **Interfaz Web Intuitiva**: Dashboard moderno para gestionar imágenes
- **Almacenamiento Escalable**: Fácil adición de nuevos nodos de almacenamiento
- **Monitoreo en Tiempo Real**: Visualización del espacio disponible en cada nodo
- **Persistencia de Datos**: Base de datos MySQL para metadatos
- **Gestión Completa**: Upload, visualización, descarga y eliminación de imágenes
- **Dockerizado**: Despliegue simple con Docker Compose

## 🏗️ Arquitectura

El sistema está compuesto por 5 componentes principales:

```
┌─────────────┐
│   Frontend  │ (Puerto 3000)
│  (Express)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Middleware  │ (Puerto 3001)
│  (Balancer) │ ← Lógica de balanceo
└──────┬──────┘
       │
       ├───────────┬───────────┬───────────┐
       ▼           ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Node 1  │ │  Node 2  │ │  Node 3  │ │  MySQL   │
│ (3002)   │ │ (3003)   │ │ (3004)   │ │ (3306)   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Componentes

1. **Frontend**: Interfaz web con Bootstrap 5 para interacción del usuario
2. **Middleware**: Servidor de balanceo que:
   - Recibe solicitudes del frontend
   - Selecciona el nodo óptimo según espacio disponible
   - Gestiona metadatos en MySQL
   - Coordina operaciones CRUD
3. **Storage Nodes**: Nodos independientes de almacenamiento (3 por defecto)
4. **MySQL**: Base de datos para metadatos de imágenes y estado de nodos

## 🛠️ Tecnologías

### Backend
- **Node.js** v18+
- **Express.js** - Framework web
- **MySQL 8.0** - Base de datos relacional
- **Multer** - Manejo de uploads multipart/form-data
- **Axios** - Cliente HTTP
- **UUID** - Generación de identificadores únicos

### Frontend
- **HTML5/CSS3**
- **Bootstrap 5** - Framework CSS
- **Bootstrap Icons** - Iconografía
- **Vanilla JavaScript** - Lógica del cliente

### DevOps
- **Docker & Docker Compose** - Containerización
- **Volumes** - Persistencia de datos

## 📦 Requisitos Previos

- [Docker](https://www.docker.com/) v20.10+
- [Docker Compose](https://docs.docker.com/compose/) v2.0+
- Puertos disponibles: 3000, 3001, 3002, 3003, 3004, 3306

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/KarenSuarez4/L2-Balanceador-de-cargas.git
cd L2-Balanceador-de-cargas
```

### 2. Levantar el sistema con Docker Compose

```bash
docker-compose up -d
```

Este comando:
- Construye todas las imágenes necesarias
- Crea la red bridge `app-network`
- Inicia los 5 contenedores
- Inicializa la base de datos con el esquema

### 3. Verificar que los servicios están corriendo

```bash
docker-compose ps
```

Deberías ver 5 servicios en estado `running`:
- `frontend`
- `middleware`
- `mysql`
- `storage-node-1`
- `storage-node-2`
- `storage-node-3`

### 4. Acceder a la aplicación

Abre tu navegador en: **http://localhost:3000**

## 💻 Uso

### Subir Imágenes

1. Accede al dashboard en `http://localhost:3000`
2. Arrastra y suelta imágenes o haz clic en "Seleccionar Imágenes"
3. Las imágenes se distribuirán automáticamente entre los nodos disponibles

### Ver Imágenes

- El dashboard muestra todas las imágenes almacenadas en cards
- Información visible: nombre, tamaño, nodo, fecha de subida

### Visualizar/Descargar

- Haz clic en cualquier imagen para ver el modal con preview
- Botón "Descargar" para guardar la imagen localmente

### Eliminar Imágenes

- En el modal de vista previa, haz clic en el botón "Eliminar"
- El sistema liberará el espacio en el nodo correspondiente

## 📡 API Reference

### Middleware Endpoints (Puerto 3001)

#### `POST /upload`
Sube una imagen al sistema

**Request:**
```http
POST /upload HTTP/1.1
Content-Type: multipart/form-data

image: [archivo]
```

**Response:**
```json
{
  "message": "Imagen subida correctamente",
  "id": 1,
  "filename": "uuid-nombre.jpg",
  "nodeId": 2
}
```

#### `GET /images`
Obtiene todas las imágenes almacenadas

**Response:**
```json
[
  {
    "id": 1,
    "filename": "uuid-nombre.jpg",
    "original_name": "foto.jpg",
    "size": 245678,
    "mime_type": "image/jpeg",
    "node_id": 2,
    "path": "/app/src/storage/...",
    "created_at": "2025-01-15T10:30:00Z",
    "ip": "storage-node-2",
    "port": 3002
  }
]
```

#### `GET /images/:id`
Obtiene una imagen específica (devuelve el binario)

**Response:**
```
Content-Type: image/jpeg
[Binary data]
```

#### `DELETE /images/:id`
Elimina una imagen del sistema

**Response:**
```json
{
  "message": "Imagen eliminada correctamente"
}
```

### Storage Node Endpoints (Puertos 3002, 3003, 3004)

#### `GET /available-space`
Obtiene información del espacio disponible

**Response:**
```json
{
  "maxStorage": 104857600,
  "usedStorage": 25678900,
  "availableSpace": 79178700,
  "nodeId": "1"
}
```

#### `POST /upload`
Sube una imagen al nodo (uso interno del middleware)

#### `GET /images/:filename`
Descarga una imagen del nodo

#### `DELETE /images/:filename`
Elimina una imagen del nodo

## 📁 Estructura del Proyecto

```
L2-Balanceador-de-cargas/
├── frontend/
│   ├── public/
│   │   ├── index.html          # Interfaz principal
│   │   └── css/
│   │       └── stiles.css       # Estilos personalizados
│   ├── src/
│   │   └── server.js           # Servidor Express del frontend
│   ├── Dockerfile
│   └── package.json
│
├── middleware/
│   ├── src/
│   │   ├── server.js           # Lógica de balanceo de cargas
│   │   └── config/
│   │       └── nodes.txt       # Configuración de nodos
│   ├── uploads/                # Directorio temporal
│   ├── Dockerfile
│   └── package.json
│
├── storage-node/
│   ├── src/
│   │   ├── server.js           # API del nodo de almacenamiento
│   │   └── storage/            # Almacenamiento de imágenes
│   ├── Dockerfile
│   └── package.json
│
├── database/
│   ├── init.sql                # Schema de la base de datos
│   └── Dockerfile
│
├── docker-compose.yml          # Orquestación de servicios
├── .gitignore
└── README.md
```

## ⚙️ Configuración

### Variables de Entorno

#### Middleware
```env
MYSQL_HOST=mysql
MYSQL_USER=user
MYSQL_PASSWORD=password
MYSQL_DATABASE=image_manager
PORT=3001
```

#### Storage Nodes
```env
NODE_ID=1                      # ID único del nodo
MAX_STORAGE=104857600          # 100MB en bytes
PORT=3002
```

### Configuración de Nodos

Edita `middleware/src/config/nodes.txt` para agregar/modificar nodos:

```
storage-node-1:3002
storage-node-2:3002
storage-node-3:3002
storage-node-4:3002  # Nuevo nodo
```

### Esquema de Base de Datos

```sql
-- Tabla de imágenes
CREATE TABLE images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  size INT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  node_id INT NOT NULL,
  path VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de nodos de almacenamiento
CREATE TABLE storage_nodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(50) NOT NULL,
  port INT NOT NULL,
  max_storage INT NOT NULL,
  available_storage INT NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 🔍 Algoritmo de Balanceo

El middleware implementa un algoritmo de **balanceo por espacio disponible**:

1. Consulta todos los nodos registrados en la base de datos
2. Ordena los nodos por espacio disponible (DESC)
3. Intenta conectar con cada nodo en orden
4. Selecciona el primer nodo que:
   - Responde correctamente
   - Tiene espacio disponible > 0
5. Si un nodo falla, marca como inactivo y prueba el siguiente
6. Actualiza el espacio disponible después de cada operación

```javascript
// Pseudocódigo simplificado
async function getBestStorageNode() {
  nodes = await getNodesOrderedBySpace();
  
  for (node of nodes) {
    if (await node.isAvailable() && node.space > 0) {
      return node;
    }
  }
  
  throw new Error("No hay nodos disponibles");
}
```

## 🧪 Testing

Para probar el sistema manualmente:

```bash
# Subir una imagen
curl -X POST http://localhost:3001/upload \
  -F "image=@/path/to/image.jpg"

# Listar imágenes
curl http://localhost:3001/images

# Ver espacio disponible en un nodo
curl http://localhost:3002/available-space
```

## 🐛 Troubleshooting

### Los contenedores no inician
```bash
docker-compose down -v
docker-compose up --build -d
```

### Error de conexión a MySQL
Espera 10-15 segundos después de iniciar los contenedores para que MySQL termine de inicializarse.

### Un nodo no responde
Revisa los logs:
```bash
docker-compose logs storage-node-1
```

### Resetear todo el sistema
```bash
docker-compose down -v
rm -rf storage-node-*-data/
docker-compose up --build -d
```

## 📈 Escalabilidad

Para agregar más nodos de almacenamiento:

1. Edita `docker-compose.yml`:

```yaml
storage-node-4:
  build: ./storage-node
  ports:
    - "3005:3002"
  environment:
    - NODE_ID=4
    - MAX_STORAGE=104857600
  volumes:
    - ./storage-node-4-data:/app/src/storage
  networks:
    - app-network
```

2. Actualiza `middleware/src/config/nodes.txt`:

```
storage-node-4:3002
```

3. Reinicia el sistema:

```bash
docker-compose up -d
```

## 👥 Autores

- **Karen Suarez** - [@KarenSuarez4](https://github.com/KarenSuarez4)
- **Ronald Molinares** - [@Ronaldmolinares](https://github.com/Ronaldmolinares)
- **Lunna Sosa** - [@lunna21](https://github.com/lunna21)

---

**Universidad Pedagógica y Tecnológica de Colombia (UPTC)** 
Sistemas Distribuidos
*Sistema de Balanceo de Cargas - L2*
