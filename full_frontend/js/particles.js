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

function get_star_branch_target_type(birthClass) {
    if (birthClass === STAR_TYPE_MASSIVE) return STAR_TYPE_RED_SUPERGIANT;
    if (birthClass === STAR_TYPE_MAIN_SEQUENCE) return STAR_TYPE_RED_GIANT;
    if (birthClass === STAR_TYPE_LOW_MASS) return STAR_TYPE_RED_GIANT;
    return birthClass;
}

function get_star_evolution_age_threshold(birthClass) {
    switch (birthClass) {
        case STAR_TYPE_LOW_MASS:
            return STAR_EVOLVE_AGE_LOW_MASS;
        case STAR_TYPE_MAIN_SEQUENCE:
            return STAR_EVOLVE_AGE_MAIN_SEQUENCE;
        case STAR_TYPE_MASSIVE:
            return STAR_EVOLVE_AGE_MASSIVE;
        default:
            return Infinity;
    }
}

function get_star_evolution_chance_rate(birthClass) {
    switch (birthClass) {
        case STAR_TYPE_LOW_MASS:
            return STAR_EVOLVE_CHANCE_RATE_LOW_MASS;
        case STAR_TYPE_MAIN_SEQUENCE:
            return STAR_EVOLVE_CHANCE_RATE_MAIN_SEQUENCE;
        case STAR_TYPE_MASSIVE:
            return STAR_EVOLVE_CHANCE_RATE_MASSIVE;
        default:
            return 0.0;
    }
}

function get_star_target_mass(birthClass, birthMass) {
    switch (birthClass) {
        case STAR_TYPE_LOW_MASS:
            return birthMass * STAR_RED_GIANT_TARGET_MASS_FACTOR_LOW;
        case STAR_TYPE_MAIN_SEQUENCE:
            return birthMass * STAR_RED_GIANT_TARGET_MASS_FACTOR_MAIN;
        case STAR_TYPE_MASSIVE:
            return birthMass * STAR_RED_SUPERGIANT_TARGET_MASS_FACTOR;
        default:
            return birthMass;
    }
}

function create_star_particle_data(mass, origin = 'initial', metallicity = null, sourceCoreIndex = -1) {
    const resolvedMetallicity = metallicity !== null ? metallicity : sample_star_metallicity();
    const birthClass = classify_star_type_from_mass(mass);

    return {
        birthMass: mass,
        currentMass: mass,
        metallicity: resolvedMetallicity,
        age: 0.0,
        origin,
        sourceCoreIndex,
        birthClass,
        starType: birthClass,
        evolutionTriggered: false,
        evolutionTargetType: get_star_branch_target_type(birthClass),
        evolutionTargetMass: get_star_target_mass(birthClass, mass),
        canExplodeLater: birthClass === STAR_TYPE_MASSIVE
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

function evolve_star_mass_and_type(starData, dtStep) {
    if (!starData) return;
    if (starData.birthClass === STAR_TYPE_BROWN_DWARF) return;

    starData.age += dtStep * STAR_AGE_RATE;

    if (!starData.evolutionTriggered) {
        const ageThreshold = get_star_evolution_age_threshold(starData.birthClass);
        if (starData.age >= ageThreshold) {
            const chanceRate = get_star_evolution_chance_rate(starData.birthClass);
            const perStepChance = 1.0 - Math.exp(-chanceRate * dtStep * STAR_AGE_RATE);
            if (Math.random() < perStepChance) {
                starData.evolutionTriggered = true;
                starData.starType = starData.evolutionTargetType;
            }
        }
    }

    if (!starData.evolutionTriggered) return;

    let growthRate = 0.0;
    if (starData.starType === STAR_TYPE_RED_GIANT) {
        growthRate = STAR_GIANT_MASS_GROWTH_RATE;
    } else if (starData.starType === STAR_TYPE_RED_SUPERGIANT) {
        growthRate = STAR_SUPERGIANT_MASS_GROWTH_RATE;
    }

    if (growthRate <= 0.0) return;

    const targetMass = starData.evolutionTargetMass;
    if (starData.currentMass >= targetMass) {
        starData.currentMass = targetMass;
        return;
    }

    const delta = growthRate * starData.birthMass * dtStep * STAR_AGE_RATE;
    starData.currentMass = Math.min(targetMass, starData.currentMass + delta);
}

function update_all_star_lifecycles(starParticleData, coreSet) {
    if (!starParticleData || starParticleData.length === 0) return;

    const scaledDt = dt * time_scale;
    if (scaledDt <= 0) return;

    for (let i = 0; i < starParticleData.length; i++) {
        if (!starParticleData[i]) continue;
        if (coreSet && coreSet.has(i)) continue;
        evolve_star_mass_and_type(starParticleData[i], scaledDt);
    }
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
        case STAR_TYPE_RED_GIANT:
            return {
                color: STAR_COLOR_RED_GIANT.slice(),
                glowAlpha: STAR_GLOW_ALPHA_RED_GIANT,
                baseRadius: STAR_BASE_RADIUS_RED_GIANT,
                massRadiusFactor: STAR_MASS_RADIUS_FACTOR_RED_GIANT
            };
        case STAR_TYPE_RED_SUPERGIANT:
            return {
                color: STAR_COLOR_RED_SUPERGIANT.slice(),
                glowAlpha: STAR_GLOW_ALPHA_RED_SUPERGIANT,
                baseRadius: STAR_BASE_RADIUS_RED_SUPERGIANT,
                massRadiusFactor: STAR_MASS_RADIUS_FACTOR_RED_SUPERGIANT
            };
        default:
            return fallback;
    }
}

function compute_star_screen_radius(starData) {
    if (!starData) return PARTICLE_SIZE;

    const visual = get_star_visual_profile(starData);
    const massForRadius = starData.currentMass ?? starData.birthMass ?? 1.0;
    const radius =
        visual.baseRadius +
        visual.massRadiusFactor * Math.log10(Math.max(1.0, massForRadius));

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