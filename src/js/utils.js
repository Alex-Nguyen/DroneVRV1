const center_LAT = 33.5845,
  center_LON = -101.875;

export const config = {
  zoom: 15,
  speed: 1,
  agent: {
    x: -206,
    y: 248.44,
    z: 0
  },
  plane: {
    width: 1024,
    height: 512
  },
  grid: {
    rows: 128,
    cols: 256,
    cellSize: 4,
    centerX: 512,
    centerY: 256
  }
};
const deg2rad = deg => {
  return deg * (Math.PI / 180);
};
export const mercatorY = lat => {
  lat = deg2rad(lat);
  return (
    (256 / Math.PI) *
    Math.pow(2, config.zoom) *
    (Math.PI - Math.log(Math.tan(Math.PI / 4 + lat / 2)))
  );
};
export const mercatorX = lon => {
  lon = deg2rad(lon);
  return (256 / Math.PI) * Math.pow(2, config.zoom) * (lon + Math.PI);
};
const cx = mercatorX(center_LON);
const cy = mercatorY(center_LAT);
export const boardGrid = (rows, cols) => {
  let boards = [];
  for (let y = 0; y < rows; y++) {
    boards[y] = [];
    for (let x = 0; x < cols; x++) {
      boards[y][x] = 0;
    }
  }
  return boards;
};
export const updateGrid = (boards, highways) => {
  for (let highway of highways) {
    for (let n = 0; n < highway.nodes.length - 1; n++) {
      let x1 = mercatorX(highway.nodes[n].ref.lon) - cx + config.grid.centerX;
      let y1 = mercatorY(highway.nodes[n].ref.lat) - cy + config.grid.centerY;

      let x2 =
        mercatorX(highway.nodes[n + 1].ref.lon) - cx + config.grid.centerX;
      let y2 =
        mercatorY(highway.nodes[n + 1].ref.lat) - cy + config.grid.centerY;

      let distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      let directionX = x2 - x1;
      let directionY = y2 - y1;

      var signX = Math.sign(directionX);
      var signY = Math.sign(directionY);
      var deltaX = directionX / distance;
      var deltaY = directionY / distance;
      for (
        let x = x1, y = y1;; x = x + deltaX * config.speed, y = y + deltaY * config.speed
      ) {
        if (signX === Math.sign(x2 - x) && signY === Math.sign(y2 - y)) {
          let rowY = Math.round(y / config.grid.cellSize);
          let colX = Math.round(x / config.grid.cellSize);
          if (
            colX >= 0 &&
            colX < config.grid.cols &&
            rowY >= 0 &&
            rowY < config.grid.rows
          ) {
            boards[rowY][colX] = 1;
          }
        } else {
          break;
        }
      }
    }
  }

  return boards;
};
export const lonToGridX = lon => {
  return mercatorX(lon) - cx + config.grid.centerX;
};
export const latToGridY = lat => {
  return mercatorY(lat) - cy + config.grid.centerY;
};
export const create3Dmatrix = (x, y, z) => {
  let matrix = [];
  for (let k = 0; k < z; k++) {
    let h = [];
    for (let j = 0; j < y; j++) {
      let m = [];
      for (let i = 0; i < x; i++) {
        let neighbours = [];
        let currentIndex = i + j * y + k * x * y;
        let _left = (i - 1) == -1 ? null : currentIndex - 1;
        let _right = (i + 1) == x ? null : currentIndex + 1;
        let _top = (j - 1) == -1 ? null : i + (j - 1) * y + k * x * y;
        let _bottom = (j + 1) == y ? null : i + (j + 1) * y + k * x * y;
        let _down = (k - 1) == -1 ? null : i + j * y + (k - 1) * x * y;
        let _up = (k + 1) == z ? null : i + j * y + (k + 1) * x * y;
        if (_left != null) neighbours.push(_left);
        if (_right != null) neighbours.push(_right);
        if (_top != null) neighbours.push(_top);
        if (_bottom != null) neighbours.push(_bottom);
        if (_up != null) neighbours.push(_up);
        if (_down != null) neighbours.push(_down);
        m.push({
          x: i,
          y: j,
          z: k,
          walkable: 0, //true and 1 =false
          node: i + j * y + k * x * y,
          n_left: _left,
          n_right: _right,
          n_top: _top,
          n_bottom: _bottom,
          n_up: _up,
          n_down: _down,
          n_neighbours: neighbours
        })
      }
      h.push(m);
    }
    matrix.push(h);
  }
  return matrix;
}