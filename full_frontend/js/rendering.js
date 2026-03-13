// Rendering logic

function render(
    canvas,
    ctx,
    positions,
    CORES,
    core_indices,
    core_set,
    mask,
    projected,
    nearest_r,
    gasParticleRenderData = [],
    starBirthFlashRenderData = []
) {
    // Background
    if (enable_trails) {
        ctx.fillStyle = `rgba(0,0,0,${trail_fade})`;
    } else {
        ctx.fillStyle = 'rgb(0,0,0)';
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gas particles first
    renderGasParticles(ctx, gasParticleRenderData);

    // Stellar particles
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

    // Galactic cores
    core_indices.forEach(ci => {
        if (mask[ci]) {
            const [px, py] = projected[ci];
            ctx.beginPath();
            ctx.arc(px, py, CORE_SIZE, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgb(255,255,0)';
            ctx.fill();
        }
    });

    // Star birth flashes on top
    renderStarBirthFlashes(ctx, starBirthFlashRenderData);
}

function renderGasParticles(ctx, gasParticleRenderData) {
    if (!gasParticleRenderData || gasParticleRenderData.length === 0) return;

    for (let i = 0; i < gasParticleRenderData.length; i++) {
        const gp = gasParticleRenderData[i];
        const [r, g, b] = gp.color;

        const densityFactor = Math.max(0, Math.min(1, gp.density / Math.max(GAS_FORMATION_THRESHOLD, 1)));

        const baseMainAlpha = 0.11;
        const baseHazeAlpha = 0.035;
        const baseOuterAlpha = 0.012;

        const densityMainBoost = 0.16 * densityFactor;
        const densityHazeBoost = 0.06 * densityFactor;
        const densityOuterBoost = 0.025 * densityFactor;

        const mainAlpha = Math.min(0.42, baseMainAlpha + densityMainBoost);
        const hazeAlpha = Math.min(0.14, baseHazeAlpha + densityHazeBoost);
        const outerAlpha = Math.min(0.06, baseOuterAlpha + densityOuterBoost);

        const mainSize = gp.size;
        const hazeSize = gp.size * (2.1 + 0.2 * densityFactor);
        const outerSize = gp.size * (3.2 + 0.3 * densityFactor);

        ctx.beginPath();
        ctx.arc(gp.screenX, gp.screenY, outerSize, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${r},${g},${b},${outerAlpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(gp.screenX, gp.screenY, hazeSize, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${r},${g},${b},${hazeAlpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(gp.screenX, gp.screenY, mainSize, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${r},${g},${b},${mainAlpha})`;
        ctx.fill();

        if (gp.density >= GAS_FORMATION_THRESHOLD - 3) {
            const coreAlpha = Math.min(0.22, 0.06 + 0.12 * densityFactor);

            ctx.beginPath();
            ctx.arc(gp.screenX, gp.screenY, Math.max(0.85, gp.size * 0.52), 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(255,255,255,${coreAlpha})`;
            ctx.fill();
        }
    }
}

function renderStarBirthFlashes(ctx, starBirthFlashRenderData) {
    if (!starBirthFlashRenderData || starBirthFlashRenderData.length === 0) return;

    for (let i = 0; i < starBirthFlashRenderData.length; i++) {
        const flash = starBirthFlashRenderData[i];
        const [r, g, b] = flash.color;

        const progress = flash.progress;
        const radius = flash.screenMaxRadius * (0.35 + 1.05 * progress);
        const outerAlpha = Math.max(0, 0.26 * (1.0 - progress) * (1.0 - progress));
        const innerAlpha = Math.max(0, 0.48 * (1.0 - progress));

        ctx.beginPath();
        ctx.arc(flash.screenX, flash.screenY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${r},${g},${b},${outerAlpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(flash.screenX, flash.screenY, radius * 0.42, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255,255,255,${innerAlpha})`;
        ctx.fill();
    }
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