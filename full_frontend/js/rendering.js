// Rendering logic

function render(canvas, ctx, positions, CORES, core_indices, core_set, mask, projected, nearest_r) {
    // Background
    if (enable_trails) {
        ctx.fillStyle = `rgba(0,0,0,${trail_fade})`;
    } else {
        ctx.fillStyle = 'rgb(0,0,0)';
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Particles
    for (let i = 0; i < positions.length; i++) {
        if (!mask[i] || core_set.has(i)) continue;
        const [px, py] = projected[i];
        const t = Math.log(nearest_r[i]) / log_max_radius;
        const tt = Math.max(0, Math.min(1, t));
        const [r, g, b] = smooth_colormap(tt);
        ctx.beginPath();
        ctx.arc(px, py, PARTICLE_SIZE, 0, 2 * Math.PI);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
    }

    // Cores
    core_indices.forEach(ci => {
        if (mask[ci]) {
            const [px, py] = projected[ci];
            ctx.beginPath();
            ctx.arc(px, py, CORE_SIZE, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgb(255,255,0)';
            ctx.fill();
        }
    });
}

function computeNearestRadii(positions, CORES, C) {
    const nearest_r = new Array(positions.length);
    for (let i = 0; i < positions.length; i++) {
        let min_d2 = Infinity;
        for (let c = 0; c < C; c++) {
            const dx = positions[i][0] - CORES[c][0];
            const dy = positions[i][1] - CORES[c][1];
            const d2 = dx*dx + dy*dy;
            if (d2 < min_d2) min_d2 = d2;
        }
        nearest_r[i] = Math.sqrt(min_d2) + 1e-6;
    }
    return nearest_r;
}
