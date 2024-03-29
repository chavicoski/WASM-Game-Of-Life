import { Universe } from "wasm-game-of-life-webgl-rendering";
import {
    createShader,
    createProgram,
    vertexShaderSrc,
    fragmentShaderSrc,
    drawGrid,
    drawCells,
    initGrid,
} from "./rendering";

const CELL_SIZE = 10; // pixels
const UNIVERSE_WIDTH = 100;
const UNIVERSE_HEIGHT = 50;

// Initialize the universe
const universe = Universe.new(UNIVERSE_WIDTH, UNIVERSE_HEIGHT);

// Get the canvas HTML element to display the universe
const canvas = document.getElementById("game-of-life-canvas");
// Give the canvas room for all of our cells and a 1px border
// around each of them.
canvas.height = (CELL_SIZE + 1) * UNIVERSE_HEIGHT + 1;
canvas.width = (CELL_SIZE + 1) * UNIVERSE_WIDTH + 1;

// Get the WebGL 2.0 context to draw the universe
const gl = canvas.getContext("webgl2");

// Compile shaders and create the WebGL program for rendering
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
const program = createProgram(gl, vertexShader, fragmentShader);

// Enable the program
gl.useProgram(program);

// Initialize the grid to render the universe
initGrid(gl, universe);

// Handle the range slider to change the tick rate of the world
const ticksRange = document.getElementById("n_ticks");
ticksRange.addEventListener("input", () => {
    universe.set_ticks(ticksRange.value);
});

// Play/Pause game logic
const playPauseButton = document.getElementById("play-pause");
let animationId = null;

const isPaused = () => {
    return animationId === null;
};

const play = () => {
    playPauseButton.textContent = "⏸";
    renderLoop();
};

const pause = () => {
    playPauseButton.textContent = "▶";
    cancelAnimationFrame(animationId);
    animationId = null;
};

playPauseButton.addEventListener("click", () => {
    if (isPaused()) {
        play();
    } else {
        pause();
    }
});

// Handle the universe random reset button
const randomButton = document.getElementById("random-reset");
randomButton.addEventListener("click", () => {
    universe.reset();
    drawGrid(gl);
    drawCells(gl, universe);
});

// Handle the universe full clear button
const clearButton = document.getElementById("clear-reset");
clearButton.addEventListener("click", () => {
    universe.clear();
    drawGrid(gl);
    drawCells(gl, universe);
});

// Animation loop
const renderLoop = () => {
    // Keep track of the FPS metrics
    fps.render();

    // Compute the next state of the universe
    universe.update();

    // Draw the universe new state
    drawGrid(gl);
    drawCells(gl, universe);

    // Queue the next frame calculation
    animationId = requestAnimationFrame(renderLoop);
};

// Interactivity to toggle cells
canvas.addEventListener("click", (event) => {
    // Get the target row and col of the clicked cell
    const boundingRect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / boundingRect.width;
    const scaleY = canvas.height / boundingRect.height;

    const canvasLeft = (event.clientX - boundingRect.left) * scaleX;
    const canvasTop = (event.clientY - boundingRect.top) * scaleY;

    const row = Math.min(
        Math.floor(canvasTop / (CELL_SIZE + 1)),
        UNIVERSE_HEIGHT - 1
    );
    const col = Math.min(
        Math.floor(canvasLeft / (CELL_SIZE + 1)),
        UNIVERSE_WIDTH - 1
    );

    // Handle the user input keys
    if (event.ctrlKey || event.metaKey) {
        universe.create_glider(row, col);
    } else if (event.shiftKey) {
        universe.create_pulsar(row, col);
    } else {
        universe.toggle_cell(row, col);
    }

    // Update the universe render
    drawGrid(gl);
    drawCells(gl, universe);
});

// Auxiliary class to handle th fps stats
const fps = new (class {
    constructor() {
        this.fps = document.getElementById("fps");
        this.frames = [];
        this.lastFrameTimeStamp = performance.now();
        this.max_frames_history = 100;
    }

    render() {
        // Convert the delta time since the last frame render into a measure
        // of frames per second
        const now = performance.now();
        const delta = now - this.lastFrameTimeStamp;
        this.lastFrameTimeStamp = now;
        const fps = (1 / delta) * 1000;

        // Save only the latest this.max_frames_history timings
        this.frames.push(fps);
        if (this.frames.length > this.max_frames_history) {
            this.frames.shift();
        }

        // Find the max, min, and mean of our latest timings
        let min = Infinity;
        let max = -Infinity;
        let sum = 0;
        for (let i = 0; i < this.frames.length; i++) {
            sum += this.frames[i];
            min = Math.min(this.frames[i], min);
            max = Math.max(this.frames[i], max);
        }
        let mean = sum / this.frames.length;

        // Render the statistics
        this.fps.textContent = `FPS: ${Math.round(fps)} \
(last ${this.max_frames_history}: \
avg = ${Math.round(mean)}, \
min = ${Math.round(min)}, \
max = ${Math.round(max)})`.trim();
    }
})();

// Make the initial call to the animation loop
play();
