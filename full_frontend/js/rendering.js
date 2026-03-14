// Rendering logic

const STAR_SPRITE_CACHE = new Map();

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}

function quantizeRadius(radius) {
    // Limits cache growth while preserving visual smoothness
    return Math.max(0.75, Math.round(radius * 2) / 2);
}

function colorToRgba(color, alpha) {
    return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function getStarSpriteKey(color, radius, glowAlpha, renderMode) {
    return [
        renderMode,
        color[0], color[1], color[2],
        radius.toFixed(2),
        glowAlpha.toFixed(3)
    ].join('|');
}

function createStarSprite(color, radius, glowAlpha, renderMode) {
    const r = Math.max(0.75, radius);

    // Glow radius chosen to visually match your old layered look
    const glowRadius = (renderMode === STAR_RENDER_MODE_STAR_TYPE) ? r * 2.35 : r * 1.25;

    const padding = Math.ceil(glowRadius + 3);
    const size = Math.max(8, Math.ceil((padding * 2) + 2));

    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;

    const c = off.getContext('2d', { alpha: true });
    const cx = size / 2;
    const cy = size / 2;

    // Outer glow
    if (renderMode === STAR_RENDER_MODE_STAR_TYPE && glowAlpha > 0.001) {
        const grad = c.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        grad.addColorStop(0.0, colorToRgba(color, glowAlpha));
        grad.addColorStop(0.35, colorToRgba(color, glowAlpha * 0.65));
        grad.addColorStop(0.75, colorToRgba(color, glowAlpha * 0.18));
        grad.addColorStop(1.0, colorToRgba(color, 0.0));

        c.fillStyle = grad;
        c.beginPath();
        c.arc(cx, cy, glowRadius, 0, 2 * Math.PI);
        c.fill();
    }

    // Main stellar disc
    c.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    c.beginPath();
    c.arc(cx, cy, r, 0, 2 * Math.PI);
    c.fill();

    // Highlight
    if (renderMode === STAR_RENDER_MODE_STAR_TYPE) {
        const innerR = Math.max(0.65, r * 0.42);
        c.fillStyle = 'rgba(255,255,255,0.34)';
        c.beginPath();
        c.arc(cx, cy, innerR, 0, 2 * Math.PI);
        c.fill();
    }

    return {
        canvas: off,
        halfW: off.width / 2,
        halfH: off.height / 2
    };
}

function getStarSprite(color, radius, glowAlpha, renderMode) {
    const qRadius = quantizeRadius(radius);
    const key = getStarSpriteKey(color, qRadius, glowAlpha, renderMode);

    let sprite = STAR_SPRITE_CACHE.get(key);
    if (!sprite) {
        sprite = createStarSprite(color, qRadius, glowAlpha, renderMode);
        STAR_SPRITE_CACHE.set(key, sprite);
    }
    return sprite;
}

function clearStarSpriteCache() {
    STAR_SPRITE_CACHE.clear();
}

function get_star_render_color(starData, nearestRadius, renderMode) {
    if (renderMode === STAR_RENDER_MODE_CORE_DISTANCE) {
        const t = Math.log(nearestRadius) / log_max_radius;
        const tt = Math.max(0, Math.min(1, t));
        return smooth_colormap(tt);
    }

    return get_star_visual_profile(starData).color;
}

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
    starParticleData,
    starRenderMode,
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
        const starData = starParticleData[i];
        const radius = compute_star_screen_radius(starData);

        // Simple screen cull before any sprite work
        const approxCullR = radius * 2.6;
        if (
            px < -approxCullR || px > canvas.width + approxCullR ||
            py < -approxCullR || py > canvas.height + approxCullR
        ) {
            continue;
        }

        const color = get_star_render_color(starData, nearest_r[i], starRenderMode);
        const profile = get_star_visual_profile(starData);
        const glowAlpha = profile.glowAlpha;

        // Best payoff: cached sprites for star-type mode
        if (starRenderMode === STAR_RENDER_MODE_STAR_TYPE) {
            const sprite = getStarSprite(color, radius, glowAlpha, starRenderMode);
            ctx.drawImage(sprite.canvas, px - sprite.halfW, py - sprite.halfH);
        } else {
            // Keep core-distance mode simpler for now since color varies continuously
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, 2 * Math.PI);
            ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
            ctx.fill();
        }
    }

    // Galactic cores
    core_indices.forEach(ci => {
        if (!mask[ci]) return;

        const [px, py] = projected[ci];
        if (px < -CORE_SIZE || px > canvas.width + CORE_SIZE || py < -CORE_SIZE || py > canvas.height + CORE_SIZE) {
            return;
        }

        ctx.beginPath();
        ctx.arc(px, py, CORE_SIZE, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgb(255,255,0)';
        ctx.fill();
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

        // Keep these here for now unless you want them moved into constants.js
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
            const d2 = dx * dx + dy * dy;
            if (d2 < min_d2) min_d2 = d2;
        }

        nearest_r[i] = Math.sqrt(min_d2) + 1e-6;
    }

    return nearest_r;
}