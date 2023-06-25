import { memory } from "wasm-game-of-life/wasm_game_of_life_bg";

// To access directly to the shader attributes
const aPositionLoc = 0;
const aPointSizeLoc = 1;
const aColorLoc = 2;

export const vertexShaderSrc = `#version 300 es

layout(location=0) in vec4 aPosition;
layout(location=1) in float aPointSize;
layout(location=2) in vec4 aColor;

out vec4 vColor;

void main()
{
	vColor = aColor;
	gl_PointSize = aPointSize;
	gl_Position = aPosition;
}`;

export const fragmentShaderSrc = `#version 300 es

precision mediump float;

in vec4 vColor;

out vec4 fragColor;

void main()
{
	fragColor = vColor;
}`;

export function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

export function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

function convertRange(value, r1, r2) {
  return ((value - r1[0]) * (r2[1] - r2[0])) / (r1[1] - r1[0]) + r2[0];
}

const createGridLinesCoordinates = (width, height) => {
  var nVerticalLinesCoords = (width + 1) * 4;
  var nHorizontalLinesCoords = (height + 1) * 4;
  var totalLinesCoords = nVerticalLinesCoords + nHorizontalLinesCoords;
  var linesCoords = new Float32Array(totalLinesCoords);
  for (let i = 0; i <= width; i++) {
    let x_pos = convertRange(i / width, [0, 1], [-1, 1]);
    let line_offset = i * 4;
    linesCoords[line_offset] = x_pos;
    linesCoords[line_offset + 1] = 1;
    linesCoords[line_offset + 2] = x_pos;
    linesCoords[line_offset + 3] = -1;
  }

  for (let j = 0; j <= height; j++) {
    let y_pos = convertRange(j / height, [0, 1], [-1, 1]);
    let line_offset = nVerticalLinesCoords + j * 4;
    linesCoords[line_offset] = -1;
    linesCoords[line_offset + 1] = y_pos;
    linesCoords[line_offset + 2] = 1;
    linesCoords[line_offset + 3] = y_pos;
  }
  return linesCoords;
};

const createGrid = (gl, gridLinesData) => {
  // Create a Vertex Array Object to store the grid
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.vertexAttrib1f(aPointSizeLoc, 1);
  gl.vertexAttrib4f(aColorLoc, 0, 0, 0, 1);

  var vertBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, gridLinesData, gl.STATIC_DRAW);

  gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 8, 0);

  gl.enableVertexAttribArray(aPositionLoc);

  gl.bindVertexArray(null);

  return vao;
};

var grid_vao = null;
var nGridLines = -1;
export function initGrid(gl, universe) {
  const gridLinesData = createGridLinesCoordinates(
    universe.width(),
    universe.height()
  );
  nGridLines = gridLinesData.length / 2;
  grid_vao = createGrid(gl, gridLinesData);
}

export const drawGrid = (gl) => {
  // Draw the static grid using the Vertex Array Object
  gl.bindVertexArray(grid_vao);
  gl.drawArrays(gl.LINES, 0, nGridLines);
  gl.bindVertexArray(null);
};

const getIndex = (universe_width, row, column) => {
  return row * universe_width + column;
};

const bitIsSet = (n, arr) => {
  const byte = Math.floor(n / 8);
  const mask = 1 << n % 8;
  return (arr[byte] & mask) === mask;
};

export const drawCells = (gl, universe) => {
  const cellsPtr = universe.cells();

  // Get the new universe state from the shared memory buffer with WASM
  const cells = new Uint8Array(memory.buffer, cellsPtr, universe.size() / 8);

  var aliveCellsCoords = [];
  const universe_width = universe.width();
  const universe_height = universe.height();

  for (let row = 0; row < universe_height; row++) {
    for (let col = 0; col < universe_width; col++) {
      const idx = getIndex(universe_width, row, col);
      if (bitIsSet(idx, cells)) {
        // Top left vertex
        let topLeftX = convertRange(col / universe_width, [0, 1], [-1, 1]);
        let topLeftY = -convertRange(row / universe_height, [0, 1], [-1, 1]);
        // Top right vertex
        let topRightX = convertRange(
          (col + 1) / universe_width,
          [0, 1],
          [-1, 1]
        );
        let topRightY = topLeftY;
        // Bottom left vertex
        let bottomLeftX = topLeftX;
        let bottomLeftY = -convertRange(
          (row + 1) / universe_height,
          [0, 1],
          [-1, 1]
        );
        // Bottom right vertex
        let bottomRightX = topRightX;
        let bottomRightY = bottomLeftY;
        // Push the coordintates to create the two triangles that form the square
        aliveCellsCoords.push(
          topLeftX,
          topLeftY,
          topRightX,
          topRightY,
          bottomRightX,
          bottomRightY,
          topLeftX,
          topLeftY,
          bottomRightX,
          bottomRightY,
          bottomLeftX,
          bottomLeftY
        );
      }
    }
  }

  const aliveCellsData = new Float32Array(aliveCellsCoords);
  var vertBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, aliveCellsData, gl.DYNAMIC_DRAW);

  gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPositionLoc);

  gl.drawArrays(gl.TRIANGLES, 0, aliveCellsData.length / 2);
};
