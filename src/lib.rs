mod utils;

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

#[wasm_bindgen]
pub struct Universe {
    width: u32,
    height: u32,
    cells: FixedBitSet,
    n_ticks: u32,
}

#[wasm_bindgen]
impl Universe {
    pub fn new() -> Universe {
        // Enable better error messages in case of panic
        utils::set_panic_hook();

        // Set the universe dimensions
        let width = 64;
        let height = 64;

        // Create the universe data structure
        let size = (width * height) as usize;
        let cells = FixedBitSet::with_capacity(size);

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

    pub fn size(&self) -> usize {
        (self.width * self.height) as usize
    }

    fn reset_with_size(&mut self, new_size: usize) {
        let curr_size = self.size();
        match new_size.cmp(&curr_size) {
            Ordering::Greater => {
                self.cells.grow(new_size);
            }
            Ordering::Less => {
                self.cells = FixedBitSet::with_capacity(new_size);
            }
            Ordering::Equal => {}
        }
        self.reset();
    }

    /// Randomly resert all the cells
    pub fn reset(&mut self) {
        for i in 0..self.size() {
            self.cells.set(i, js_sys::Math::random() < 0.5);
        }
    }

    /// Reset the universe with all the cells dead
    pub fn clear(&mut self) {
        self.cells.clear();
    }

    /// Set the number of world updates (ticks) per update
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

    pub fn cells(&self) -> *const u32 {
        self.cells.as_slice().as_ptr()
    }

    fn get_index(&self, row: u32, column: u32) -> usize {
        (row * self.width + column) as usize
    }

    fn live_neighbor_count(&self, row: u32, column: u32) -> u8 {
        let mut count = 0;
        for delta_row in [self.height - 1, 0, 1].iter().cloned() {
            for delta_col in [self.width - 1, 0, 1].iter().cloned() {
                if delta_row == 0 && delta_col == 0 {
                    continue;
                }

                let neighbor_row = (row + delta_row) % self.height;
                let neighbor_col = (column + delta_col) % self.width;
                let idx = self.get_index(neighbor_row, neighbor_col);
                count += self.cells[idx] as u8;
            }
        }
        count
    }

    pub fn update(&mut self) {
        // Keep track of the time to update
        let _timer = utils::Timer::new("Universe::update");
        // Update the universe state
        for _ in 0..self.n_ticks {
            self.tick();
        }
    }

    pub fn tick(&mut self) {
        let mut next = self.cells.clone();
        for row in 0..self.height {
            for col in 0..self.width {
                let idx = self.get_index(row, col);
                let cell = self.cells[idx];
                let live_neighbors = self.live_neighbor_count(row, col);

                next.set(
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

        self.cells = next;
    }

    pub fn toggle_cell(&mut self, row: u32, column: u32) {
        let idx = self.get_index(row, column);
        self.cells.toggle(idx);
    }

    /// Creates a figure by setting alive the necessary cells to draw it.
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
    }

    pub fn create_glider(&mut self, row: u32, column: u32) {
        self.create_figure(&GLIDER, row, column);
    }

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
    }
}

impl Default for Universe {
    fn default() -> Self {
        Self::new()
    }
}
