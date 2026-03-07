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
    if (CORES.length > 0) {
        return mean_pos(CORES);
    }
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

function buildCoreInspectorUI() {
    const coreList = document.getElementById('core-list');
    if (!coreList) return;

    coreList.innerHTML = '';

    for (let i = 0; i < CORE_POS_INIT.length; i++) {
        const item = document.createElement('div');
        item.className = 'core-item';
        if (i === selectedCoreIndex) {
            item.classList.add('selected');
        }

        const header = document.createElement('button');
        header.className = 'core-header';
        header.type = 'button';
        header.innerHTML = `
            Core ${i + 1}
            <span class="core-meta">
                Mass: ${Math.round(CORE_MASSES[i])} | Particles: ${CORE_PARTICLE_COUNTS[i]} | Vel Scale: ${CORE_VEL_SCALES[i].toFixed(2)}
            </span>
        `;

        header.addEventListener('click', () => {
            toggleCoreSelection(i);
        });

        const editor = document.createElement('div');
        editor.className = 'core-editor';

        editor.innerHTML = `
            <h4>Core ${i + 1} Parameters</h4>

            <label>
                Particle Count:
                <input type="range" id="core_particles_${i}" min="100" max="2000" step="100" value="${CORE_PARTICLE_COUNTS[i]}">
                <span id="core_particles_val_${i}">${CORE_PARTICLE_COUNTS[i]}</span>
            </label>

            <label>
                Core Mass:
                <input type="range" id="core_mass_${i}" min="1000" max="10000" step="100" value="${CORE_MASSES[i]}">
                <span id="core_mass_val_${i}">${CORE_MASSES[i]}</span>
            </label>

            <label>
                Core Velocity Scale:
                <input type="range" id="core_vel_scale_${i}" min="0.5" max="1.5" step="0.1" value="${CORE_VEL_SCALES[i]}">
                <span id="core_vel_scale_val_${i}">${CORE_VEL_SCALES[i].toFixed(1)}</span>
            </label>

            <button type="button" class="core-apply-btn" id="core_apply_${i}">Apply Core Settings & Restart</button>

            <div class="core-editor-note">
                Particle count and velocity scale are initialization values, so they take effect after restart.
                Mass updates immediately and is also used on restart.
            </div>
        `;

        item.appendChild(header);
        item.appendChild(editor);
        coreList.appendChild(item);

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

    meta.textContent =
        `Mass: ${Math.round(CORE_MASSES[coreIdx])} | ` +
        `Particles: ${CORE_PARTICLE_COUNTS[coreIdx]} | ` +
        `Vel Scale: ${CORE_VEL_SCALES[coreIdx].toFixed(2)}`;
}

// Initialize simulation
function init() {
    syncLegacyCoreGlobals();

    log_max_radius = Math.log(disk_radius + 1e-6);

    // Compute circular orbit velocities for cores
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
    core_indices = res.core_indices;
    BLOCK_SIZE = res.block_sizes[0] || 0;
    C = CORE_POS_INIT.length;
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

    const target = getActiveCameraTarget();
    if (!camera.initialized || camera.followEnabled) {
        setCameraTarget(target, true);
    }
}

// Physics step
function update() {
    for (let step = 0; step < physics_steps_per_frame; step++) {
        positions.forEach((p, i) => {
            p[0] += velocities[i][0] * dt + 0.5 * forces[i][0] * dt**2;
            p[1] += velocities[i][1] * dt + 0.5 * forces[i][1] * dt**2;
            p[2] += velocities[i][2] * dt + 0.5 * forces[i][2] * dt**2;
        });

        CORES = core_indices.map(i => positions[i].slice());

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

        velocities.forEach((v, j) => {
            v[0] += 0.5 * (forces[j][0] + new_forces[j][0]) * dt;
            v[1] += 0.5 * (forces[j][1] + new_forces[j][1]) * dt;
            v[2] += 0.5 * (forces[j][2] + new_forces[j][2]) * dt;
        });

        forces = new_forces;
    }
}

// Controls
function setupControls() {
    document.getElementById('dt').addEventListener('input', e => {
        dt = parseFloat(e.target.value);
        document.getElementById('dt_val').textContent = dt;
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
        buildCoreInspectorUI();
    });
}

// Main loop
function loop() {
    update();

    const followTarget = getActiveCameraTarget();
    updateCameraFollow(followTarget);

    const { projected, mask } = project(positions, canvas, camera);
    const nearest_r = computeNearestRadii(positions, CORES, C);

    render(canvas, ctx, positions, CORES, core_indices, core_set, mask, projected, nearest_r);

    requestAnimationFrame(loop);
}

// Start everything
setupMouseControls(canvas);
setupControls();
buildCoreInspectorUI();
init();
loop();