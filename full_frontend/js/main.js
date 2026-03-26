// main.js – ties everything together

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let positions = [];
let velocities = [];
let forces = [];
let CORES = [];
let core_indices = [];
let core_set = new Set();
let BLOCK_SIZE = 0;
let C = 0;

let STAR_PARTICLE_DATA = [];

let GAS_PARTICLES = [];
let gasParticleAcc = [];
let STAR_BIRTH_FLASHES = [];
let SUPERNOVA_EVENTS = [];
let NEXT_GAS_SOURCE_ID = 100000;

let M_bulge, A_bulge, M_disk, A_disk, B_disk, V_halo, R_core;

// null = no core selected, camera follows default system center
let selectedCoreIndex = null;

// Resize handling
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function syncLegacyCoreGlobals() {
    n_per_core = CORE_PARTICLE_COUNTS[0];
    core_vel_scale = CORE_VEL_SCALES[0];
    core_mass = CORE_MASSES[0];
}

function getDefaultCameraTarget() {
    if (CORES.length > 0) return mean_pos(CORES);
    return mean_pos(CORE_POS_INIT);
}

function getActiveCameraTarget() {
    if (
        selectedCoreIndex !== null &&
        selectedCoreIndex >= 0 &&
        selectedCoreIndex < CORES.length
    ) {
        return CORES[selectedCoreIndex].slice();
    }

    return getDefaultCameraTarget();
}

function selectCore(coreIndex) {
    selectedCoreIndex = coreIndex;
    camera.followEnabled = true;
    buildCoreInspectorUI();
}

function deselectCore() {
    selectedCoreIndex = null;
    camera.followEnabled = true;
    buildCoreInspectorUI();
}

function toggleCoreSelection(coreIndex) {
    if (selectedCoreIndex === coreIndex) {
        deselectCore();
    } else {
        selectCore(coreIndex);
    }
}

function isInitialCoreSlot(coreSlot) {
    return coreSlot >= 0 && coreSlot < CORE_POS_INIT.length;
}

function getCoreParticleIndex(coreSlot) {
    if (coreSlot < 0 || coreSlot >= core_indices.length) return -1;
    return core_indices[coreSlot];
}

function getCoreStarData(coreSlot) {
    const particleIndex = getCoreParticleIndex(coreSlot);
    if (particleIndex < 0) return null;
    return STAR_PARTICLE_DATA[particleIndex] || null;
}

function formatMaybeNumber(value, digits = 1) {
    if (typeof value !== 'number' || !isFinite(value)) return '—';
    return value.toFixed(digits);
}

function buildPromotedCoreEditorHtml(slot, starData) {
    const accretedGas = starData?.accretedGasMass ?? 0.0;
    const accretedStars = starData?.accretedStellarMass ?? 0.0;
    const currentMass = starData?.currentMass ?? CORE_MASSES[slot] ?? 0.0;

    return `
        <h4>Promoted Black Hole Core ${slot + 1}</h4>

        <label>
            Current Mass:
            <span>${Math.round(currentMass)}</span>
        </label>

        <label>
            Accreted Gas Mass:
            <span>${formatMaybeNumber(accretedGas, 1)}</span>
        </label>

        <label>
            Accreted Stellar Mass:
            <span>${formatMaybeNumber(accretedStars, 1)}</span>
        </label>

        <div class="core-editor-note">
            This core formed dynamically from a promoted black hole.
            Its mass updates live through accretion and can’t be manually edited.
        </div>
    `;
}

function buildInitialCoreEditorHtml(slot) {
    return `
        <h4>Primordial Black Hole Core ${slot + 1} Parameters</h4>

        <label>
            Particle Count:
            <input type="range" id="core_particles_${slot}" min="100" max="10000" step="100" value="${CORE_PARTICLE_COUNTS[slot]}">
            <span id="core_particles_val_${slot}">${CORE_PARTICLE_COUNTS[slot]}</span>
        </label>

        <label>
            Core Mass:
            <input type="range" id="core_mass_${slot}" min="1000" max="10000" step="100" value="${CORE_MASSES[slot]}">
            <span id="core_mass_val_${slot}">${CORE_MASSES[slot]}</span>
        </label>

        <label>
            Core Velocity Scale:
            <input type="range" id="core_vel_scale_${slot}" min="0.5" max="1.5" step="0.1" value="${CORE_VEL_SCALES[slot]}">
            <span id="core_vel_scale_val_${slot}">${CORE_VEL_SCALES[slot].toFixed(1)}</span>
        </label>

        <button type="button" class="core-apply-btn" id="core_apply_${slot}">Apply Core Settings & Restart</button>

        <div class="core-editor-note">
            These primordial cores keep the original initialization behavior.
            Their mass, particle count, and initial velocity scale are still controlled manually.
        </div>
    `;
}

