// script.js
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const SCREEN_SIZE = 1000;
const PARTICLE_SIZE = 1;
const CORE_SIZE = 4;
const G = 1.0;
const SOFTENING = 0.15;
const CORE_SOFTENING = 0.6;
const R_MAX = 120.0;
const K_TETHER = 0.002;
const M_BULGE = 800.0;
const A_BULGE = 0.5;
const M_DISK = 1200.0;
const A_DISK = 4.0;
const B_DISK = 0.4;
const V_HALO = 12.0;
const R_CORE = 6.0;
const CENTRAL_MASS = 1500.0; // Used in init only, not physics
const CORE_POS_INIT = [[0.0, 0.0, 0.0], [18.0, 0.0, 0.0]];

let dt = 0.02;
let physics_steps_per_frame = 2;
let n_per_core = 500;
let disk_radius = 8.0;
let velocity_noise = 0.01;
let core_vel_scale = 1.0;
let core_mass = 3500.0;
let CORE_MASSES = new Array(2).fill(core_mass);
let log_max_radius = Math.log(disk_radius + 1e-6);

let positions = [];
let velocities = [];
let forces = [];
let CORES = [];
let core_indices = [];
let BLOCK_SIZE = 0;
let C = 0;
let core_set = new Set();
let camera_rot = [0.0, 0.0];
let mouse_down = false;
let last_mouse_pos = null;
let zoom = 0.5;
let M_bulge, A_bulge, M_disk, A_disk, B_disk, V_halo, R_core;

function gaussian(mean, std) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z0;
}

function norm(v) {
    return Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2);
}

function mean_pos(arr) {
    const s = [0, 0, 0];
    arr.forEach(a => {
        s[0] += a[0];
        s[1] += a[1];
        s[2] += a[2];
    });
    return s.map(ss => ss / arr.length);
}

function _accel_one_core(dx, dy, dz, m_bulge, a_bulge, m_disk, a_disk, b_disk, v_halo, r_core) {
    const x = dx;
    const y = dy;
    const z = dz;
    const r2 = x*x + y*y + z*z + SOFTENING*SOFTENING;
    const r = Math.sqrt(r2) + 1e-12;

    // Bulge
    const denom_b = (r2 + a_bulge*a_bulge) ** 1.5;
    const ax_b = -G * m_bulge * x / denom_b;
    const ay_b = -G * m_bulge * y / denom_b;
    const az_b = -G * m_bulge * z / denom_b;

    // Disk
    const R = Math.sqrt(x*x + y*y) + 1e-12;
    const B = a_disk + Math.sqrt(z*z + b_disk*b_disk);
    const denom_d = (R*R + B*B) ** 1.5;
    const ax_d = -G * m_disk * x / denom_d;
    const ay_d = -G * m_disk * y / denom_d;
    const sqrt_term = Math.sqrt(z*z + b_disk*b_disk) + 1e-12;
    const az_d = -G * m_disk * B * z / (sqrt_term * denom_d);

    // Halo
    const denom_h = r2 + r_core*r_core;
    const ax_h = -2.0 * v_halo*v_halo * x / denom_h;
    const ay_h = -2.0 * v_halo*v_halo * y / denom_h;
    const az_h = -2.0 * v_halo*v_halo * z / denom_h;

    return [ax_b + ax_d + ax_h, ay_b + ay_d + ay_h, az_b + az_d + az_h];
}

function acceleration_at_point(x, y, z) {
    return _accel_one_core(x, y, z, M_BULGE, A_BULGE, M_DISK, A_DISK, B_DISK, V_HALO, R_CORE);
}

function circular_velocity(x, y) {
    const R = Math.sqrt(x*x + y*y) + 1e-12;
    const [ax, ay, _] = acceleration_at_point(x, y, 0.0);
    const a_R = (ax * x + ay * y) / R;
    return Math.sqrt(R * Math.abs(a_R));
}

