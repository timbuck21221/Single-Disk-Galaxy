// Particle & galaxy initialization

function randRange(min, max) {
    return min + Math.random() * (max - min);
}

function classify_star_type_from_mass(mass) {
    if (mass < STAR_MASS_BROWN_DWARF_MAX) return STAR_TYPE_BROWN_DWARF;
    if (mass < STAR_MASS_LOW_MASS_MAX) return STAR_TYPE_LOW_MASS;
    if (mass < STAR_MASS_MAIN_SEQUENCE_MAX) return STAR_TYPE_MAIN_SEQUENCE;
    return STAR_TYPE_MASSIVE;
}

function sample_star_metallicity() {
    return randRange(STAR_METALLICITY_MIN, STAR_METALLICITY_MAX);
}

function create_star_particle_data(mass, origin = 'initial', metallicity = null, sourceCoreIndex = -1) {
    const resolvedMetallicity = metallicity !== null ? metallicity : sample_star_metallicity();

    return {
        mass,
        metallicity: resolvedMetallicity,
        age: 0.0,
        origin,
        sourceCoreIndex,
        starType: classify_star_type_from_mass(mass)
    };
}

function sample_initial_star_mass() {
    const u = Math.random();

    const w0 = STAR_INIT_WEIGHT_BROWN_DWARF;
    const w1 = w0 + STAR_INIT_WEIGHT_LOW_MASS;
    const w2 = w1 + STAR_INIT_WEIGHT_MAIN_SEQUENCE;

    if (u < w0) {
        return randRange(STAR_INIT_MASS_BROWN_DWARF_MIN, STAR_INIT_MASS_BROWN_DWARF_MAX);
    }

    if (u < w1) {
        return randRange(STAR_INIT_MASS_LOW_MASS_MIN, STAR_INIT_MASS_LOW_MASS_MAX);
    }

    if (u < w2) {
        return randRange(STAR_INIT_MASS_MAIN_SEQUENCE_MIN, STAR_INIT_MASS_MAIN_SEQUENCE_MAX);
    }

    return randRange(STAR_INIT_MASS_MASSIVE_MIN, STAR_INIT_MASS_MASSIVE_MAX);
}

function get_star_visual_profile(starData) {
    const fallback = {
        color: [255, 255, 255],
        glowAlpha: 0.10,
        baseRadius: PARTICLE_SIZE,
        massRadiusFactor: 0.18
    };

    if (!starData) return fallback;

    switch (starData.starType) {
        case STAR_TYPE_BROWN_DWARF:
            return {
                color: STAR_COLOR_BROWN_DWARF.slice(),
                glowAlpha: STAR_GLOW_ALPHA_BROWN_DWARF,
                baseRadius: STAR_BASE_RADIUS_BROWN_DWARF,
                massRadiusFactor: STAR_MASS_RADIUS_FACTOR_BROWN_DWARF
            };
        case STAR_TYPE_LOW_MASS:
            return {
                color: STAR_COLOR_LOW_MASS.slice(),
                glowAlpha: STAR_GLOW_ALPHA_LOW_MASS,
                baseRadius: STAR_BASE_RADIUS_LOW_MASS,
                massRadiusFactor: STAR_MASS_RADIUS_FACTOR_LOW_MASS
            };
        case STAR_TYPE_MAIN_SEQUENCE:
            return {
                color: STAR_COLOR_MAIN_SEQUENCE.slice(),
                glowAlpha: STAR_GLOW_ALPHA_MAIN_SEQUENCE,
                baseRadius: STAR_BASE_RADIUS_MAIN_SEQUENCE,
                massRadiusFactor: STAR_MASS_RADIUS_FACTOR_MAIN_SEQUENCE
            };
        case STAR_TYPE_MASSIVE:
            return {
                color: STAR_COLOR_MASSIVE.slice(),
                glowAlpha: STAR_GLOW_ALPHA_MASSIVE,
                baseRadius: STAR_BASE_RADIUS_MASSIVE,
                massRadiusFactor: STAR_MASS_RADIUS_FACTOR_MASSIVE
            };
        default:
            return fallback;
    }
}

function compute_star_screen_radius(starData) {
    if (!starData) return PARTICLE_SIZE;

    const visual = get_star_visual_profile(starData);
    const radius =
        visual.baseRadius +
        visual.massRadiusFactor * Math.log10(Math.max(1.0, starData.mass));

    return Math.max(STAR_SIZE_MIN, Math.min(STAR_SIZE_MAX, radius));
}

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

function build_multi_galaxy(core_pos_init, core_vel_init, core_particle_counts) {
    const C = core_pos_init.length;

    const positions = [];
    const velocities = [];
    const star_particle_data = [];
    const core_indices = new Array(C);
    const block_sizes = new Array(C);

    for (let c = 0; c < C; c++) {
        const particleCount = core_particle_counts[c];
        const template = initialize_single_galaxy(
            particleCount,
            disk_radius,
            CENTRAL_MASS,
            velocity_noise
        );

        const pos = template.positions.map(p => p.slice());
        const vel = template.velocities.map(v => v.slice());

        core_indices[c] = positions.length;
        block_sizes[c] = pos.length;

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

        for (let i = 0; i < pos.length; i++) {
            positions.push(pos[i]);
            velocities.push(vel[i]);

            if (i === 0) {
                star_particle_data.push(null);
            } else {
                const mass = sample_initial_star_mass();
                star_particle_data.push(
                    create_star_particle_data(mass, 'initial', null, c)
                );
            }
        }
    }

    return { positions, velocities, star_particle_data, core_indices, block_sizes };
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