function buildCoreInspectorUI() {
    const coreList = document.getElementById('core-list');
    if (!coreList) return;

    coreList.innerHTML = '';

    // Build UI from actual runtime core slots after init.
    for (let i = 0; i < core_indices.length; i++) {
        const item = document.createElement('div');
        item.className = 'core-item';
        if (i === selectedCoreIndex) item.classList.add('selected');

        const starData = getCoreStarData(i);
        const isInitial = isInitialCoreSlot(i);
        const headerTitle = isInitial
            ? `Primordial Black Hole Core ${i + 1}`
            : `Promoted Black Hole Core ${i + 1}`;

        const header = document.createElement('button');
        header.className = 'core-header';
        header.type = 'button';
        header.innerHTML = `
            ${headerTitle}
            <span class="core-meta">
                ${isInitial
                    ? `Mass: ${Math.round(CORE_MASSES[i])} | Particles: ${CORE_PARTICLE_COUNTS[i]} | Vel Scale: ${CORE_VEL_SCALES[i].toFixed(2)}`
                    : `Mass: ${Math.round(CORE_MASSES[i] ?? 0)} | Accreted Gas: ${formatMaybeNumber(starData?.accretedGasMass ?? 0, 1)} | Accreted Stars: ${formatMaybeNumber(starData?.accretedStellarMass ?? 0, 1)}`
                }
            </span>
        `;

        header.addEventListener('click', () => {
            toggleCoreSelection(i);
        });

        const editor = document.createElement('div');
        editor.className = 'core-editor';
        editor.innerHTML = isInitial
            ? buildInitialCoreEditorHtml(i)
            : buildPromotedCoreEditorHtml(i, starData);

        item.appendChild(header);
        item.appendChild(editor);
        coreList.appendChild(item);

        if (!isInitial) continue;

        const particlesSlider = document.getElementById(`core_particles_${i}`);
        const particlesValue = document.getElementById(`core_particles_val_${i}`);
        const massSlider = document.getElementById(`core_mass_${i}`);
        const massValue = document.getElementById(`core_mass_val_${i}`);
        const velSlider = document.getElementById(`core_vel_scale_${i}`);
        const velValue = document.getElementById(`core_vel_scale_val_${i}`);
        const applyBtn = document.getElementById(`core_apply_${i}`);

        if (particlesSlider) {
            particlesSlider.addEventListener('input', e => {
                CORE_PARTICLE_COUNTS[i] = parseInt(e.target.value);
                particlesValue.textContent = CORE_PARTICLE_COUNTS[i];
                syncLegacyCoreGlobals();
                updateCoreHeaderMeta(i);
            });
        }

        if (massSlider) {
            massSlider.addEventListener('input', e => {
                CORE_MASSES[i] = parseFloat(e.target.value);
                massValue.textContent = Math.round(CORE_MASSES[i]);
                syncLegacyCoreGlobals();
                updateCoreHeaderMeta(i);
            });
        }

        if (velSlider) {
            velSlider.addEventListener('input', e => {
                CORE_VEL_SCALES[i] = parseFloat(e.target.value);
                velValue.textContent = CORE_VEL_SCALES[i].toFixed(1);
                syncLegacyCoreGlobals();
                updateCoreHeaderMeta(i);
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                syncLegacyCoreGlobals();
                init();
                buildCoreInspectorUI();
            });
        }
    }
}

