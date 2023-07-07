mod utils;

use dubble::DoubleBuffered;
use std::cmp::Ordering;
use wasm_bindgen::prelude::*;

// To access the JS Math.random
extern crate js_sys;

// To use single-bit encoding for the universe cells
extern crate fixedbitset;
use fixedbitset::FixedBitSet;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// A macro to provide `println!(..)`-style syntax for `console.log` logging.
#[allow(unused_macros)]
macro_rules! log {
    ( $( $t:tt )* ) => {
        web_sys::console::log_1(&format!( $( $t )* ).into());
    }
}

// Coordinates of the points to draw a different figures. The coordinates are
// taken using a representative pixel from the figure  as the center (0, 0).
// The format of the coordinates list is:
// [c0_row, c0_col, c1_row, c1_col, ..., cN_row, CN_col]
const GLIDER: [i32; 10] = [0, -2, 0, -1, 0, 0, -1, 0, -2, -1];
const PULSAR: [i32; 96] = [
    6, -4, 6, -3, 6, -2, 6, 2, 6, 3, 6, 4, 4, -6, 4, -1, 4, 1, 4, 6, 3, -6, 3, -1, 3, 1, 3, 6, 2,
    -6, 2, -1, 2, 1, 2, 6, 1, -4, 1, -3, 1, -2, 1, 2, 1, 3, 1, 4, -6, -4, -6, -3, -6, -2, -6, 2,
    -6, 3, -6, 4, -4, -6, -4, -1, -4, 1, -4, 6, -3, -6, -3, -1, -3, 1, -3, 6, -2, -6, -2, -1, -2,
    1, -2, 6, -1, -4, -1, -3, -1, -2, -1, 2, -1, 3, -1, 4,
];

/// Main data structure to store the universe state.
/// Uses a double buffered strategy to update the cells states.
#[wasm_bindgen]
pub struct Universe {
    width: u32,
    height: u32,
    cells: DoubleBuffered<FixedBitSet>,
    n_ticks: u32,
}

