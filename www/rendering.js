import { memory } from "wasm-game-of-life/wasm_game_of_life_bg";

// To access directly to the shader attributes
const aPositionLoc = 0;
const aPointSizeLoc = 1;
const aColorLoc = 2;
const aOffsetLoc = 3;

// Define the shaders code
export const vertexShaderSrc = `#version 300 es
#pragma vscode_glsllint_stage: vert

layout(location=0) in vec4 aPosition;
layout(location=1) in float aPointSize;
layout(location=2) in vec4 aColor;
layout(location=3) in vec3 aOffset;

out vec4 vColor;

void main()
{
	vColor = aColor;
	gl_PointSize = aPointSize;
    gl_Position = vec4(aPosition.xyz + aOffset, 1.0);
}`;
export const fragmentShaderSrc = `#version 300 es

precision mediump float;

in vec4 vColor;

out vec4 fragColor;

void main()
{
	fragColor = vColor;
}`;

// Utility function to prepare a shader
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

// Utility function to prepare a WebGL program
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

// Convert a value in range r1 to the range r2
function convertRange(value, r1, r2) {
    return ((value - r1[0]) * (r2[1] - r2[0])) / (r1[1] - r1[0]) + r2[0];
}

// Auxiliary variables to store constant objects
var verticalGridLinesVAO = null;
var horizontalGridLinesVAO = null;
var nHorizontalLines = -1;
var nVerticalLines = -1;
// Computes and prepares the grid of the universe. This function only has to be called once
export function initGrid(gl, universe) {
    // Get universe dimensions to compute the grid lines positioning
    const width = universe.width();
    const height = universe.height();
    nVerticalLines = width + 1;
    nHorizontalLines = height + 1;

    // Prepare the data to draw the vertical lines
    const verticalLineData = new Float32Array([-1, 1, -1, -1]);
    const verticalLinesOffsetData = new Float32Array(nVerticalLines * 2);
    let verticalLinesSpace = 2 / width;
    let curr_offset = 0.0;
    for (let i = 0; i <= width; i++) {
        verticalLinesOffsetData[2 * i] = curr_offset;
        verticalLinesOffsetData[2 * i + 1] = 0;
        curr_offset += verticalLinesSpace;
    }

    // Prepare the data to draw the horizontal lines
    const horizontalLineData = new Float32Array([-1, 1, 1, 1]);
    const horizontalLinesOffsetData = new Float32Array(nHorizontalLines * 2);
    let horizontalLinesSpace = 2 / height;
    curr_offset = 0.0;
    for (let i = 0; i <= height; i++) {
        horizontalLinesOffsetData[2 * i] = 0;
        horizontalLinesOffsetData[2 * i + 1] = curr_offset;
        curr_offset -= horizontalLinesSpace;
    }

    // Create a Vertex Array Object to store the vertical lines
    verticalGridLinesVAO = gl.createVertexArray();
    gl.bindVertexArray(verticalGridLinesVAO);

    // Set common attributes
    gl.vertexAttrib1f(aPointSizeLoc, 1);
    gl.vertexAttrib4f(aColorLoc, 0, 0, 0, 1);

    // Create the buffer to store the vertical line model
    var verticalLineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, verticalLineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verticalLineData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPositionLoc);
    // Create the buffer to store the vertical lines offsets
    var verticalOffsetBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, verticalOffsetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verticalLinesOffsetData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(aOffsetLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aOffsetLoc);
    gl.vertexAttribDivisor(aOffsetLoc, 1);

    gl.bindVertexArray(null);

    // Create a Vertex Array Object to store the horizontal lines
    horizontalGridLinesVAO = gl.createVertexArray();
    gl.bindVertexArray(horizontalGridLinesVAO);

    // Set common attributes
    gl.vertexAttrib1f(aPointSizeLoc, 1);
    gl.vertexAttrib4f(aColorLoc, 0, 0, 0, 1);

    // Create the buffer to store the horizontal line model
    var horizontalLineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, horizontalLineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, horizontalLineData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPositionLoc);
    // Create the buffer to store the horizontal lines offsets
    var horizontalOffsetBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, horizontalOffsetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, horizontalLinesOffsetData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(aOffsetLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aOffsetLoc);
    gl.vertexAttribDivisor(aOffsetLoc, 1);

    gl.bindVertexArray(null);
}

// Render the already computed grid using WebGL
export const drawGrid = (gl) => {
    // Draw grid vertical lines
    gl.bindVertexArray(verticalGridLinesVAO);
    gl.drawArraysInstanced(gl.LINES, 0, 2, nVerticalLines);
    gl.bindVertexArray(null);
    // Draw grid horizontal lines
    gl.bindVertexArray(horizontalGridLinesVAO);
    gl.drawArraysInstanced(gl.LINES, 0, 2, nHorizontalLines);
    gl.bindVertexArray(null);
};

// Convert from universe row-col coordinates to an index in the universe data array
const getIndex = (universe_width, row, column) => {
    return row * universe_width + column;
};

// Efficient check for alive cells
const bitIsSet = (n, arr) => {
    const byte = Math.floor(n / 8);
    const mask = 1 << n % 8;
    return (arr[byte] & mask) === mask;
};

// Get the current universe cells state and render them
export const drawCells = (gl, universe) => {
    // Get the new universe state
    const cells = new Uint8Array(
        memory.buffer,
        universe.cells(),
        universe.size() / 8
    );

    // Look for all the alive cells and store the pixels coordinates of the triangles
    // to draw the cell square
    var aliveCellsCoords = [];
    const universe_width = universe.width();
    const universe_height = universe.height();
    for (let row = 0; row < universe_height; row++) {
        for (let col = 0; col < universe_width; col++) {
            const idx = getIndex(universe_width, row, col);
            // If is alive
            if (bitIsSet(idx, cells)) {
                // Top left vertex
                let topLeftX = convertRange(
                    col / universe_width,
                    [0, 1],
                    [-1, 1]
                );
                let topLeftY = -convertRange(
                    row / universe_height,
                    [0, 1],
                    [-1, 1]
                );
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
                // Push the coordinates to create the two triangles that form the square
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

    // Prepare the WebGL buffer with the triangles data
    const aliveCellsData = new Float32Array(aliveCellsCoords);
    var vertBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, aliveCellsData, gl.DYNAMIC_DRAW);
    // Prepare the attribute to position the triangles vertices
    gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPositionLoc);
    // Render the alive cells as triangles
    gl.drawArrays(gl.TRIANGLES, 0, aliveCellsData.length / 2);
};