function updateCoreHeaderMeta(coreIdx) {
    const coreList = document.getElementById('core-list');
    if (!coreList) return;

    const items = coreList.querySelectorAll('.core-item');
    const item = items[coreIdx];
    if (!item) return;

    const meta = item.querySelector('.core-meta');
    if (!meta) return;

    const starData = getCoreStarData(coreIdx);
    const isInitial = isInitialCoreSlot(coreIdx);

    meta.textContent = isInitial
        ? `Mass: ${Math.round(CORE_MASSES[coreIdx])} | Particles: ${CORE_PARTICLE_COUNTS[coreIdx]} | Vel Scale: ${CORE_VEL_SCALES[coreIdx].toFixed(2)}`
        : `Mass: ${Math.round(CORE_MASSES[coreIdx] ?? 0)} | Accreted Gas: ${formatMaybeNumber(starData?.accretedGasMass ?? 0, 1)} | Accreted Stars: ${formatMaybeNumber(starData?.accretedStellarMass ?? 0, 1)}`;
}

function addStarBirthFlashes(formedStars) {
    for (let i = 0; i < formedStars.length; i++) {
        STAR_BIRTH_FLASHES.push({
            position: formedStars[i].position.slice(),
            age: 0,
            lifetime: STAR_BIRTH_FLASH_LIFETIME,
            maxWorldRadius: STAR_BIRTH_FLASH_MAX_WORLD_RADIUS,
            color: [255, 245, 185]
        });
    }
}

function updateStarBirthFlashes(dtStep) {
    if (STAR_BIRTH_FLASHES.length === 0) return;

    for (let i = STAR_BIRTH_FLASHES.length - 1; i >= 0; i--) {
        STAR_BIRTH_FLASHES[i].age += dtStep;
        if (STAR_BIRTH_FLASHES[i].age >= STAR_BIRTH_FLASHES[i].lifetime) {
            STAR_BIRTH_FLASHES.splice(i, 1);
        }
    }
}

function buildStarBirthFlashRenderData(flashes, canvas, camera) {
    if (!flashes || flashes.length === 0) return [];

    const flashPositions = flashes.map(f => f.position);
    const { projected, mask } = project(flashPositions, canvas, camera);
    const basis = getCameraBasis(camera);

    const renderData = [];

    for (let i = 0; i < flashes.length; i++) {
        if (!mask[i]) continue;

        const flash = flashes[i];
        const rel = [
            flash.position[0] - basis.position[0],
            flash.position[1] - basis.position[1],
            flash.position[2] - basis.position[2]
        ];

        const zCam = vecDot(rel, basis.forward);
        if (zCam <= camera.nearPlane) continue;

        const progress = Math.max(0, Math.min(1, flash.age / flash.lifetime));
        const screenMaxRadius = camera.focalLength * flash.maxWorldRadius / (zCam + 1e-6);

        renderData.push({
            screenX: projected[i][0],
            screenY: projected[i][1],
            progress,
            screenMaxRadius,
            color: flash.color
        });
    }

    return renderData;
}

function addSupernovaEvent(position) {
    SUPERNOVA_EVENTS.push({
        position: position.slice(),
        age: 0,
        lifetime: SUPERNOVA_EVENT_LIFETIME,
        maxWorldRadius: SUPERNOVA_EVENT_MAX_WORLD_RADIUS,
        color: SUPERNOVA_EVENT_COLOR.slice()
    });
}

function updateSupernovaEvents(dtStep) {
    if (SUPERNOVA_EVENTS.length === 0) return;

    for (let i = SUPERNOVA_EVENTS.length - 1; i >= 0; i--) {
        SUPERNOVA_EVENTS[i].age += dtStep;
        if (SUPERNOVA_EVENTS[i].age >= SUPERNOVA_EVENTS[i].lifetime) {
            SUPERNOVA_EVENTS.splice(i, 1);
        }
    }
}

