const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

function addNewNode(nodeNumber) {
  const projectRoot = path.resolve(__dirname, "..");

  const nodeDirPath = path.join(projectRoot, `storage-node-${nodeNumber}-data`);
  if (!fs.existsSync(nodeDirPath)) {
    fs.mkdirSync(nodeDirPath, { recursive: true });
    console.log(` Directorio creado: ${nodeDirPath}`);
  }

  const dockerComposePath = path.join(projectRoot, "docker-compose.yml");
  const dockerComposeContent = fs.readFileSync(dockerComposePath, "utf8");

  const dockerCompose = yaml.load(dockerComposeContent);

  dockerCompose.services[`storage-node-${nodeNumber}`] = {
    build: "./storage-node",
    ports: [`${3002 + nodeNumber - 1}:3002`],
    environment: [
      `NODE_ID=${nodeNumber}`,
      "MAX_STORAGE=104857600", 
    ],
    volumes: [`./storage-node-${nodeNumber}-data:/app/src/storage`],
    networks: ["app-network"],
  };

  fs.writeFileSync(dockerComposePath, yaml.dump(dockerCompose), "utf8");
  console.log(`Actualizado: ${dockerComposePath}`);

  const nodesFilePath = path.join(
    projectRoot,
    "middleware",
    "src",
    "config",
    "nodes.txt"
  );
  let nodesContent = fs.readFileSync(nodesFilePath, "utf8");

  if (!nodesContent.includes(`storage-node-${nodeNumber}:3002`)) {
    nodesContent += `\nstorage-node-${nodeNumber}:3002`;
    fs.writeFileSync(nodesFilePath, nodesContent, "utf8");
    console.log(`Actualizado: ${nodesFilePath}`);
  }

  console.log(`Nodo ${nodeNumber} añadido correctamente.`);
  console.log("\nPara iniciar el nuevo nodo, ejecuta:");
  console.log("docker-compose up -d");
}

const nodeNumber = process.argv[2];

if (!nodeNumber || isNaN(parseInt(nodeNumber))) {
  console.error("Error: Debes proporcionar un número de nodo válido");
  console.log("Uso: node add-node.js <número-de-nodo>");
  process.exit(1);
}

addNewNode(parseInt(nodeNumber));
