// Particle & galaxy initialization

function initialize_single_galaxy(N, disk_radius, central_mass, velocity_noise, scale_height = 0.2) {
    const R_d = disk_radius / 3.0;
    const positions = new Array(N + 1);
    const velocities = new Array(N + 1);

    positions[0] = [0, 0, 0];
    velocities[0] = [0, 0, 0];

    for (let i = 1; i <= N; i++) {
        const r = -R_d * Math.log(1 - Math.random());
        const clamped_r = Math.max(0.5, Math.min(disk_radius, r));
        const theta = Math.random() * 2 * Math.PI;
        const z = gaussian(0, scale_height);
        const x = clamped_r * Math.cos(theta);
        const y = clamped_r * Math.sin(theta);

        positions[i] = [x, y, z];

        const v_circ = circular_velocity(x, y);
        const vx = -v_circ * Math.sin(theta) + gaussian(0, velocity_noise);
        const vy =  v_circ * Math.cos(theta) + gaussian(0, velocity_noise);
        const vz = gaussian(0, velocity_noise * 0.1);
        velocities[i] = [vx, vy, vz];
    }

    return { positions, velocities };
}

function build_multi_galaxy(core_pos_init, core_vel_init, n_per_core) {
    const C = core_pos_init.length;
    const template = initialize_single_galaxy(n_per_core, disk_radius, CENTRAL_MASS, velocity_noise);
    const block_size = template.positions.length;

    const positions = [];
    const velocities = [];
    const core_indices = new Array(C);

    for (let c = 0; c < C; c++) {
        const pos = template.positions.map(p => p.slice());
        const vel = template.velocities.map(v => v.slice());

        // Offset disk + core
        pos.forEach(p => {
            p[0] += core_pos_init[c][0];
            p[1] += core_pos_init[c][1];
            p[2] += core_pos_init[c][2];
        });
        // Override exact core position
        pos[0] = core_pos_init[c].slice();

        // Add bulk velocity
        vel.forEach(v => {
            v[0] += core_vel_init[c][0];
            v[1] += core_vel_init[c][1];
            v[2] += core_vel_init[c][2];
        });
        vel[0] = core_vel_init[c].slice();

        core_indices[c] = c * block_size;
        positions.push(...pos);
        velocities.push(...vel);
    }

    return { positions, velocities, core_indices, block_size };
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
