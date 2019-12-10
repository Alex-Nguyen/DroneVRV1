import * as THREE from "three";
import OrbitControls from "three-orbitcontrols";
import Maptexture from "./Maptexture";
import * as PF from "./pathfinding-browser"
import {
  mercatorX,
  mercatorY,
  config,
  boardGrid,
  updateGrid,
} from "./utils";
import * as d3 from "d3";
import {
  astar,
  Graph
} from "./astar";
const config = {
  xpad: 2,
  ypad: 1,
  zpad: 2
};
const create3Dmatrix = (x, y, z) => {
  let matrix = [];
  for (let k = 0; k < y; k++) {
    let h = [];
    for (let j = 0; j < z; j++) {
      let m = [];
      for (let i = 0; i < x; i++) {
        let neighbours = [];
        let currentIndex = i + j * z + k * x * z;
        let _left = i - 1 === -1 ? null : currentIndex - 1;
        let _right = i + 1 === x ? null : currentIndex + 1;
        let _top = j - 1 === -1 ? null : i + (j - 1) * z + k * x * z;
        let _bottom = j + 1 === z ? null : i + (j + 1) * z + k * x * z;
        let _down = k - 1 === -1 ? null : i + j * z + (k - 1) * x * z;
        let _up = k + 1 === z ? null : i + j * z + (k + 1) * x * z;
        if (_left != null) neighbours.push(_left);
        if (_right != null) neighbours.push(_right);
        if (_top != null) neighbours.push(_top);
        if (_bottom != null) neighbours.push(_bottom);
        if (_up != null) neighbours.push(_up);
        if (_down != null) neighbours.push(_down);
        m.push({
          x: i,
          y: k,
          z: j,
          x_2D: i * config.xpad,
          y_2D: k * config.ypad,
          z_2D: j * config.zpad,
          x_3D: i * config.xpad,
          y_3D: k * config.ypad,
          z_3D: j * config.zpad,
          walkable: 0, //true and 1 =false
          node: i + j * z + k * x * z,
          n_left: _left,
          n_right: _right,
          n_top: _top,
          n_bottom: _bottom,
          n_up: _up,
          n_down: _down,
          n_neighbours: neighbours
        });
      }
      h.push(m);
    }
    matrix.push(h);
  }
  return matrix;
};

function updateNodes(mat, currentNodes) {
  let nodes = currentNodes;
  mat.forEach(function (y) {
    y.forEach(function (z) {
      z.forEach(function (n) {
        if (n.walkable == 0) {
          //If a node is not walkable then no neighbours
          n.n_neighbours.forEach(nb => {
            if (mat[n.y][n.z][n.x].walkable == 0) {
              //If its default neighbour is not walkable then pass else update
              nodes[n.node].neighbors.push(nodes[nb]);
            }
          });
        }
      });
    });
  });
  return nodes;
}

function fillNodeData(mat) {
  let nodes = [];
  mat.forEach(function (y) {
    y.forEach(function (z) {
      z.forEach(function (n) {
        let node = new PF.Node(n.x_3D, n.y_3D, n.z_3D);
        node.indexX = n.x;
        node.indexY = n.y;
        node.indexZ = n.z;
        nodes.push(node);
      });
    });
  });
  return nodes;
}
let center_LAT = 33.5845,
  center_LON = -101.875;
const cx = mercatorX(center_LON),
  cy = mercatorY(center_LAT);
const VR_CANVAS_WIDTH = window.innerWidth,
  VR_CANVAS_HEIGHT = window.innerHeight;
const OBJECTS_INTERSECTS = [];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  VR_CANVAS_WIDTH / VR_CANVAS_HEIGHT,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true
});
renderer.setSize(VR_CANVAS_WIDTH, VR_CANVAS_HEIGHT);
const controls = new OrbitControls(camera, renderer.domElement);

controls.enableZoom = true;
document.body.appendChild(renderer.domElement);

const planeGeometry = new THREE.PlaneGeometry(1024, 512);
let planeTexture = new THREE.TextureLoader().load(
  Maptexture(center_LON, center_LAT, config.zoom)
);
const planeMat = new THREE.MeshBasicMaterial({
  map: planeTexture
});
const planeMesh = new THREE.Mesh(planeGeometry, planeMat);
scene.add(planeMesh);

OBJECTS_INTERSECTS.push(planeMesh);
camera.position.z = 650;