function buildSupernovaRenderData(events, canvas, camera) {
    if (!events || events.length === 0) return [];

    const positions = events.map(e => e.position);
    const { projected, mask } = project(positions, canvas, camera);
    const basis = getCameraBasis(camera);

    const renderData = [];

    for (let i = 0; i < events.length; i++) {
        if (!mask[i]) continue;

        const event = events[i];
        const rel = [
            event.position[0] - basis.position[0],
            event.position[1] - basis.position[1],
            event.position[2] - basis.position[2]
        ];

        const zCam = vecDot(rel, basis.forward);
        if (zCam <= camera.nearPlane) continue;

        const progress = Math.max(0, Math.min(1, event.age / event.lifetime));
        const screenMaxRadius = camera.focalLength * event.maxWorldRadius / (zCam + 1e-6);

        renderData.push({
            screenX: projected[i][0],
            screenY: projected[i][1],
            progress,
            screenMaxRadius,
            color: event.color
        });
    }

    return renderData;
}

function triggerSupernovaAtIndex(starIndex) {
    const starData = STAR_PARTICLE_DATA[starIndex];
    if (!starData || !starData.isActive || starData.hasSupernovaTriggered) return;

    const explosionPosition = positions[starIndex].slice();
    const explosionVelocity = velocities[starIndex].slice();

    const outcome = apply_supernova_outcome_to_star(starData);
    if (outcome.returnedGasMass > 0) {
        const ejecta = spawn_supernova_gas_particles(
            explosionPosition,
            explosionVelocity,
            outcome.returnedGasMass,
            NEXT_GAS_SOURCE_ID++
        );
        GAS_PARTICLES.push(...ejecta);
    }

    addSupernovaEvent(explosionPosition);
}

function promoteBlackHoleToCore(starIndex) {
    const starData = STAR_PARTICLE_DATA[starIndex];
    if (!isBlackHoleStar(starData)) return;
    if (starData.isPromotedCore) return;
    if (core_set.has(starIndex)) return;

    core_indices.push(starIndex);
    core_set.add(starIndex);

    starData.isPromotedCore = true;
    starData.promotedCoreSlot = core_indices.length - 1;

    CORE_MASSES.push(starData.currentMass);

    // Dynamic promoted black hole cores do not get a full galaxy potential.
    M_bulge.push(0.0);
    A_bulge.push(A_BULGE);
    M_disk.push(0.0);
    A_disk.push(A_DISK);
    B_disk.push(B_DISK);
    V_halo.push(0.0);
    R_core.push(R_CORE);

    C = core_indices.length;
}

function syncDynamicBlackHoleCoreMasses() {
    for (let slot = CORE_POS_INIT.length; slot < core_indices.length; slot++) {
        const particleIndex = core_indices[slot];
        const starData = STAR_PARTICLE_DATA[particleIndex];
        if (isBlackHoleStar(starData)) {
            CORE_MASSES[slot] = starData.currentMass;
        }
    }
}

// Initialize simulation
function init() {
    syncLegacyCoreGlobals();

    log_max_radius = Math.log(disk_radius + 1e-6);

    const dvec = [
        CORE_POS_INIT[1][0] - CORE_POS_INIT[0][0],
        CORE_POS_INIT[1][1] - CORE_POS_INIT[0][1],
        CORE_POS_INIT[1][2] - CORE_POS_INIT[0][2]
    ];
    const d = norm(dvec);
    const u = dvec.map(v => v / (d + 1e-12));
    const perp = [-u[1], u[0], 0.0];

    const M1 = CORE_MASSES[0];
    const M2 = CORE_MASSES[1];
    const omega = Math.sqrt((M1 + M2) / (d**3 + 1e-12));
    const r1 = d * (M2 / (M1 + M2));
    const r2 = d * (M1 / (M1 + M2));
    const v1 = omega * r1;
    const v2 = omega * r2;

    let CORE_VEL_INIT = [
        perp.map(v => v * v1 * CORE_VEL_SCALES[0]),
        perp.map(v => v * -v2 * CORE_VEL_SCALES[1])
    ];

    const res = build_multi_galaxy(CORE_POS_INIT, CORE_VEL_INIT, CORE_PARTICLE_COUNTS);
    positions = res.positions;
    velocities = res.velocities;
    STAR_PARTICLE_DATA = res.star_particle_data;
    core_indices = res.core_indices;
    BLOCK_SIZE = res.block_sizes[0] || 0;
    C = core_indices.length;
    core_set = new Set(core_indices);
    CORES = core_indices.map(i => positions[i].slice());

    const params = make_core_params(C);
    M_bulge = params.m_bulge;
    A_bulge = params.a_bulge;
    M_disk = params.m_disk;
    A_disk = params.a_disk;
    B_disk = params.b_disk;
    V_halo = params.v_halo;
    R_core = params.r_core;

    GAS_PARTICLES = spawn_initial_gas_particles(CORE_POS_INIT, CORE_VEL_INIT);
    gasParticleAcc = compute_gas_particle_accelerations(
        GAS_PARTICLES,
        CORES,
        M_bulge, A_bulge,
        M_disk, A_disk, B_disk,
        V_halo, R_core,
        build_black_hole_sources(positions, STAR_PARTICLE_DATA)
    );

    STAR_BIRTH_FLASHES = [];
    SUPERNOVA_EVENTS = [];
    NEXT_GAS_SOURCE_ID = 100000;

    forces = compute_forces_multi(
        positions, CORES,
        M_bulge, A_bulge,
        M_disk, A_disk, B_disk,
        V_halo, R_core
    );

    core_indices.forEach(i => {
        forces[i] = [0, 0, 0];
    });

    add_core_core_forces(forces, CORES, CORE_MASSES, core_indices);

    // Important:
    // Do NOT apply stellar black-hole force mechanics to the primordial startup cores.
    add_black_hole_forces(forces, positions, STAR_PARTICLE_DATA, core_set);

    const target = getActiveCameraTarget();
    if (!camera.initialized || camera.followEnabled) {
        setCameraTarget(target, true);
    }

    buildCoreInspectorUI();
}

