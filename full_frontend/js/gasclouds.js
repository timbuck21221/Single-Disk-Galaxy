// gasclouds.js – clustered gas particle system with local gas-only interactions

function make_gas_particle(
    position,
    velocity,
    mass,
    color = [120, 190, 255],
    opacity = 0.18,
    sourceId = 0,
    heat = 0.0,
    heatLifetime = 0.0,
    hotColor = null
) {
    return {
        position: position.slice(),
        velocity: velocity.slice(),
        mass,
        color: color.slice(),
        opacity,
        sourceId,
        heat,
        heatAge: 0.0,
        heatLifetime,
        hotColor: hotColor ? hotColor.slice() : null
    };
}

function findNearestCoreIndex(point, corePositions) {
    let bestIndex = 0;
    let bestD2 = Infinity;

    for (let i = 0; i < corePositions.length; i++) {
        const dx = point[0] - corePositions[i][0];
        const dy = point[1] - corePositions[i][1];
        const dz = point[2] - corePositions[i][2];
        const d2 = dx * dx + dy * dy + dz * dz;

        if (d2 < bestD2) {
            bestD2 = d2;
            bestIndex = i;
        }
    }

    return bestIndex;
}

function randIntInclusive(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandomColor(palette) {
    return palette[Math.floor(Math.random() * palette.length)].slice();
}

function mixRgb(colorA, colorB, t) {
    const tt = Math.max(0, Math.min(1, t));
    return [
        Math.round(colorA[0] + (colorB[0] - colorA[0]) * tt),
        Math.round(colorA[1] + (colorB[1] - colorA[1]) * tt),
        Math.round(colorA[2] + (colorB[2] - colorA[2]) * tt)
    ];
}

function getGasParticleHeatFactor(gp) {
    if (!gp || !gp.heat || !gp.heatLifetime || gp.heatLifetime <= 0) return 0.0;
    return Math.max(0, 1.0 - gp.heatAge / gp.heatLifetime) * gp.heat;
}

function update_supernova_ejecta_heat(gasParticles, dtStep) {
    if (!gasParticles || gasParticles.length === 0) return;

    for (let i = 0; i < gasParticles.length; i++) {
        const gp = gasParticles[i];
        if (!gp || !gp.heat || gp.heat <= 0 || !gp.heatLifetime || gp.heatLifetime <= 0) continue;

        gp.heatAge += dtStep;
        if (gp.heatAge >= gp.heatLifetime) {
            gp.heat = 0.0;
            gp.heatAge = gp.heatLifetime;
        }
    }
}

function makeProceduralGasCloudSeed(coreIndex, corePositions, coreVelocities, sourceId) {
    const corePos = corePositions[coreIndex];
    const coreVel = coreVelocities[coreIndex];

    const orbitRadius = randRange(
        disk_radius * GAS_CLOUD_ORBIT_RADIUS_MIN_FACTOR,
        disk_radius * GAS_CLOUD_ORBIT_RADIUS_MAX_FACTOR
    );

    const theta = Math.random() * 2 * Math.PI;
    const zOffset = gaussian(0, GAS_CLOUD_CENTER_Z_STD);

    const center = [
        corePos[0] + orbitRadius * Math.cos(theta),
        corePos[1] + orbitRadius * Math.sin(theta),
        corePos[2] + zOffset
    ];

    const vCirc = circular_velocity(
        center[0] - corePos[0],
        center[1] - corePos[1]
    );

    const orbitalVelocity = [
        -vCirc * Math.sin(theta) + coreVel[0],
         vCirc * Math.cos(theta) + coreVel[1],
         coreVel[2]
    ];

    const bulkVelocity = [
        orbitalVelocity[0] + gaussian(0, GAS_CLOUD_BULK_DRIFT_STD_XY),
        orbitalVelocity[1] + gaussian(0, GAS_CLOUD_BULK_DRIFT_STD_XY),
        orbitalVelocity[2] + gaussian(0, GAS_CLOUD_BULK_DRIFT_STD_Z)
    ];

    return {
        position: center,
        velocity: bulkVelocity,
        mass: randRange(GAS_CLOUD_MASS_MIN, GAS_CLOUD_MASS_MAX),
        radius: randRange(GAS_CLOUD_SPAWN_RADIUS_MIN, GAS_CLOUD_SPAWN_RADIUS_MAX),
        opacity: randRange(GAS_CLOUD_OPACITY_MIN, GAS_CLOUD_OPACITY_MAX),
        color: pickRandomColor(GAS_CLOUD_COLOR_PALETTE),
        sourceId,
        coreIndex
    };
}

function spawn_initial_gas_particles(corePositions, coreVelocities) {
    if (!GAS_PARTICLES_ENABLED) return [];

    const gasParticles = [];
    let sourceId = 0;

    for (let c = 0; c < corePositions.length; c++) {
        const cloudCount = randIntInclusive(
            GAS_INITIAL_CLOUDS_PER_GALAXY_MIN,
            GAS_INITIAL_CLOUDS_PER_GALAXY_MAX
        );

        for (let cloudIdx = 0; cloudIdx < cloudCount; cloudIdx++) {
            const seed = makeProceduralGasCloudSeed(c, corePositions, coreVelocities, sourceId);
            const count = randIntInclusive(
                GAS_PARTICLES_PER_CLOUD_MIN,
                GAS_PARTICLES_PER_CLOUD_MAX
            );
            const perParticleMass = seed.mass / count;

            for (let i = 0; i < count; i++) {
                const a = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                const rr = seed.radius * Math.cbrt(Math.random());

                const sx = rr * Math.sin(phi) * Math.cos(a);
                const sy = rr * Math.sin(phi) * Math.sin(a);
                const sz = rr * Math.cos(phi) * 0.3;

                const pos = [
                    seed.position[0] + sx,
                    seed.position[1] + sy,
                    seed.position[2] + sz
                ];

                const vel = [
                    seed.velocity[0] + gaussian(0, GAS_CLOUD_INTERNAL_VEL_STD_XY),
                    seed.velocity[1] + gaussian(0, GAS_CLOUD_INTERNAL_VEL_STD_XY),
                    seed.velocity[2] + gaussian(0, GAS_CLOUD_INTERNAL_VEL_STD_Z)
                ];

                gasParticles.push(
                    make_gas_particle(
                        pos,
                        vel,
                        perParticleMass,
                        seed.color,
                        seed.opacity,
                        seed.sourceId
                    )
                );
            }

            sourceId++;
        }
    }

    return gasParticles;
}

function spawn_supernova_gas_particles(position, velocity, totalGasMass, sourceId) {
    if (totalGasMass <= 0) return [];

    const count = randIntInclusive(
        SUPERNOVA_EJECTA_PARTICLE_COUNT_MIN,
        SUPERNOVA_EJECTA_PARTICLE_COUNT_MAX
    );
    const perParticleMass = totalGasMass / count;
    const opacity = randRange(SUPERNOVA_EJECTA_OPACITY_MIN, SUPERNOVA_EJECTA_OPACITY_MAX);

    const ejecta = [];

    for (let i = 0; i < count; i++) {
        const a = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        const rr = randRange(SUPERNOVA_EJECTA_SPAWN_RADIUS_MIN, SUPERNOVA_EJECTA_SPAWN_RADIUS_MAX);

        const nx = Math.sin(phi) * Math.cos(a);
        const ny = Math.sin(phi) * Math.sin(a);
        const nz = Math.cos(phi);

        const pos = [
            position[0] + rr * nx,
            position[1] + rr * ny,
            position[2] + rr * nz * 0.8
        ];

        const ejectSpeed = randRange(SUPERNOVA_EJECTA_SPEED_MIN, SUPERNOVA_EJECTA_SPEED_MAX);
        const vel = [
            velocity[0] + nx * ejectSpeed + gaussian(0, 0.15),
            velocity[1] + ny * ejectSpeed + gaussian(0, 0.15),
            velocity[2] + nz * ejectSpeed + gaussian(0, 0.08)
        ];

        const baseColor = pickRandomColor(SUPERNOVA_EJECTA_COLOR_PALETTE);

        ejecta.push(
            make_gas_particle(
                pos,
                vel,
                perParticleMass,
                baseColor,
                opacity,
                sourceId,
                1.0,
                randRange(SUPERNOVA_EJECTA_HEAT_LIFETIME_MIN, SUPERNOVA_EJECTA_HEAT_LIFETIME_MAX),
                SUPERNOVA_EJECTA_HOT_COLOR
            )
        );
    }

    return ejecta;
}

function compute_gas_particle_accelerations(
    gasParticles,
    core_pos,
    m_bulge,
    a_bulge,
    m_disk,
    a_disk,
    b_disk,
    v_halo,
    r_core,
    blackHoleSources = []
) {
    const acc = new Array(gasParticles.length).fill(0).map(() => [0, 0, 0]);

    for (let i = 0; i < gasParticles.length; i++) {
        const gp = gasParticles[i];
        let ax = 0.0, ay = 0.0, az = 0.0;

        for (let c = 0; c < core_pos.length; c++) {
            const dx = gp.position[0] - core_pos[c][0];
            const dy = gp.position[1] - core_pos[c][1];
            const dz = gp.position[2] - core_pos[c][2];

            const [axt, ayt, azt] = _accel_one_core(
                dx, dy, dz,
                m_bulge[c], a_bulge[c], m_disk[c], a_disk[c], b_disk[c],
                v_halo[c], r_core[c]
            );

            ax += axt;
            ay += ayt;
            az += azt;
        }

        for (let b = 0; b < blackHoleSources.length; b++) {
            const bh = blackHoleSources[b];
            const dx = gp.position[0] - bh.position[0];
            const dy = gp.position[1] - bh.position[1];
            const dz = gp.position[2] - bh.position[2];
            const d2 = dx * dx + dy * dy + dz * dz;
            const dist = Math.sqrt(d2) + 1e-12;

            if (dist > bh.influenceRadius) continue;

            const softened = d2 + BLACK_HOLE_SOFTENING * BLACK_HOLE_SOFTENING;
            const invR3 = 1.0 / (softened * Math.sqrt(softened) + 1e-12);
            const strength = G * bh.mass * BLACK_HOLE_LOCAL_GRAVITY_STRENGTH;

            ax -= strength * dx * invR3;
            ay -= strength * dy * invR3;
            az -= strength * dz * invR3;
        }

        ax += -GAS_GLOBAL_DAMPING * gp.velocity[0];
        ay += -GAS_GLOBAL_DAMPING * gp.velocity[1];
        az += -GAS_GLOBAL_DAMPING * gp.velocity[2];

        acc[i][0] = ax;
        acc[i][1] = ay;
        acc[i][2] = az;
    }

    for (let i = 0; i < gasParticles.length; i++) {
        for (let j = i + 1; j < gasParticles.length; j++) {
            const a = gasParticles[i];
            const b = gasParticles[j];

            const dx = a.position[0] - b.position[0];
            const dy = a.position[1] - b.position[1];
            const dz = a.position[2] - b.position[2];
            const d2 = dx * dx + dy * dy + dz * dz;
            const dist = Math.sqrt(d2) + 1e-12;

            if (dist > GAS_NEIGHBOR_RADIUS) continue;

            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;

            let forceMag = 0.0;

            if (dist < GAS_REPULSION_RADIUS) {
                const q = 1.0 - dist / GAS_REPULSION_RADIUS;
                forceMag += GAS_REPULSION_STRENGTH * q;
            } else {
                const q = 1.0 - (dist - GAS_REPULSION_RADIUS) / Math.max(GAS_NEIGHBOR_RADIUS - GAS_REPULSION_RADIUS, 1e-12);
                forceMag -= GAS_ATTRACTION_STRENGTH * q;
            }

            acc[i][0] += forceMag * nx;
            acc[i][1] += forceMag * ny;
            acc[i][2] += forceMag * nz;

            acc[j][0] -= forceMag * nx;
            acc[j][1] -= forceMag * ny;
            acc[j][2] -= forceMag * nz;

            const dvx = a.velocity[0] - b.velocity[0];
            const dvy = a.velocity[1] - b.velocity[1];
            const dvz = a.velocity[2] - b.velocity[2];
            const align = GAS_ALIGNMENT_DAMPING * (1.0 - dist / GAS_NEIGHBOR_RADIUS);

            acc[i][0] += -align * dvx;
            acc[i][1] += -align * dvy;
            acc[i][2] += -align * dvz;

            acc[j][0] +=  align * dvx;
            acc[j][1] +=  align * dvy;
            acc[j][2] +=  align * dvz;
        }
    }

    return acc;
}

function step_gas_particles(gasParticles, gasAcc, dtStep) {
    for (let i = 0; i < gasParticles.length; i++) {
        const gp = gasParticles[i];

        gp.position[0] += gp.velocity[0] * dtStep + 0.5 * gasAcc[i][0] * dtStep * dtStep;
        gp.position[1] += gp.velocity[1] * dtStep + 0.5 * gasAcc[i][1] * dtStep * dtStep;
        gp.position[2] += gp.velocity[2] * dtStep + 0.5 * gasAcc[i][2] * dtStep * dtStep;
    }
}

function finish_gas_particle_velocity_update(gasParticles, oldAcc, newAcc, dtStep) {
    for (let i = 0; i < gasParticles.length; i++) {
        gasParticles[i].velocity[0] += 0.5 * (oldAcc[i][0] + newAcc[i][0]) * dtStep;
        gasParticles[i].velocity[1] += 0.5 * (oldAcc[i][1] + newAcc[i][1]) * dtStep;
        gasParticles[i].velocity[2] += 0.5 * (oldAcc[i][2] + newAcc[i][2]) * dtStep;
    }
}

function estimate_gas_neighbor_counts(gasParticles, radius) {
    const counts = new Array(gasParticles.length).fill(0);
    const r2 = radius * radius;

    for (let i = 0; i < gasParticles.length; i++) {
        for (let j = 0; j < gasParticles.length; j++) {
            if (i === j) continue;

            const dx = gasParticles[i].position[0] - gasParticles[j].position[0];
            const dy = gasParticles[i].position[1] - gasParticles[j].position[1];
            const dz = gasParticles[i].position[2] - gasParticles[j].position[2];
            const d2 = dx * dx + dy * dy + dz * dz;

            if (d2 <= r2) counts[i]++;
        }
    }

    return counts;
}

function form_stars_from_gas(gasParticles, positions, velocities, forceArray, starParticleData, corePositions) {
    if (!gasParticles || gasParticles.length < GAS_CONSUME_COUNT) {
        return { gasParticles, formedStars: [] };
    }

    const neighborCounts = estimate_gas_neighbor_counts(gasParticles, GAS_FORMATION_RADIUS);
    const consumed = new Array(gasParticles.length).fill(false);
    const formedStars = [];
    let starsFormed = 0;

    const candidates = neighborCounts
        .map((count, index) => ({ count, index }))
        .sort((a, b) => b.count - a.count);

    for (let c = 0; c < candidates.length; c++) {
        if (starsFormed >= GAS_MAX_STARS_PER_SUBSTEP) break;

        const idx = candidates[c].index;
        if (consumed[idx]) continue;
        if (neighborCounts[idx] < GAS_FORMATION_THRESHOLD) continue;

        const center = gasParticles[idx].position;
        const nearby = [];

        for (let j = 0; j < gasParticles.length; j++) {
            if (consumed[j]) continue;

            const dx = gasParticles[j].position[0] - center[0];
            const dy = gasParticles[j].position[1] - center[1];
            const dz = gasParticles[j].position[2] - center[2];
            const d2 = dx * dx + dy * dy + dz * dz;

            if (d2 <= GAS_FORMATION_RADIUS * GAS_FORMATION_RADIUS) {
                nearby.push({ index: j, d2 });
            }
        }

        if (nearby.length < GAS_CONSUME_COUNT) continue;

        nearby.sort((a, b) => a.d2 - b.d2);
        const selected = nearby.slice(0, GAS_CONSUME_COUNT);

        let totalMass = 0.0;
        let px = 0.0, py = 0.0, pz = 0.0;
        let vx = 0.0, vy = 0.0, vz = 0.0;
        let metallicityAccum = 0.0;

        for (let k = 0; k < selected.length; k++) {
            const gp = gasParticles[selected[k].index];
            totalMass += gp.mass;
            px += gp.position[0] * gp.mass;
            py += gp.position[1] * gp.mass;
            pz += gp.position[2] * gp.mass;
            vx += gp.velocity[0] * gp.mass;
            vy += gp.velocity[1] * gp.mass;
            vz += gp.velocity[2] * gp.mass;
            metallicityAccum += sample_star_metallicity() * gp.mass;
        }

        const newStarPos = [px / totalMass, py / totalMass, pz / totalMass];
        const newStarVel = [vx / totalMass, vy / totalMass, vz / totalMass];
        const nearestCoreIndex = findNearestCoreIndex(newStarPos, corePositions);
        const metallicity = metallicityAccum / totalMass;

        positions.push(newStarPos);
        velocities.push(newStarVel);
        forceArray.push([0, 0, 0]);
        starParticleData.push(
            create_star_particle_data(totalMass, 'gas_formed', metallicity, nearestCoreIndex)
        );

        formedStars.push({
            position: newStarPos.slice(),
            velocity: newStarVel.slice(),
            mass: totalMass
        });

        for (let k = 0; k < selected.length; k++) {
            consumed[selected[k].index] = true;
        }

        starsFormed++;
    }

    const survivors = [];
    for (let i = 0; i < gasParticles.length; i++) {
        if (!consumed[i]) survivors.push(gasParticles[i]);
    }

    return { gasParticles: survivors, formedStars };
}

function buildGasParticleRenderData(gasParticles, canvas, camera) {
    if (!gasParticles || gasParticles.length === 0) return [];

    const centers = gasParticles.map(p => p.position);
    const { projected, mask } = project(centers, canvas, camera);
    const densityCounts = estimate_gas_neighbor_counts(gasParticles, GAS_DENSITY_RENDER_RADIUS);

    const renderData = [];

    for (let i = 0; i < gasParticles.length; i++) {
        if (!mask[i]) continue;

        const gp = gasParticles[i];
        const density = densityCounts[i];
        const heatFactor = getGasParticleHeatFactor(gp);

        const baseSize = GAS_PARTICLE_BASE_SIZE + density * GAS_PARTICLE_DENSITY_SIZE_BOOST;
        const size = baseSize + heatFactor * SUPERNOVA_EJECTA_HEAT_SIZE_BOOST;

        const baseAlpha = Math.min(0.9, gp.opacity + density * GAS_PARTICLE_DENSITY_ALPHA_BOOST);
        const alpha = Math.min(0.98, baseAlpha + heatFactor * SUPERNOVA_EJECTA_HEAT_ALPHA_BOOST);

        const color = heatFactor > 0 && gp.hotColor
            ? mixRgb(gp.color, gp.hotColor, Math.min(1.0, heatFactor))
            : gp.color.slice();

        renderData.push({
            screenX: projected[i][0],
            screenY: projected[i][1],
            size,
            alpha,
            color,
            density,
            hotness: heatFactor
        });
    }

    return renderData;
}