function initialize_particles(N, disk_radius, central_mass, velocity_noise, scale_height = 0.2) {
    const R_d = disk_radius / 3.0;
    const r = new Array(N);
    const theta = new Array(N);
    const z_arr = new Array(N);
    const x = new Array(N);
    const y = new Array(N);
    for (let i = 0; i < N; i++) {
        r[i] = -R_d * Math.log(1 - Math.random());
        r[i] = Math.max(0.5, Math.min(disk_radius, r[i]));
        theta[i] = Math.random() * 2 * Math.PI;
        z_arr[i] = gaussian(0, scale_height);
        x[i] = r[i] * Math.cos(theta[i]);
        y[i] = r[i] * Math.sin(theta[i]);
    }

    const positions = new Array(N);
    const velocities = new Array(N);
    for (let i = 0; i < N; i++) {
        positions[i] = [x[i], y[i], z_arr[i]];
        const v_circ = circular_velocity(x[i], y[i]);
        const vx = -v_circ * Math.sin(theta[i]) + gaussian(0, velocity_noise);
        const vy = v_circ * Math.cos(theta[i]) + gaussian(0, velocity_noise);
        const vz = gaussian(0, velocity_noise * 0.1);
        velocities[i] = [vx, vy, vz];
    }

    // Add core
    positions.unshift([0.0, 0.0, 0.0]);
    velocities.unshift([0.0, 0.0, 0.0]);

    return { positions, velocities };
}

function build_multi_galaxy(core_pos_init, core_vel_init, n_per_core) {
    const C = core_pos_init.length;
    const { positions: template_pos, velocities: template_vel } = initialize_particles(
        n_per_core, disk_radius, CENTRAL_MASS, velocity_noise
    );
    const block_size = template_pos.length; // n_per_core + 1

    const positions_blocks = [];
    const velocities_blocks = [];
    const core_indices_local = new Array(C);

    for (let c = 0; c < C; c++) {
        const pos = template_pos.map(p => p.slice());
        const vel = template_vel.map(v => v.slice());

        // Offset
        pos.forEach(p => {
            p[0] += core_pos_init[c][0];
            p[1] += core_pos_init[c][1];
            p[2] += core_pos_init[c][2];
        });

        // Override core
        pos[0] = core_pos_init[c].slice();

        // Add bulk velocity
        vel.forEach(v => {
            v[0] += core_vel_init[c][0];
            v[1] += core_vel_init[c][1];
            v[2] += core_vel_init[c][2];
        });

        // Override core vel
        vel[0] = core_vel_init[c].slice();

        core_indices_local[c] = c * block_size;
        positions_blocks.push(pos);
        velocities_blocks.push(vel);
    }

    const positions = [].concat(...positions_blocks);
    const velocities = [].concat(...velocities_blocks);
    return { positions, velocities, core_indices: core_indices_local, block_size };
}

function compute_forces_multi(pos, core_pos, m_bulge, a_bulge, m_disk, a_disk, b_disk, v_halo, r_core) {
    const N = pos.length;
    const C = core_pos.length;
    const forces = new Array(N).fill(0).map(() => [0, 0, 0]);

    const bx = mean_pos(core_pos);

    for (let i = 0; i < N; i++) {
        const [x, y, z] = pos[i];
        let ax = 0;
        let ay = 0;
        let az = 0;

        for (let c = 0; c < C; c++) {
            const dx = x - core_pos[c][0];
            const dy = y - core_pos[c][1];
            const dz = z - core_pos[c][2];
            const [axt, ayt, azt] = _accel_one_core(
                dx, dy, dz,
                m_bulge[c], a_bulge[c],
                m_disk[c], a_disk[c], b_disk[c],
                v_halo[c], r_core[c]
            );
            ax += axt;
            ay += ayt;
            az += azt;
        }

        // Tether
        const tx = x - bx[0];
        const ty = y - bx[1];
        const tz = z - bx[2];
        const rr = Math.sqrt(tx*tx + ty*ty + tz*tz) + 1e-12;
        if (rr > R_MAX) {
            const factor = -K_TETHER * (rr - R_MAX);
            ax += factor * tx / rr;
            ay += factor * ty / rr;
            az += factor * tz / rr;
        }

        forces[i] = [ax, ay, az];
    }
    return forces;
}

function add_core_core_forces(forces, core_pos, core_masses, core_indices) {
    const C = core_pos.length;
    for (let a = 0; a < C; a++) {
        const ia = core_indices[a];
        const [xa, ya, za] = core_pos[a];
        let ax = 0;
        let ay = 0;
        let az = 0;

        for (let b = 0; b < C; b++) {
            if (b === a) continue;
            const dx = xa - core_pos[b][0];
            const dy = ya - core_pos[b][1];
            const dz = za - core_pos[b][2];
            const r2 = dx*dx + dy*dy + dz*dz + CORE_SOFTENING*CORE_SOFTENING;
            const inv_r3 = 1.0 / (r2 * Math.sqrt(r2) + 1e-12);
            ax += -G * core_masses[b] * dx * inv_r3;
            ay += -G * core_masses[b] * dy * inv_r3;
            az += -G * core_masses[b] * dz * inv_r3;
        }

        forces[ia][0] += ax;
        forces[ia][1] += ay;
        forces[ia][2] += az;
    }
}