#[wasm_bindgen]
impl Universe {
    /// Initializes the universe with a given size.
    ///
    /// The state of the cells will be set randomly to alive or dead.
    pub fn new(width: u32, height: u32) -> Universe {
        // Enable better error messages in case of panic
        utils::set_panic_hook();

        // Create the universe data structure
        let size = (width * height) as usize;
        let cells = DoubleBuffered::new(FixedBitSet::with_capacity(size));

        let mut universe = Universe {
            width,
            height,
            cells,
            n_ticks: 1,
        };

        // Randomly set the universe cells
        universe.reset();

        universe
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    /// Get the size of the universe in number of cells.
    pub fn size(&self) -> usize {
        (self.width * self.height) as usize
    }

    /// Set a new size for the universe and set a new random state.
    fn reset_with_size(&mut self, new_size: usize) {
        let curr_size = self.size();
        match new_size.cmp(&curr_size) {
            Ordering::Greater => {
                self.cells.grow(new_size);
            }
            Ordering::Less => {
                self.cells.upsert(FixedBitSet::with_capacity(new_size));
            }
            Ordering::Equal => {}
        }
        self.reset();
    }

    /// Randomly reset all the cells.
    pub fn reset(&mut self) {
        for i in 0..self.size() {
            self.cells.set(i, js_sys::Math::random() < 0.5);
        }
        self.cells.update();
    }

    /// Reset the universe with all the cells dead.
    pub fn clear(&mut self) {
        self.cells.clear();
        self.cells.update();
    }

    /// Set the number of world updates (ticks) per update.
    pub fn set_ticks(&mut self, ticks: u32) {
        self.n_ticks = ticks;
    }

    /// Set the width of the universe.
    ///
    /// Resets all cells to the dead state.
    pub fn set_width(&mut self, width: u32) {
        self.width = width;
        let new_size = (width * self.height) as usize;
        self.reset_with_size(new_size);
    }

    /// Set the height of the universe.
    ///
    /// Resets all cells to the dead state.
    pub fn set_height(&mut self, height: u32) {
        self.height = height;
        let new_size = (self.width * height) as usize;
        self.reset_with_size(new_size);
    }

    /// Get a pointer to the cells state data.
    pub fn cells(&self) -> *const u32 {
        self.cells.as_slice().as_ptr()
    }

    /// Get the index of a cell in the data array.
    fn get_index(&self, row: u32, column: u32) -> usize {
        (row * self.width + column) as usize
    }

    /// Returns the number of alive neighbors for a given cell.
    fn live_neighbor_count(&self, row: u32, column: u32) -> u8 {
        let mut count = 0;

        let north = if row == 0 { self.height - 1 } else { row - 1 };

        let south = if row == self.height - 1 { 0 } else { row + 1 };

        let west = if column == 0 {
            self.width - 1
        } else {
            column - 1
        };

        let east = if column == self.width - 1 {
            0
        } else {
            column + 1
        };

        let nw = self.get_index(north, west);
        count += self.cells[nw] as u8;

        let n = self.get_index(north, column);
        count += self.cells[n] as u8;

        let ne = self.get_index(north, east);
        count += self.cells[ne] as u8;

        let w = self.get_index(row, west);
        count += self.cells[w] as u8;

        let e = self.get_index(row, east);
        count += self.cells[e] as u8;

        let sw = self.get_index(south, west);
        count += self.cells[sw] as u8;

        let s = self.get_index(south, column);
        count += self.cells[s] as u8;

        let se = self.get_index(south, east);
        count += self.cells[se] as u8;

        count
    }

    /// Compute the next universe state.
    ///
    /// The number of updates will be set by `self.n_ticks`.
    pub fn update(&mut self) {
        // Update the universe state
        for _ in 0..self.n_ticks {
            self.tick();
        }
    }

    /// Update the universe state by one tick.
    pub fn tick(&mut self) {
        for row in 0..self.height {
            for col in 0..self.width {
                let idx = self.get_index(row, col);
                let cell = self.cells[idx]; // From read buffer
                let live_neighbors = self.live_neighbor_count(row, col);

                // Update the write buffer
                self.cells.set(
                    idx,
                    match (cell, live_neighbors) {
                        (true, x) if x < 2 => false,
                        (true, 2) | (true, 3) => true,
                        (true, x) if x > 3 => false,
                        (false, 3) => true,
                        (otherwise, _) => otherwise,
                    },
                );
            }
        }

        self.cells.update();
    }

    /// Toggle the state of a given cell.
    pub fn toggle_cell(&mut self, row: u32, column: u32) {
        let idx = self.get_index(row, column);
        self.cells.toggle(idx);
        self.cells.update();
    }

    /// Generic function to draw a figure given the figure definition (`coords`) and the
    /// position to draw it.
    ///
    /// # Arguments
    ///
    /// * `coords` - A list with the coordinates of the cells to set alive. The coordinates
    ///              are relative to the position (`row`, `column`) and there could be negative
    ///              numbers. The format of the list is: [c0_row, c0_col, ..., cN_row, CN_col].
    /// * `row` - Y coordinate of the possition to draw the figure.
    /// * `column` - X coordinate of the possition to draw the figure.
    fn create_figure(&mut self, coords: &[i32], row: u32, column: u32) {
        // Get the number of cells to set alive to create the figure
        let n_cells = coords.len() / 2;
        for i in 0..n_cells {
            // Apply the coordinates offsets of the current cell
            let aux_row = (row as i32 + coords[i * 2]).rem_euclid(self.height as i32) as u32;
            let aux_col = (column as i32 + coords[i * 2 + 1]).rem_euclid(self.width as i32) as u32;
            // Get the corresponding index in the data array
            let idx = self.get_index(aux_row, aux_col);
            // Set the cell alive
            self.cells.insert(idx);
        }
        self.cells.update();
    }

    /// Draws a glider in the position provided.
    pub fn create_glider(&mut self, row: u32, column: u32) {
        self.create_figure(&GLIDER, row, column);
    }

    /// Draws a pulsar in the position provided.
    pub fn create_pulsar(&mut self, row: u32, column: u32) {
        self.create_figure(&PULSAR, row, column);
    }
}

impl Universe {
    /// Get the dead and alive values of the entire universe.
    pub fn get_cells(&self) -> &FixedBitSet {
        &self.cells
    }

    /// Set cells to be alive in a universe by passing the row and column
    /// of each cell as an array.
    pub fn set_cells(&mut self, cells: &[(u32, u32)]) {
        for (row, col) in cells.iter().cloned() {
            let idx = self.get_index(row, col);
            self.cells.set(idx, true);
        }
        self.cells.update();
    }
}

impl Default for Universe {
    /// Default universe constructor with a size of 100x100.
    fn default() -> Self {
        Self::new(100, 100)
    }
}
