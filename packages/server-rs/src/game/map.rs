/// Tile map: 0=empty, 1=wall. Row-major flat array.
#[derive(Debug, Clone)]
pub struct TileMap {
    pub width: u32,
    pub height: u32,
    pub tiles: Vec<u32>,
}

impl TileMap {
    pub fn is_wall_at(&self, tx: i32, ty: i32) -> bool {
        if tx < 0 || tx >= self.width as i32 || ty < 0 || ty >= self.height as i32 {
            return true;
        }
        self.tiles[(ty as u32 * self.width + tx as u32) as usize] != 0
    }

    /// Check if a circle (AABB approximation) collides with any wall tile.
    pub fn is_colliding(&self, x: f32, y: f32, radius: f32) -> bool {
        let min_tx = (x - radius).floor() as i32;
        let max_tx = (x + radius).floor() as i32;
        let min_ty = (y - radius).floor() as i32;
        let max_ty = (y + radius).floor() as i32;

        for ty in min_ty..=max_ty {
            for tx in min_tx..=max_tx {
                if self.is_wall_at(tx, ty) {
                    let ship_left = x - radius;
                    let ship_right = x + radius;
                    let ship_top = y - radius;
                    let ship_bottom = y + radius;

                    let tile_left = tx as f32;
                    let tile_right = tx as f32 + 1.0;
                    let tile_top = ty as f32;
                    let tile_bottom = ty as f32 + 1.0;

                    if ship_right > tile_left
                        && ship_left < tile_right
                        && ship_bottom > tile_top
                        && ship_top < tile_bottom
                    {
                        return true;
                    }
                }
            }
        }
        false
    }
}

/// Apply wall collision using axis-separated approach (X then Y).
pub fn apply_wall_collision(
    x: &mut f32,
    y: &mut f32,
    vx: &mut f32,
    vy: &mut f32,
    dt: f32,
    map: &TileMap,
    radius: f32,
    bounce_factor: f32,
) {
    // X axis
    let prev_x = *x;
    *x += *vx * dt;
    if map.is_colliding(*x, *y, radius) {
        *x = prev_x;
        *vx *= -bounce_factor;
        *vy *= bounce_factor;
    }

    // Y axis
    let prev_y = *y;
    *y += *vy * dt;
    if map.is_colliding(*x, *y, radius) {
        *y = prev_y;
        *vy *= -bounce_factor;
        *vx *= bounce_factor;
    }
}

fn set_tile(tiles: &mut [u32], width: u32, height: u32, x: i32, y: i32, value: u32) {
    if x >= 0 && (x as u32) < width && y >= 0 && (y as u32) < height {
        tiles[(y as u32 * width + x as u32) as usize] = value;
    }
}

fn fill_rect(tiles: &mut [u32], width: u32, height: u32, x1: i32, y1: i32, x2: i32, y2: i32, value: u32) {
    for y in y1..=y2 {
        for x in x1..=x2 {
            set_tile(tiles, width, height, x, y, value);
        }
    }
}

/// Generate a test arena matching the TypeScript generateTestArena.
pub fn generate_test_arena(width: u32, height: u32) -> TileMap {
    let mut tiles = vec![0u32; (width * height) as usize];

    // 2-tile thick border walls
    fill_rect(&mut tiles, width, height, 0, 0, width as i32 - 1, 1, 1);
    fill_rect(&mut tiles, width, height, 0, height as i32 - 2, width as i32 - 1, height as i32 - 1, 1);
    fill_rect(&mut tiles, width, height, 0, 0, 1, height as i32 - 1, 1);
    fill_rect(&mut tiles, width, height, width as i32 - 2, 0, width as i32 - 1, height as i32 - 1, 1);

    let cx = (width / 2) as i32;
    let cy = (height / 2) as i32;

    // Cross-shaped walls dividing map into quadrants
    for x in 10..(width as i32 - 10) {
        if (x - cx).abs() > 5
            && (x - cx / 2).abs() > 3
            && (x - (cx * 3) / 2).abs() > 3
        {
            set_tile(&mut tiles, width, height, x, cy, 1);
            set_tile(&mut tiles, width, height, x, cy - 1, 1);
        }
    }

    for y in 10..(height as i32 - 10) {
        if (y - cy).abs() > 5
            && (y - cy / 2).abs() > 3
            && (y - (cy * 3) / 2).abs() > 3
        {
            set_tile(&mut tiles, width, height, cx, y, 1);
            set_tile(&mut tiles, width, height, cx - 1, y, 1);
        }
    }

    // Corner room walls in each quadrant
    let quadrants = [
        (cx / 2, cy / 2),
        ((cx * 3) / 2, cy / 2),
        (cx / 2, (cy * 3) / 2),
        ((cx * 3) / 2, (cy * 3) / 2),
    ];

    for &(qx, qy) in &quadrants {
        // L-shaped wall structures
        fill_rect(&mut tiles, width, height, qx - 8, qy - 8, qx - 8, qy - 3, 1);
        fill_rect(&mut tiles, width, height, qx - 8, qy - 8, qx - 3, qy - 8, 1);
        fill_rect(&mut tiles, width, height, qx + 3, qy + 3, qx + 8, qy + 3, 1);
        fill_rect(&mut tiles, width, height, qx + 8, qy + 3, qx + 8, qy + 8, 1);

        // Pillar obstacles (2x2)
        fill_rect(&mut tiles, width, height, qx - 1, qy - 1, qx, qy, 1);
    }

    // Additional corridor walls
    fill_rect(&mut tiles, width, height, 20, 20, 25, 20, 1);
    fill_rect(&mut tiles, width, height, 25, 20, 25, 25, 1);
    fill_rect(&mut tiles, width, height, width as i32 - 26, height as i32 - 26, width as i32 - 21, height as i32 - 26, 1);
    fill_rect(&mut tiles, width, height, width as i32 - 26, height as i32 - 26, width as i32 - 26, height as i32 - 21, 1);

    TileMap { width, height, tiles }
}
