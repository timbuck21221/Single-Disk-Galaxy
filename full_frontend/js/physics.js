// Physics: accelerations, forces, tether

function _accel_one_core(dx, dy, dz, m_bulge, a_bulge, m_disk, a_disk, b_disk, v_halo, r_core) {
    const x = dx, y = dy, z = dz;
    const r2 = x*x + y*y + z*z + SOFTENING*SOFTENING;
    const r = Math.sqrt(r2) + 1e-12;

    // Bulge (Plummer)
    const denom_b = (r2 + a_bulge*a_bulge) ** 1.5;
    const ax_b = -G * m_bulge * x / denom_b;
    const ay_b = -G * m_bulge * y / denom_b;
    const az_b = -G * m_bulge * z / denom_b;

    // Disk (Miyamoto-Nagai)
    const R = Math.sqrt(x*x + y*y) + 1e-12;
    const B = a_disk + Math.sqrt(z*z + b_disk*b_disk);
    const denom_d = (R*R + B*B) ** 1.5;
    const ax_d = -G * m_disk * x / denom_d;
    const ay_d = -G * m_disk * y / denom_d;
    const sqrt_term = Math.sqrt(z*z + b_disk*b_disk) + 1e-12;
    const az_d = -G * m_disk * B * z / (sqrt_term * denom_d);

    // Halo (isothermal)
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
    const [ax, ay] = acceleration_at_point(x, y, 0.0);
    const a_R = (ax * x + ay * y) / R;
    return Math.sqrt(R * Math.abs(a_R));
}

function compute_forces_multi(pos, core_pos, m_bulge, a_bulge, m_disk, a_disk, b_disk, v_halo, r_core) {
    const N = pos.length;
    const C = core_pos.length;
    const forces = new Array(N).fill(0).map(() => [0,0,0]);

    const barycenter = mean_pos(core_pos);

    for (let i = 0; i < N; i++) {
        const [x, y, z] = pos[i];
        let ax = 0, ay = 0, az = 0;

        for (let c = 0; c < C; c++) {
            const dx = x - core_pos[c][0];
            const dy = y - core_pos[c][1];
            const dz = z - core_pos[c][2];
            const [axt, ayt, azt] = _accel_one_core(dx, dy, dz,
                m_bulge[c], a_bulge[c], m_disk[c], a_disk[c], b_disk[c],
                v_halo[c], r_core[c]);
            ax += axt; ay += ayt; az += azt;
        }

        // Soft tether to barycenter
        const tx = x - barycenter[0];
        const ty = y - barycenter[1];
        const tz = z - barycenter[2];
        const rr = Math.sqrt(tx*tx + ty*ty + tz*tz) + 1e-12;
        if (rr > r_max) {
            const factor = -k_tether * (rr - r_max);
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
        let ax = 0, ay = 0, az = 0;

        for (let b = 0; b < C; b++) {
            if (b === a) continue;
            const dx = xa - core_pos[b][0];
            const dy = ya - core_pos[b][1];
            const dz = za - core_pos[b][2];
            const r2 = dx*dx + dy*dy + dz*dz + CORE_SOFTENING*CORE_SOFTENING;
            const inv_r3 = 1 / (r2 * Math.sqrt(r2) + 1e-12);
            ax -= G * core_masses[b] * dx * inv_r3;
            ay -= G * core_masses[b] * dy * inv_r3;
            az -= G * core_masses[b] * dz * inv_r3;
        }

        forces[ia][0] += ax;
        forces[ia][1] += ay;
        forces[ia][2] += az;
    }
}