function make_core_params(C) {
    return {
        m_bulge: new Array(C).fill(M_BULGE),
        a_bulge: new Array(C).fill(A_BULGE),
        m_disk: new Array(C).fill(M_DISK),
        a_disk: new Array(C).fill(A_DISK),
        b_disk: new Array(C).fill(B_DISK),
        v_halo: new Array(C).fill(V_HALO),
        r_core: new Array(C).fill(R_CORE)
    };
}

function project(pos, camera_pos, camera_rot, screen_size, focal_length = 500, zoom = 1.0) {
    const N = pos.length;
    const projected = new Array(N).fill(0).map(() => [0, 0]);
    const mask = new Array(N).fill(false);
    const yaw = camera_rot[0];
    const pitch = camera_rot[1];
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const eps = 1e-2;
    const f = focal_length * zoom;

    for (let i = 0; i < N; i++) {
        let px = pos[i][0] - camera_pos[0];
        let py = pos[i][1] - camera_pos[1];
        let pz = pos[i][2] - camera_pos[2];

        // Yaw
        const x1 = cy * px + sy * py;
        const y1 = -sy * px + cy * py;
        const z1 = pz;

        // Pitch
        const y2 = cp * y1 - sp * z1;
        const z2 = sp * y1 + cp * z1;
        const x2 = x1;

        const screen_x = screen_size / 2 + f * x2 / (z2 + 5 + eps);
        const screen_y = screen_size / 2 + f * y2 / (z2 + 5 + eps);
        projected[i] = [screen_x, screen_y];
        mask[i] = z2 > -4.9;
    }

    return { projected, mask };
}

function smooth_colormap(t) {
    const stops = [
        [0.0, [20, 20, 120]],
        [0.25, [0, 180, 255]],
        [0.5, [255, 255, 255]],
        [0.75, [255, 200, 50]],
        [1.0, [255, 60, 60]]
    ];
    for (let i = 0; i < stops.length - 1; i++) {
        const [t0, c0] = stops[i];
        const [t1, c1] = stops[i + 1];
        if (t0 <= t && t <= t1) {
            const u = (t - t0) / (t1 - t0);
            return [
                Math.round(c0[0] + u * (c1[0] - c0[0])),
                Math.round(c0[1] + u * (c1[1] - c0[1])),
                Math.round(c0[2] + u * (c1[2] - c0[2]))
            ];
        }
    }
    return stops[stops.length - 1][1];
}

function init() {
    log_max_radius = Math.log(disk_radius + 1e-6);

    // Core vel init
    const dvec = [CORE_POS_INIT[1][0] - CORE_POS_INIT[0][0], CORE_POS_INIT[1][1] - CORE_POS_INIT[0][1], CORE_POS_INIT[1][2] - CORE_POS_INIT[0][2]];
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
    let CORE_VEL_INIT = [perp.map(v => v * v1), perp.map(v => v * (-v2))];
    CORE_VEL_INIT = CORE_VEL_INIT.map(vel => vel.map(v => v * core_vel_scale));

    const { positions: pos, velocities: vel, core_indices: ci, block_size } = build_multi_galaxy(
        CORE_POS_INIT, CORE_VEL_INIT, n_per_core
    );
    positions = pos;
    velocities = vel;
    core_indices = ci;
    BLOCK_SIZE = block_size;
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

    forces = compute_forces_multi(positions, CORES, M_bulge, A_bulge, M_disk, A_disk, B_disk, V_halo, R_core);
    core_indices.forEach(i => { forces[i] = [0, 0, 0]; });
    add_core_core_forces(forces, CORES, CORE_MASSES, core_indices);
}

function update() {
    for (let _ = 0; _ < physics_steps_per_frame; _++) {
        positions.forEach((p, i) => {
            p[0] += velocities[i][0] * dt + 0.5 * forces[i][0] * dt * dt;
            p[1] += velocities[i][1] * dt + 0.5 * forces[i][1] * dt * dt;
            p[2] += velocities[i][2] * dt + 0.5 * forces[i][2] * dt * dt;
        });

        CORES = core_indices.map(i => positions[i].slice());

        let new_forces = compute_forces_multi(positions, CORES, M_bulge, A_bulge, M_disk, A_disk, B_disk, V_halo, R_core);
        core_indices.forEach(i => { new_forces[i] = [0, 0, 0]; });
        add_core_core_forces(new_forces, CORES, CORE_MASSES, core_indices);

        velocities.forEach((v, j) => {
            v[0] += 0.5 * (forces[j][0] + new_forces[j][0]) * dt;
            v[1] += 0.5 * (forces[j][1] + new_forces[j][1]) * dt;
            v[2] += 0.5 * (forces[j][2] + new_forces[j][2]) * dt;
        });

        forces = new_forces;
    }
}

