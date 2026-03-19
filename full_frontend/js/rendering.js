// Rendering logic

const STAR_SPRITE_CACHE = new Map();

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function quantizeRadius(radius) {
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
    const glowRadius = (renderMode === STAR_RENDER_MODE_STAR_TYPE) ? r * 2.35 : r * 1.25;

    const padding = Math.ceil(glowRadius + 3);
    const size = Math.max(8, Math.ceil((padding * 2) + 2));

    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;

    const c = off.getContext('2d', { alpha: true });
    const cx = size / 2;
    const cy = size / 2;

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

    c.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    c.beginPath();
    c.arc(cx, cy, r, 0, 2 * Math.PI);
    c.fill();

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

function getSupernovaSceneIntensity(supernovaRenderData) {
    if (!supernovaRenderData || supernovaRenderData.length === 0) return 0.0;

    let combinedIntensity = 0.0;

    for (let i = 0; i < supernovaRenderData.length; i++) {
        const ev = supernovaRenderData[i];
        const progress = clamp01(ev.progress);
        const intensity = Math.pow(1.0 - progress, SUPERNOVA_SCENE_DIM_EXPONENT);
        combinedIntensity += intensity;
    }

    return clamp01(combinedIntensity);
}

function isSupernovaRemnantStar(starData) {
    return !!(starData && starData.isActive && starData.hasSupernovaTriggered);
}

function isPulsarStar(starData) {
    return !!(starData && starData.isActive && starData.starType === STAR_TYPE_PULSAR && starData.isPulsar);
}

function isCompactRemnantStar(starData) {
    if (!starData || !starData.isActive) return false;
    return starData.starType === STAR_TYPE_NEUTRON_STAR || starData.starType === STAR_TYPE_PULSAR;
}

function isNeutronStar(starData) {
    return !!(starData && starData.isActive && starData.starType === STAR_TYPE_NEUTRON_STAR);
}

function isBlackHoleStarForRender(starData) {
    return !!(starData && starData.isActive && starData.starType === STAR_TYPE_BLACK_HOLE && starData.isBlackHole);
}

function shouldDisplayStarForFilter(starData, filterValue) {
    if (!starData || !starData.isActive) return false;

    if (!filterValue || filterValue === STAR_DISPLAY_FILTER_ALL) return true;

    if (filterValue === STAR_DISPLAY_FILTER_COMPACT_REMNANT) {
        return isCompactRemnantStar(starData);
    }

    if (filterValue === STAR_DISPLAY_FILTER_SUPERNOVA_REMNANT) {
        return !!starData.hasSupernovaTriggered;
    }

    return starData.starType === filterValue;
}

function getPulsarRenderState(starData) {
    if (!isPulsarStar(starData)) {
        return {
            beamAngle: 0.0,
            pulse: 0.0,
            beamAlphaScale: 0.0
        };
    }

    const age = starData.age || 0.0;
    const beamAngle = (starData.pulsarBeamAngle || 0.0) + age * (starData.pulsarSpinRate || 0.0);
    const pulseRate = starData.pulsarPulseRate || 0.0;
    const pulseStrength = starData.pulsarPulseStrength || 0.0;

    const rawPulse = 0.5 + 0.5 * Math.sin((starData.pulsarSpinPhase || 0.0) + age * pulseRate);
    const pulse = Math.pow(rawPulse, 1.25);
    const beamAlphaScale = 0.62 + pulse * (0.24 + 0.18 * pulseStrength);

    return { beamAngle, pulse, beamAlphaScale };
}

function get_star_render_color(starData, nearestRadius, renderMode) {
    if (renderMode === STAR_RENDER_MODE_CORE_DISTANCE) {
        const t = Math.log(nearestRadius) / log_max_radius;
        const tt = Math.max(0, Math.min(1, t));
        return smooth_colormap(tt);
    }

    return get_star_visual_profile(starData).color;
}

function renderStarParticle(ctx, px, py, radius, color, glowAlpha, starRenderMode) {
    if (starRenderMode === STAR_RENDER_MODE_STAR_TYPE) {
        const sprite = getStarSprite(color, radius, glowAlpha, starRenderMode);
        ctx.drawImage(sprite.canvas, px - sprite.halfW, py - sprite.halfH);
    } else {
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
        ctx.fill();
    }
}

function computeBlackHoleMassProgress(starData) {
    const mass = Math.max(1.0, starData?.currentMass ?? 1.0);
    const minMass = Math.max(1.0, BLACK_HOLE_RENDER_MASS_MIN);
    const maxMass = Math.max(minMass + 1e-6, BLACK_HOLE_RENDER_MASS_MAX);

    const minLog = Math.log10(minMass);
    const maxLog = Math.log10(maxMass);
    const massLog = Math.log10(mass);

    if (maxLog <= minLog + 1e-9) return 1.0;
    return clamp01((massLog - minLog) / (maxLog - minLog));
}

function computeBlackHoleRenderRadius(starData) {
    const t = computeBlackHoleMassProgress(starData);
    return lerp(BLACK_HOLE_RENDER_RADIUS_MIN, BLACK_HOLE_RENDER_RADIUS_MAX, t);
}

function computeBlackHoleRenderMetrics(starData, isPromotedCore = false) {
    const bodyRadius = computeBlackHoleRenderRadius(starData);

    const unclampedLensing = bodyRadius * BLACK_HOLE_LENSING_RADIUS_FACTOR;
    const lensingRadius = Math.min(BLACK_HOLE_MAX_VISUAL_RADIUS, unclampedLensing);

    const rimWidth = Math.max(1.0, bodyRadius * BLACK_HOLE_RIM_WIDTH_FACTOR);
    const lensingAlpha = BLACK_HOLE_LENSING_ALPHA * (isPromotedCore ? BLACK_HOLE_PROMOTED_LENSING_ALPHA_SCALE : 1.0);

    const approxCullR = lensingRadius + rimWidth + 6.0;

    return {
        bodyRadius,
        lensingRadius,
        rimWidth,
        lensingAlpha,
        approxCullR
    };
}

function computePrimordialCoreBlackHoleRenderMetrics() {
    const bodyRadius = BLACK_HOLE_RENDER_RADIUS_MAX;
    const unclampedLensing = bodyRadius * BLACK_HOLE_LENSING_RADIUS_FACTOR;
    const lensingRadius = Math.min(BLACK_HOLE_MAX_VISUAL_RADIUS, unclampedLensing);
    const rimWidth = Math.max(1.0, bodyRadius * BLACK_HOLE_RIM_WIDTH_FACTOR);
    const lensingAlpha = BLACK_HOLE_LENSING_ALPHA * BLACK_HOLE_PROMOTED_LENSING_ALPHA_SCALE;
    const approxCullR = lensingRadius + rimWidth + 6.0;

    return {
        bodyRadius,
        lensingRadius,
        rimWidth,
        lensingAlpha,
        approxCullR
    };
}

function renderBlackHoleParticle(ctx, px, py, metrics, isPromotedCore = false) {
    const radius = metrics.bodyRadius;
    const lensRadius = metrics.lensingRadius;
    const rimWidth = metrics.rimWidth;
    const [rr, rg, rb] = BLACK_HOLE_RIM_COLOR;

    const lensGrad = ctx.createRadialGradient(px, py, radius * 0.55, px, py, lensRadius);
    lensGrad.addColorStop(0.0, `rgba(${rr},${rg},${rb},0)`);
    lensGrad.addColorStop(0.52, `rgba(${rr},${rg},${rb},${metrics.lensingAlpha * 0.28})`);
    lensGrad.addColorStop(0.78, `rgba(${rr},${rg},${rb},${metrics.lensingAlpha})`);
    lensGrad.addColorStop(1.0, `rgba(${rr},${rg},${rb},0)`);

    ctx.beginPath();
    ctx.arc(px, py, lensRadius, 0, 2 * Math.PI);
    ctx.fillStyle = lensGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, radius * BLACK_HOLE_CORE_DARK_SCALE, 0, 2 * Math.PI);
    ctx.fillStyle = `rgb(${STAR_COLOR_BLACK_HOLE[0]},${STAR_COLOR_BLACK_HOLE[1]},${STAR_COLOR_BLACK_HOLE[2]})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(${rr},${rg},${rb},${BLACK_HOLE_RIM_ALPHA})`;
    ctx.lineWidth = rimWidth;
    ctx.stroke();

    if (isPromotedCore) {
        const subtleRing = Math.min(
            BLACK_HOLE_MAX_VISUAL_RADIUS,
            radius * BLACK_HOLE_PROMOTED_SUBTLE_RING_SCALE
        );

        ctx.beginPath();
        ctx.arc(px, py, subtleRing, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(${rr},${rg},${rb},${BLACK_HOLE_PROMOTED_SUBTLE_RING_ALPHA})`;
        ctx.lineWidth = Math.max(1.0, rimWidth * 0.72);
        ctx.stroke();
    }
}

function renderPulsarBeam(ctx, px, py, beamAngle, beamAlphaScale) {
    const len = PULSAR_BEAM_LENGTH;
    const [r, g, b] = PULSAR_BEAM_COLOR;

    const widthNear = Math.max(0.55, len * 0.0065);
    const widthFar = Math.max(1.25, len * 0.022);

    for (let dir = -1; dir <= 1; dir += 2) {
        const angle = beamAngle + (dir === 1 ? 0 : Math.PI);
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const pxn = -dy;
        const pyn = dx;

        const x0 = px;
        const y0 = py;
        const x1 = px + dx * len;
        const y1 = py + dy * len;

        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0.0, `rgba(${r},${g},${b},${PULSAR_BEAM_CORE_ALPHA * beamAlphaScale})`);
        grad.addColorStop(0.18, `rgba(${r},${g},${b},${PULSAR_BEAM_CORE_ALPHA * 0.82 * beamAlphaScale})`);
        grad.addColorStop(0.55, `rgba(${r},${g},${b},${PULSAR_BEAM_CORE_ALPHA * 0.32 * beamAlphaScale})`);
        grad.addColorStop(1.0, `rgba(${r},${g},${b},0)`);

        ctx.beginPath();
        ctx.moveTo(x0 + pxn * widthNear, y0 + pyn * widthNear);
        ctx.lineTo(x0 - pxn * widthNear, y0 - pyn * widthNear);
        ctx.lineTo(x1 - pxn * widthFar, y1 - pyn * widthFar);
        ctx.lineTo(x1 + pxn * widthFar, y1 + pyn * widthFar);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        const hazeGrad = ctx.createLinearGradient(x0, y0, x1, y1);
        hazeGrad.addColorStop(0.0, `rgba(${r},${g},${b},${PULSAR_BEAM_HAZE_ALPHA * beamAlphaScale})`);
        hazeGrad.addColorStop(0.3, `rgba(${r},${g},${b},${PULSAR_BEAM_HAZE_ALPHA * 0.58 * beamAlphaScale})`);
        hazeGrad.addColorStop(1.0, `rgba(${r},${g},${b},0)`);

        ctx.beginPath();
        ctx.moveTo(x0 + pxn * widthNear * 1.55, y0 + pyn * widthNear * 1.55);
        ctx.lineTo(x0 - pxn * widthNear * 1.55, y0 - pyn * widthNear * 1.55);
        ctx.lineTo(x1 - pxn * widthFar * 1.45, y1 - pyn * widthFar * 1.45);
        ctx.lineTo(x1 + pxn * widthFar * 1.45, y1 + pyn * widthFar * 1.45);
        ctx.closePath();
        ctx.fillStyle = hazeGrad;
        ctx.fill();
    }
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
    starDisplayFilter,
    gasParticleRenderData = [],
    starBirthFlashRenderData = [],
    supernovaRenderData = []
) {
    if (enable_trails) {
        ctx.fillStyle = `rgba(0,0,0,${trail_fade})`;
    } else {
        ctx.fillStyle = 'rgb(0,0,0)';
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    renderGasParticles(ctx, gasParticleRenderData);

    for (let i = 0; i < positions.length; i++) {
        if (!mask[i] || core_set.has(i)) continue;

        const starData = starParticleData[i];
        if (!isPulsarStar(starData)) continue;
        if (!shouldDisplayStarForFilter(starData, starDisplayFilter)) continue;

        const [px, py] = projected[i];
        const radius = compute_star_screen_radius(starData);
        const approxCullR = radius + PULSAR_BEAM_LENGTH + 10;

        if (
            px < -approxCullR || px > canvas.width + approxCullR ||
            py < -approxCullR || py > canvas.height + approxCullR
        ) {
            continue;
        }

        const pulsarState = getPulsarRenderState(starData);
        renderPulsarBeam(ctx, px, py, pulsarState.beamAngle, pulsarState.beamAlphaScale);
    }

    for (let i = 0; i < positions.length; i++) {
        if (!mask[i] || core_set.has(i)) continue;

        const starData = starParticleData[i];
        if (!starData || !starData.isActive) continue;
        if (!shouldDisplayStarForFilter(starData, starDisplayFilter)) continue;

        const [px, py] = projected[i];
        let radius = compute_star_screen_radius(starData);

        if (isBlackHoleStarForRender(starData)) {
            const bhMetrics = computeBlackHoleRenderMetrics(starData, false);

            if (
                px < -bhMetrics.approxCullR || px > canvas.width + bhMetrics.approxCullR ||
                py < -bhMetrics.approxCullR || py > canvas.height + bhMetrics.approxCullR
            ) {
                continue;
            }

            renderBlackHoleParticle(ctx, px, py, bhMetrics, false);
            continue;
        }

        if (isNeutronStar(starData)) {
            radius += 0.22;
        }

        if (isSupernovaRemnantStar(starData)) {
            radius += SUPERNOVA_REMNANT_FLASH_RADIUS_BOOST;
        }

        const approxCullR = Math.max(radius * 3.1, 6.0);
        if (
            px < -approxCullR || px > canvas.width + approxCullR ||
            py < -approxCullR || py > canvas.height + approxCullR
        ) {
            continue;
        }

        const color = get_star_render_color(starData, nearest_r[i], starRenderMode);
        const profile = get_star_visual_profile(starData);
        let glowAlpha = profile.glowAlpha;

        if (isPulsarStar(starData)) {
            const pulsarState = getPulsarRenderState(starData);
            glowAlpha *= 1.10 + 0.30 * pulsarState.pulse;
        }

        if (isNeutronStar(starData)) {
            glowAlpha *= 1.35;
        }

        if (isSupernovaRemnantStar(starData)) {
            glowAlpha *= 1.85;
        }

        renderStarParticle(ctx, px, py, radius, color, glowAlpha, starRenderMode);
    }

    core_indices.forEach((ci, coreSlot) => {
        if (!mask[ci]) return;

        const [px, py] = projected[ci];
        const starData = starParticleData[ci];

        if (isBlackHoleStarForRender(starData)) {
            const bhMetrics = computeBlackHoleRenderMetrics(starData, true);

            if (
                px < -bhMetrics.approxCullR || px > canvas.width + bhMetrics.approxCullR ||
                py < -bhMetrics.approxCullR || py > canvas.height + bhMetrics.approxCullR
            ) {
                return;
            }

            renderBlackHoleParticle(ctx, px, py, bhMetrics, true);
            return;
        }

        const isPrimordialCore = coreSlot < CORE_POS_INIT.length;
        if (isPrimordialCore) {
            const primordialMetrics = computePrimordialCoreBlackHoleRenderMetrics();

            if (
                px < -primordialMetrics.approxCullR || px > canvas.width + primordialMetrics.approxCullR ||
                py < -primordialMetrics.approxCullR || py > canvas.height + primordialMetrics.approxCullR
            ) {
                return;
            }

            renderBlackHoleParticle(ctx, px, py, primordialMetrics, true);
            return;
        }

        if (px < -CORE_SIZE || px > canvas.width + CORE_SIZE || py < -CORE_SIZE || py > canvas.height + CORE_SIZE) {
            return;
        }

        ctx.beginPath();
        ctx.arc(px, py, CORE_SIZE, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgb(255,255,0)';
        ctx.fill();
    });

    renderStarBirthFlashes(ctx, starBirthFlashRenderData);
    renderSupernovaEvents(ctx, supernovaRenderData, canvas);
}

function renderGasParticles(ctx, gasParticleRenderData) {
    if (!gasParticleRenderData || gasParticleRenderData.length === 0) return;

    for (let i = 0; i < gasParticleRenderData.length; i++) {
        const gp = gasParticleRenderData[i];
        const [r, g, b] = gp.color;
        const hotness = gp.hotness || 0.0;

        const densityFactor = Math.max(0, Math.min(1, gp.density / Math.max(GAS_FORMATION_THRESHOLD, 1)));

        const baseMainAlpha = 0.11;
        const baseHazeAlpha = 0.035;
        const baseOuterAlpha = 0.012;

        const densityMainBoost = 0.16 * densityFactor;
        const densityHazeBoost = 0.06 * densityFactor;
        const densityOuterBoost = 0.025 * densityFactor;

        const heatMainBoost = 0.10 * hotness;

        const mainAlpha = Math.min(0.72, baseMainAlpha + densityMainBoost + heatMainBoost);
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

        if (gp.density >= GAS_FORMATION_THRESHOLD - 3 && hotness <= 0.08) {
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

function renderSupernovaEvents(ctx, supernovaRenderData, canvas) {
    const screenIntensity = getSupernovaSceneIntensity(supernovaRenderData);
    if (screenIntensity <= 0.001) return;

    const dimAlpha = Math.min(
        SUPERNOVA_SCENE_DIM_STRENGTH,
        screenIntensity * SUPERNOVA_SCENE_DIM_STRENGTH
    );

    ctx.fillStyle = `rgba(0,0,0,${dimAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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