d3.xml("./dist/bigarea.xml", (error, data) => {
  if (error) throw error;
  ////////Node Lists
  let nodeRef = [].map.call(data.querySelectorAll("node"), n => ({
    id: n.getAttribute("id"),
    lat: n.getAttribute("lat"),
    lon: n.getAttribute("lon")
  }));

  ///Way lists
  let ways = [].map.call(data.querySelectorAll("way"), way => ({
    id: way.getAttribute("id"),
    nodes: [].map.call(way.querySelectorAll("nd"), ref => ({
      ref: nodeRef.find(obj => obj.id === ref.getAttribute("ref"))
    })),
    type: [].map.call(way.querySelectorAll("tag"), tag =>
      tag.getAttribute("k")
    ),
    isBuilding: (function () {
      let _isBuilding = false;
      way.querySelectorAll("tag").forEach(tag => {
        let key = tag.getAttribute("k");
        if (key === "building") {
          _isBuilding = tag.getAttribute("v") === "yes";
        }
      });
      return _isBuilding;
    })(),
    height: (function () {
      let _height = 5;
      way.querySelectorAll("tag").forEach(tag => {
        let key = tag.getAttribute("k");
        if (key === "building:levels") {
          _height = 5 * tag.getAttribute("v");
        } else if (key === "building:height") {
          _height = tag.getAttribute("v");
        }
      });
      return _height;
    })()
  }));

  //Building list
  let buildings = ways.filter(way => way.isBuilding);
  let highways = ways.filter(way => way.type.includes("highway"));
  //Add building
  for (let building of buildings) {

    let shape = new THREE.Shape();
    for (let [index, node] of building.nodes.entries()) {
      let x = mercatorX(node.ref.lon) - cx;
      let y = cy - mercatorY(node.ref.lat);
      index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);

    }
    let shapeGeo = new THREE.ExtrudeBufferGeometry(shape, {
      steps: 2,
      depth: building.height,
      bevelEnabled: true,
      bevelThickness: 1,
      bevelSize: 1,
      bevelSegments: 1
    });
    let shapeMat = new THREE.MeshBasicMaterial({
      color: "#993333",
      opacity: 0.6,
      transparent: true
    });
    shapeGeo.computeBoundingBox();
    let shapeMesh = new THREE.Mesh(shapeGeo, shapeMat);
    scene.add(shapeMesh);
  }

  //Add highway
  for (let highway of highways) {
    const lineGeo = new THREE.Geometry();
    for (let node of highway.nodes) {
      let x = mercatorX(node.ref.lon) - cx;
      let y = cy - mercatorY(node.ref.lat);
      lineGeo.vertices.push(new THREE.Vector3(x, y, 0.3));
    }
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({
        color: 0x0000ff
      })
    );
    scene.add(line);
  }

  var matrix = create3Dmatrix(10, 3, 10);
  var nodes = fillNodeData(matrix);
  console.log(`matrix`,matrix);

  var grid = boardGrid(config.grid.rows, config.grid.cols);
  grid = updateGrid(grid, highways);
  let graph = new Graph(grid);
  let start = graph.grid[0][75];
  let end = graph.grid[100][114];
  var result = astar.search(graph, start, end);
  if (result.length > 0) {
    console.log("route found!");
    var startX = result[0].y * config.grid.cellSize - config.grid.centerX;
    var startY = config.grid.centerY - result[0].x * config.grid.cellSize;
    let AgentGeo = new THREE.SphereGeometry(5, 32, 32);
    let AgentMat = new THREE.MeshBasicMaterial({
      color: 0xffff00
    });
    var AgentMesh = new THREE.Mesh(AgentGeo, AgentMat);
    AgentMesh.position.set(startX, startY, 2.5);
    scene.add(AgentMesh);
  } else {
    console.log("No path found!");
  }

  var nextX, nextY;

  animate();

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);

    if (result.length > 0) {
      nextX = result[0].y * config.grid.cellSize - config.grid.centerX;
      nextY = config.grid.centerY - result[0].x * config.grid.cellSize;

      let distanceCRT = Math.sqrt(
        Math.pow(nextX - startX, 2) + Math.pow(nextY - startY, 2)
      );
      let deltaXCRT = (nextX - startX) / distanceCRT;
      let deltaYCRT = (nextY - startY) / distanceCRT;
      let currentdist = Math.sqrt(
        Math.pow(nextX - AgentMesh.position.x, 2) +
        Math.pow(nextY - AgentMesh.position.y, 2)
      );
      if (currentdist < 0.5) {
        startX = nextX;
        startY = nextY;
        result.shift();
      } else {
        AgentMesh.position.x += deltaXCRT * 0.5;
        AgentMesh.position.y += deltaYCRT * 0.5;
      }
    }
  }
});
document.addEventListener("click", onDocumentMouseDown, false);

function onDocumentMouseDown(event) {
  event.preventDefault();
  let raycaster = new THREE.Raycaster();
  let mouse = new THREE.Vector2();
  mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
  mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  let intersects = raycaster.intersectObjects(OBJECTS_INTERSECTS);
  if (intersects.length > 0) {
    let geometry = new THREE.SphereGeometry(5, 32, 32);
    let material = new THREE.MeshBasicMaterial({
      color: 0xffff00
    });
    let sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(
      intersects[0].point.x,
      intersects[0].point.y,
      intersects[0].point.z
    );
    scene.add(sphere);
  }
}