function render() {
    const camera_center = mean_pos(CORES);
    const { projected, mask } = project(positions, camera_center, camera_rot, SCREEN_SIZE, 500, zoom);

    // Nearest r
    const nearest_r = new Array(positions.length);
    for (let i = 0; i < positions.length; i++) {
        let min_d2 = Infinity;
        for (let c = 0; c < C; c++) {
            const dx = positions[i][0] - CORES[c][0];
            const dy = positions[i][1] - CORES[c][1];
            const d2_xy = dx*dx + dy*dy;
            if (d2_xy < min_d2) min_d2 = d2_xy;
        }
        nearest_r[i] = Math.sqrt(min_d2) + 1e-6;
    }

    ctx.fillStyle = 'rgb(0,0,0)';
    ctx.fillRect(0, 0, SCREEN_SIZE, SCREEN_SIZE);

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

function loop() {
    update();
    render();
    requestAnimationFrame(loop);
}

// Events
canvas.addEventListener('mousedown', e => {
    if (e.button === 0) {
        mouse_down = true;
        last_mouse_pos = [e.clientX, e.clientY];
    }
});

canvas.addEventListener('mouseup', e => {
    if (e.button === 0) mouse_down = false;
});

canvas.addEventListener('mousemove', e => {
    if (mouse_down) {
        const dx = e.clientX - last_mouse_pos[0];
        const dy = e.clientY - last_mouse_pos[1];
        last_mouse_pos = [e.clientX, e.clientY];
        camera_rot[0] += dx * 0.005;
        camera_rot[1] += dy * 0.005;
        camera_rot[1] = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, camera_rot[1]));
    }
});

canvas.addEventListener('wheel', e => {
    zoom *= (1.0 - Math.sign(e.deltaY) * 0.1);
    zoom = Math.max(0.05, Math.min(6.0, zoom));
});

// Controls
const core_mass_input = document.getElementById('core_mass');
const core_mass_val = document.getElementById('core_mass_val');
core_mass_input.addEventListener('input', e => {
    core_mass = parseFloat(e.target.value);
    core_mass_val.textContent = core_mass;
    CORE_MASSES.fill(core_mass);
});

const dt_input = document.getElementById('dt');
const dt_val = document.getElementById('dt_val');
dt_input.addEventListener('input', e => {
    dt = parseFloat(e.target.value);
    dt_val.textContent = dt;
});

const steps_input = document.getElementById('steps');
const steps_val = document.getElementById('steps_val');
steps_input.addEventListener('input', e => {
    physics_steps_per_frame = parseInt(e.target.value);
    steps_val.textContent = physics_steps_per_frame;
});

const n_per_core_input = document.getElementById('n_per_core');
const n_per_core_val = document.getElementById('n_per_core_val');
n_per_core_input.addEventListener('input', e => {
    n_per_core_val.textContent = e.target.value;
});

const disk_radius_input = document.getElementById('disk_radius');
const disk_radius_val = document.getElementById('disk_radius_val');
disk_radius_input.addEventListener('input', e => {
    disk_radius_val.textContent = e.target.value;
});

const velocity_noise_input = document.getElementById('velocity_noise');
const velocity_noise_val = document.getElementById('velocity_noise_val');
velocity_noise_input.addEventListener('input', e => {
    velocity_noise_val.textContent = e.target.value;
});

const core_vel_scale_input = document.getElementById('core_vel_scale');
const core_vel_scale_val = document.getElementById('core_vel_scale_val');
core_vel_scale_input.addEventListener('input', e => {
    core_vel_scale_val.textContent = e.target.value;
});

document.getElementById('apply').addEventListener('click', () => {
    n_per_core = parseInt(n_per_core_input.value);
    disk_radius = parseFloat(disk_radius_input.value);
    velocity_noise = parseFloat(velocity_noise_input.value);
    core_vel_scale = parseFloat(core_vel_scale_input.value);
    init();
});

init();
loop();