// Physics step
function update() {
    const scaledDt = dt * time_scale;
    if (scaledDt <= 0) return;

    for (let step = 0; step < physics_steps_per_frame; step++) {
        while (forces.length < positions.length) {
            forces.push([0, 0, 0]);
        }

        positions.forEach((p, i) => {
            p[0] += velocities[i][0] * scaledDt + 0.5 * forces[i][0] * scaledDt**2;
            p[1] += velocities[i][1] * scaledDt + 0.5 * forces[i][1] * scaledDt**2;
            p[2] += velocities[i][2] * scaledDt + 0.5 * forces[i][2] * scaledDt**2;
        });

        step_gas_particles(GAS_PARTICLES, gasParticleAcc, scaledDt);
        update_supernova_ejecta_heat(GAS_PARTICLES, scaledDt);

        const accretionResult = accrete_particles_onto_black_holes(
            GAS_PARTICLES,
            positions,
            velocities,
            STAR_PARTICLE_DATA,
            core_set
        );
        GAS_PARTICLES = accretionResult.gasParticles;

        for (let i = 0; i < accretionResult.promotedBlackHoleIndices.length; i++) {
            promoteBlackHoleToCore(accretionResult.promotedBlackHoleIndices[i]);
        }

        CORES = core_indices.map(i => positions[i].slice());
        C = core_indices.length;
        syncDynamicBlackHoleCoreMasses();

        let new_forces = compute_forces_multi(
            positions, CORES,
            M_bulge, A_bulge,
            M_disk, A_disk, B_disk,
            V_halo, R_core
        );

        core_indices.forEach(i => {
            new_forces[i] = [0, 0, 0];
        });

        add_core_core_forces(new_forces, CORES, CORE_MASSES, core_indices);
        add_black_hole_forces(new_forces, positions, STAR_PARTICLE_DATA, core_set);

        let newGasParticleAcc = compute_gas_particle_accelerations(
            GAS_PARTICLES,
            CORES,
            M_bulge, A_bulge,
            M_disk, A_disk, B_disk,
            V_halo, R_core,
            build_black_hole_sources(positions, STAR_PARTICLE_DATA)
        );

        velocities.forEach((v, j) => {
            v[0] += 0.5 * (forces[j][0] + new_forces[j][0]) * scaledDt;
            v[1] += 0.5 * (forces[j][1] + new_forces[j][1]) * scaledDt;
            v[2] += 0.5 * (forces[j][2] + new_forces[j][2]) * scaledDt;
        });

        finish_gas_particle_velocity_update(GAS_PARTICLES, gasParticleAcc, newGasParticleAcc, scaledDt);

        const formationResult = form_stars_from_gas(
            GAS_PARTICLES,
            positions,
            velocities,
            new_forces,
            STAR_PARTICLE_DATA,
            CORES
        );
        GAS_PARTICLES = formationResult.gasParticles;
        addStarBirthFlashes(formationResult.formedStars);

        const supernovaCandidates = update_all_star_lifecycles(STAR_PARTICLE_DATA, core_set);
        for (let i = 0; i < supernovaCandidates.length; i++) {
            triggerSupernovaAtIndex(supernovaCandidates[i]);
        }

        while (new_forces.length < positions.length) {
            new_forces.push([0, 0, 0]);
        }

        newGasParticleAcc = compute_gas_particle_accelerations(
            GAS_PARTICLES,
            CORES,
            M_bulge, A_bulge,
            M_disk, A_disk, B_disk,
            V_halo, R_core,
            build_black_hole_sources(positions, STAR_PARTICLE_DATA)
        );

        updateStarBirthFlashes(scaledDt);
        updateSupernovaEvents(scaledDt);

        forces = new_forces;
        gasParticleAcc = newGasParticleAcc;
    }
}

