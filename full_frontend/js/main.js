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

// Resize handling
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Initialize simulation
function init() {
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
    const M1 = CORE_MASSES[0], M2 = CORE_MASSES[1];
    const omega = Math.sqrt((M1 + M2) / (d**3 + 1e-12));
    const r1 = d * (M2 / (M1 + M2));
    const r2 = d * (M1 / (M1 + M2));
    const v1 = omega * r1;
    const v2 = omega * r2;
    let CORE_VEL_INIT = [
        perp.map(v => v * v1),
        perp.map(v => v * -v2)
    ];
    CORE_VEL_INIT = CORE_VEL_INIT.map(vel => vel.map(v => v * core_vel_scale));

    const res = build_multi_galaxy(CORE_POS_INIT, CORE_VEL_INIT, n_per_core);
    positions = res.positions;
    velocities = res.velocities;
    core_indices = res.core_indices;
    BLOCK_SIZE = res.block_size;
    C = CORE_POS_INIT.length;
    core_set = new Set(core_indices);
    CORES = core_indices.map(i => positions[i].slice());

    const params = make_core_params(C);
    M_bulge = params.m_bulge; A_bulge = params.a_bulge;
    M_disk  = params.m_disk;  A_disk  = params.a_disk;  B_disk = params.b_disk;
    V_halo  = params.v_halo;  R_core  = params.r_core;

    forces = compute_forces_multi(positions, CORES, M_bulge, A_bulge, M_disk, A_disk, B_disk, V_halo, R_core);
    core_indices.forEach(i => forces[i] = [0,0,0]);
    add_core_core_forces(forces, CORES, CORE_MASSES, core_indices);
}

// Physics step
function update() {
    for (let step = 0; step < physics_steps_per_frame; step++) {
        // Verlet position update
        positions.forEach((p, i) => {
            p[0] += velocities[i][0] * dt + 0.5 * forces[i][0] * dt**2;
            p[1] += velocities[i][1] * dt + 0.5 * forces[i][1] * dt**2;
            p[2] += velocities[i][2] * dt + 0.5 * forces[i][2] * dt**2;
        });

        CORES = core_indices.map(i => positions[i].slice());

        let new_forces = compute_forces_multi(positions, CORES, M_bulge, A_bulge, M_disk, A_disk, B_disk, V_halo, R_core);
        core_indices.forEach(i => new_forces[i] = [0,0,0]);
        add_core_core_forces(new_forces, CORES, CORE_MASSES, core_indices);

        // Velocity update
        velocities.forEach((v, j) => {
            v[0] += 0.5 * (forces[j][0] + new_forces[j][0]) * dt;
            v[1] += 0.5 * (forces[j][1] + new_forces[j][1]) * dt;
            v[2] += 0.5 * (forces[j][2] + new_forces[j][2]) * dt;
        });

        forces = new_forces;
    }
}

// Main loop
function loop() {
    update();

    const camera_center = mean_pos(CORES);
    const { projected, mask } = project(positions, camera_center, camera_rot, 600, zoom);
    const nearest_r = computeNearestRadii(positions, CORES, C);

    render(canvas, ctx, positions, CORES, core_indices, core_set, mask, projected, nearest_r);

    requestAnimationFrame(loop);
}

// Controls
function setupControls() {
    document.getElementById('core_mass').addEventListener('input', e => {
        core_mass = parseFloat(e.target.value);
        document.getElementById('core_mass_val').textContent = core_mass;
        CORE_MASSES.fill(core_mass);
    });

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
        document.getElementById('trail_fade_val').textContent = trail_fade;
    });

    document.getElementById('apply').addEventListener('click', () => {
        n_per_core     = parseInt(document.getElementById('n_per_core').value);
        disk_radius    = parseFloat(document.getElementById('disk_radius').value);
        velocity_noise = parseFloat(document.getElementById('velocity_noise').value);
        core_vel_scale = parseFloat(document.getElementById('core_vel_scale').value);
        init();
    });
}

// Start everything
setupMouseControls(canvas);
setupControls();
init();
loop();
