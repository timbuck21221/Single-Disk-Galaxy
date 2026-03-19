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

function sample_pulsar_spin_rate() {
    return randRange(PULSAR_BEAM_SPIN_RATE_MIN, PULSAR_BEAM_SPIN_RATE_MAX);
}

function sample_pulsar_pulse_rate() {
    return randRange(PULSAR_BEAM_PULSE_RATE_MIN, PULSAR_BEAM_PULSE_RATE_MAX);
}

function sample_pulsar_pulse_strength() {
    return randRange(PULSAR_BEAM_PULSE_STRENGTH_MIN, PULSAR_BEAM_PULSE_STRENGTH_MAX);
}

function initialize_pulsar_metadata(starData) {
    if (!starData) return;

    starData.isCompactObject = true;
    starData.isPulsar = true;
    starData.isBlackHole = false;
    starData.pulsarSpinPhase = randRange(0, Math.PI * 2);
    starData.pulsarSpinRate = sample_pulsar_spin_rate();
    starData.pulsarPulseRate = sample_pulsar_pulse_rate();
    starData.pulsarPulseStrength = sample_pulsar_pulse_strength();
    starData.pulsarBeamAngle = randRange(0, Math.PI * 2);
}

function initialize_black_hole_metadata(starData) {
    if (!starData) return;

    starData.isCompactObject = true;
    starData.isPulsar = false;
    starData.isBlackHole = true;
    starData.pulsarSpinPhase = 0.0;
    starData.pulsarSpinRate = 0.0;
    starData.pulsarPulseRate = 0.0;
    starData.pulsarPulseStrength = 0.0;
    starData.pulsarBeamAngle = 0.0;
}

function initialize_compact_object_defaults(starData) {
    if (!starData) return;

    starData.isCompactObject = false;
    starData.isPulsar = false;
    starData.isBlackHole = false;
    starData.pulsarSpinPhase = 0.0;
    starData.pulsarSpinRate = 0.0;
    starData.pulsarPulseRate = 0.0;
    starData.pulsarPulseStrength = 0.0;
    starData.pulsarBeamAngle = 0.0;
}

function isBlackHoleStar(starData) {
    return !!(starData && starData.isActive && starData.starType === STAR_TYPE_BLACK_HOLE && starData.isBlackHole);
}

function get_black_hole_influence_radius(starData) {
    if (!starData) return 0.0;
    return BLACK_HOLE_INFLUENCE_RADIUS_BASE +
        BLACK_HOLE_INFLUENCE_RADIUS_MASS_FACTOR * Math.log10(Math.max(1.0, starData.currentMass));
}

function get_black_hole_absorb_radius(starData, isStar = false) {
    if (!starData) return 0.0;

    const base = isStar
        ? BLACK_HOLE_STAR_ABSORB_RADIUS_BASE
        : BLACK_HOLE_GAS_ABSORB_RADIUS_BASE;

    const factor = isStar
        ? BLACK_HOLE_STAR_ABSORB_RADIUS_MASS_FACTOR
        : BLACK_HOLE_GAS_ABSORB_RADIUS_MASS_FACTOR;

    return base + factor * Math.log10(Math.max(1.0, starData.currentMass));
}