// Controls
function setupControls() {
    document.getElementById('dt').addEventListener('input', e => {
        dt = parseFloat(e.target.value);
        document.getElementById('dt_val').textContent = dt.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    });

    document.getElementById('time_scale').addEventListener('input', e => {
        time_scale = parseFloat(e.target.value);
        document.getElementById('time_scale_val').textContent = time_scale.toFixed(2);
    });

    document.getElementById('steps').addEventListener('input', e => {
        physics_steps_per_frame = parseInt(e.target.value);
        document.getElementById('steps_val').textContent = physics_steps_per_frame;
    });

    document.getElementById('r_max').addEventListener('input', e => {
        r_max = parseFloat(e.target.value);
        document.getElementById('r_max_val').textContent = r_max;
    });

    document.getElementById('k_tether').addEventListener('input', e => {
        k_tether = parseFloat(e.target.value);
        document.getElementById('k_tether_val').textContent = k_tether;
    });

    document.getElementById('enable_trails').addEventListener('change', e => {
        enable_trails = e.target.checked;
    });

    document.getElementById('trail_fade').addEventListener('input', e => {
        trail_fade = parseFloat(e.target.value);
        document.getElementById('trail_fade_val').textContent = e.target.value;
    });

    document.getElementById('star_render_mode').addEventListener('change', e => {
        star_render_mode = e.target.value;
    });

    document.getElementById('star_display_filter').addEventListener('change', e => {
        star_display_filter = e.target.value;
    });

    document.getElementById('disk_radius').addEventListener('input', e => {
        disk_radius = parseFloat(e.target.value);
        document.getElementById('disk_radius_val').textContent = e.target.value;
    });

    document.getElementById('velocity_noise').addEventListener('input', e => {
        velocity_noise = parseFloat(e.target.value);
        document.getElementById('velocity_noise_val').textContent = e.target.value;
    });

    document.getElementById('apply').addEventListener('click', () => {
        init();
    });
}

// Main loop
function loop() {
    update();

    const followTarget = getActiveCameraTarget();
    updateCameraFollow(followTarget);

    const { projected, mask } = project(positions, canvas, camera);
    const nearest_r = computeNearestRadii(positions, CORES, C);
    const gasParticleRenderData = buildGasParticleRenderData(GAS_PARTICLES, canvas, camera);
    const starBirthFlashRenderData = buildStarBirthFlashRenderData(STAR_BIRTH_FLASHES, canvas, camera);
    const supernovaRenderData = buildSupernovaRenderData(SUPERNOVA_EVENTS, canvas, camera);

    render(
        canvas,
        ctx,
        positions,
        CORES,
        core_indices,
        core_set,
        mask,
        projected,
        nearest_r,
        STAR_PARTICLE_DATA,
        star_render_mode,
        star_display_filter,
        gasParticleRenderData,
        starBirthFlashRenderData,
        supernovaRenderData
    );

    requestAnimationFrame(loop);
}

// Start everything
setupMouseControls(canvas);
setupControls();
init();
loop();