function build_black_hole_sources(positions, starParticleData) {
    const sources = [];
    if (!positions || !starParticleData) return sources;

    for (let i = 0; i < starParticleData.length; i++) {
        const starData = starParticleData[i];
        if (!isBlackHoleStar(starData)) continue;

        sources.push({
            index: i,
            position: positions[i],
            mass: starData.currentMass,
            influenceRadius: get_black_hole_influence_radius(starData),
            gasAbsorbRadius: get_black_hole_absorb_radius(starData, false),
            starAbsorbRadius: get_black_hole_absorb_radius(starData, true),
            isPromotedCore: !!starData.isPromotedCore
        });
    }

    return sources;
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

    const starData = {
        birthMass: mass,
        currentMass: mass,
        metallicity: resolvedMetallicity,
        age: 0.0,
        stageAge: 0.0,
        origin,
        sourceCoreIndex,
        birthClass,
        starType: birthClass,
        evolutionTriggered: false,
        evolutionTargetType: get_star_branch_target_type(birthClass),
        evolutionTargetMass: get_star_target_mass(birthClass, mass),
        canExplodeLater: birthClass === STAR_TYPE_MASSIVE,
        isActive: true,
        isRemnant: false,
        hasSupernovaTriggered: false,
        remnantClass: null,
        isPromotedCore: false,
        promotedCoreSlot: -1,
        accretedGasMass: 0.0,
        accretedStellarMass: 0.0
    };

    initialize_compact_object_defaults(starData);
    return starData;
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

function maybe_trigger_supernova(starData, dtStep) {
    if (!starData || !starData.isActive) return false;
    if (!starData.canExplodeLater) return false;
    if (starData.hasSupernovaTriggered) return false;
    if (starData.starType !== STAR_TYPE_RED_SUPERGIANT) return false;
    if (starData.stageAge < STAR_SUPERNOVA_STAGE_AGE_RED_SUPERGIANT) return false;

    const perStepChance = 1.0 - Math.exp(
        -STAR_SUPERNOVA_CHANCE_RATE_RED_SUPERGIANT * dtStep * STAR_AGE_RATE
    );

    return Math.random() < perStepChance;
}

function evolve_star_mass_and_type(starData, dtStep) {
    if (!starData) return false;
    if (!starData.isActive) return false;
    if (starData.birthClass === STAR_TYPE_BROWN_DWARF) return false;
    if (starData.isRemnant) return false;

    starData.age += dtStep * STAR_AGE_RATE;
    starData.stageAge += dtStep * STAR_AGE_RATE;

    if (!starData.evolutionTriggered) {
        const ageThreshold = get_star_evolution_age_threshold(starData.birthClass);
        if (starData.age >= ageThreshold) {
            const chanceRate = get_star_evolution_chance_rate(starData.birthClass);
            const perStepChance = 1.0 - Math.exp(-chanceRate * dtStep * STAR_AGE_RATE);
            if (Math.random() < perStepChance) {
                starData.evolutionTriggered = true;
                starData.starType = starData.evolutionTargetType;
                starData.stageAge = 0.0;
            }
        }
    }

    if (starData.evolutionTriggered) {
        let growthRate = 0.0;

        if (starData.starType === STAR_TYPE_RED_GIANT) {
            growthRate = STAR_GIANT_MASS_GROWTH_RATE;
        } else if (starData.starType === STAR_TYPE_RED_SUPERGIANT) {
            growthRate = STAR_SUPERGIANT_MASS_GROWTH_RATE;
        }

        if (growthRate > 0.0) {
            const targetMass = starData.evolutionTargetMass;
            if (starData.currentMass >= targetMass) {
                starData.currentMass = targetMass;
            } else {
                const delta = growthRate * starData.birthMass * dtStep * STAR_AGE_RATE;
                starData.currentMass = Math.min(targetMass, starData.currentMass + delta);
            }
        }
    }

    return maybe_trigger_supernova(starData, dtStep);
}

function update_all_star_lifecycles(starParticleData, coreSet) {
    const supernovaCandidates = [];
    if (!starParticleData || starParticleData.length === 0) return supernovaCandidates;

    const scaledDt = dt * time_scale;
    if (scaledDt <= 0) return supernovaCandidates;

    for (let i = 0; i < starParticleData.length; i++) {
        if (!starParticleData[i]) continue;
        if (coreSet && coreSet.has(i)) continue;

        const shouldExplode = evolve_star_mass_and_type(starParticleData[i], scaledDt);
        if (shouldExplode) supernovaCandidates.push(i);
    }

    return supernovaCandidates;
}

function resolve_supernova_remnant_type(remnantMass) {
    if (remnantMass >= STAR_BLACK_HOLE_MIN_REMNANT_MASS) {
        return STAR_TYPE_BLACK_HOLE;
    }

    if (remnantMass >= STAR_PULSAR_MIN_REMNANT_MASS && Math.random() < STAR_PULSAR_CHANCE) {
        return STAR_TYPE_PULSAR;
    }

    if (remnantMass >= STAR_NEUTRON_STAR_MIN_REMNANT_MASS) {
        return STAR_TYPE_NEUTRON_STAR;
    }

    if (remnantMass >= STAR_WHITE_DWARF_MIN_REMNANT_MASS) {
        return STAR_TYPE_WHITE_DWARF;
    }

    return null;
}

function apply_supernova_outcome_to_star(starData) {
    if (!starData || starData.hasSupernovaTriggered) {
        return {
            returnedGasMass: 0.0,
            remnantMass: 0.0,
            remnantType: null,
            createsRemnant: false
        };
    }

    const explodingMass = starData.currentMass;
    const returnedGasMass = explodingMass * STAR_SUPERNOVA_GAS_RETURN_FRACTION;
    const remnantMass = explodingMass * STAR_SUPERNOVA_REMNANT_FRACTION;
    const remnantType = resolve_supernova_remnant_type(remnantMass);

    starData.hasSupernovaTriggered = true;
    starData.canExplodeLater = false;
    starData.stageAge = 0.0;
    starData.currentMass = remnantMass;

    if (remnantType) {
        starData.starType = remnantType;
        starData.remnantClass = remnantType;
        starData.isRemnant = true;
        starData.isActive = true;
        starData.age = 0.0;
        starData.stageAge = 0.0;

        initialize_compact_object_defaults(starData);

        if (remnantType === STAR_TYPE_NEUTRON_STAR) {
            starData.isCompactObject = true;
        } else if (remnantType === STAR_TYPE_PULSAR) {
            initialize_pulsar_metadata(starData);
        } else if (remnantType === STAR_TYPE_BLACK_HOLE) {
            initialize_black_hole_metadata(starData);
        }
    } else {
        starData.isActive = false;
        starData.isRemnant = false;
        starData.remnantClass = null;
        initialize_compact_object_defaults(starData);
    }

    return {
        returnedGasMass,
        remnantMass,
        remnantType,
        createsRemnant: !!remnantType
    };
}

function accrete_mass_onto_black_hole(blackHoleIndex, gainedMass, gainedVelocity, velocities, starParticleData, sourceKind = 'gas') {
    const starData = starParticleData[blackHoleIndex];
    if (!isBlackHoleStar(starData)) return;

    const efficiency = sourceKind === 'star'
        ? BLACK_HOLE_STAR_ACCRETION_EFFICIENCY
        : BLACK_HOLE_GAS_ACCRETION_EFFICIENCY;

    const effectiveMass = gainedMass * efficiency;
    if (effectiveMass <= 0) return;

    const oldMass = Math.max(1e-9, starData.currentMass);
    const newMass = oldMass + effectiveMass;

    velocities[blackHoleIndex][0] = (velocities[blackHoleIndex][0] * oldMass + gainedVelocity[0] * effectiveMass) / newMass;
    velocities[blackHoleIndex][1] = (velocities[blackHoleIndex][1] * oldMass + gainedVelocity[1] * effectiveMass) / newMass;
    velocities[blackHoleIndex][2] = (velocities[blackHoleIndex][2] * oldMass + gainedVelocity[2] * effectiveMass) / newMass;

    starData.currentMass = newMass;

    if (sourceKind === 'star') {
        starData.accretedStellarMass += effectiveMass;
    } else {
        starData.accretedGasMass += effectiveMass;
    }
}

function accrete_particles_onto_black_holes(gasParticles, positions, velocities, starParticleData, coreSet) {
    const blackHoleSources = build_black_hole_sources(positions, starParticleData);
    if (blackHoleSources.length === 0) {
        return {
            gasParticles,
            promotedBlackHoleIndices: [],
            blackHoleSources
        };
    }

    const survivingGas = [];

    for (let i = 0; i < gasParticles.length; i++) {
        const gp = gasParticles[i];
        let chosen = null;
        let bestD2 = Infinity;

        for (let b = 0; b < blackHoleSources.length; b++) {
            const bh = blackHoleSources[b];
            const dx = gp.position[0] - bh.position[0];
            const dy = gp.position[1] - bh.position[1];
            const dz = gp.position[2] - bh.position[2];
            const d2 = dx * dx + dy * dy + dz * dz;
            const absorbR2 = bh.gasAbsorbRadius * bh.gasAbsorbRadius;

            if (d2 <= absorbR2 && d2 < bestD2) {
                bestD2 = d2;
                chosen = bh;
            }
        }

        if (chosen) {
            accrete_mass_onto_black_hole(chosen.index, gp.mass, gp.velocity, velocities, starParticleData, 'gas');
        } else {
            survivingGas.push(gp);
        }
    }

    for (let i = 0; i < starParticleData.length; i++) {
        const starData = starParticleData[i];
        if (!starData || !starData.isActive) continue;
        if (coreSet && coreSet.has(i)) continue;
        if (isBlackHoleStar(starData)) continue;

        let chosen = null;
        let bestD2 = Infinity;

        for (let b = 0; b < blackHoleSources.length; b++) {
            const bh = blackHoleSources[b];
            if (bh.index === i) continue;

            const dx = positions[i][0] - bh.position[0];
            const dy = positions[i][1] - bh.position[1];
            const dz = positions[i][2] - bh.position[2];
            const d2 = dx * dx + dy * dy + dz * dz;
            const absorbR2 = bh.starAbsorbRadius * bh.starAbsorbRadius;

            if (d2 <= absorbR2 && d2 < bestD2) {
                bestD2 = d2;
                chosen = bh;
            }
        }

        if (!chosen) continue;

        const absorbedMass = Math.max(0.0, starData.currentMass || starData.birthMass || 0.0);
        accrete_mass_onto_black_hole(chosen.index, absorbedMass, velocities[i], velocities, starParticleData, 'star');

        starData.isActive = false;
        starData.currentMass = 0.0;
        starData.absorbedByBlackHole = true;
        starData.absorbedByIndex = chosen.index;

        positions[i][0] = positions[chosen.index][0];
        positions[i][1] = positions[chosen.index][1];
        positions[i][2] = positions[chosen.index][2];

        velocities[i][0] = velocities[chosen.index][0];
        velocities[i][1] = velocities[chosen.index][1];
        velocities[i][2] = velocities[chosen.index][2];
    }

    const promotedBlackHoleIndices = [];
    for (let i = 0; i < starParticleData.length; i++) {
        const starData = starParticleData[i];
        if (!isBlackHoleStar(starData)) continue;
        if (starData.isPromotedCore) continue;

        if (starData.currentMass >= BLACK_HOLE_CORE_PROMOTION_MASS) {
            promotedBlackHoleIndices.push(i);
        }
    }

    return {
        gasParticles: survivingGas,
        promotedBlackHoleIndices,
        blackHoleSources: build_black_hole_sources(positions, starParticleData)
    };
}

function get_star_visual_profile(starData) {
    const fallback = {
        color: [255, 255, 255],
        glowAlpha: 0.10,
        baseRadius: PARTICLE_SIZE,
        massRadiusFactor: 0.18
    };

    if (!starData || !starData.isActive) return fallback;

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
        case STAR_TYPE_WHITE_DWARF:
            return {
                color: STAR_COLOR_WHITE_DWARF.slice(),
                glowAlpha: STAR_GLOW_ALPHA_WHITE_DWARF,
                baseRadius: STAR_BASE_RADIUS_WHITE_DWARF,
                massRadiusFactor: STAR_MASS_RADIUS_FACTOR_WHITE_DWARF
            };
        case STAR_TYPE_NEUTRON_STAR:
            return {
                color: STAR_COLOR_NEUTRON_STAR.slice(),
                glowAlpha: STAR_GLOW_ALPHA_NEUTRON_STAR,
                baseRadius: STAR_BASE_RADIUS_NEUTRON_STAR,
                massRadiusFactor: STAR_MASS_RADIUS_FACTOR_NEUTRON_STAR
            };
        case STAR_TYPE_PULSAR:
            return {
                color: STAR_COLOR_PULSAR.slice(),
                glowAlpha: STAR_GLOW_ALPHA_PULSAR,
                baseRadius: STAR_BASE_RADIUS_PULSAR,
                massRadiusFactor: STAR_MASS_RADIUS_FACTOR_PULSAR
            };
        case STAR_TYPE_BLACK_HOLE:
            return {
                color: STAR_COLOR_BLACK_HOLE.slice(),
                glowAlpha: STAR_GLOW_ALPHA_BLACK_HOLE,
                baseRadius: STAR_BASE_RADIUS_BLACK_HOLE,
                massRadiusFactor: STAR_MASS_RADIUS_FACTOR_BLACK_HOLE
            };
        default:
            return fallback;
    }
}

function compute_star_screen_radius(starData) {
    if (!starData || !starData.isActive) return 0.0;

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

        pos.forEach(p => {
            p[0] += core_pos_init[c][0];
            p[1] += core_pos_init[c][1];
            p[2] += core_pos_init[c][2];
        });

        pos[0] = core_pos_init[c].slice();

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