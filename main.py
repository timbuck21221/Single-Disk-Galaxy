import pygame
import numpy as np
import math

from physics import compute_forces_multi, make_core_params, add_core_core_forces
from particles import initialize_particles
from camera import project, handle_mouse

# ----------------------------
# Simulation parameters
# ----------------------------
DT = 0.02
PHYSICS_STEPS_PER_FRAME = 2   # <- more stable near close approach
SCREEN_SIZE = 1000
FPS = 60
PARTICLE_SIZE = 1
CORE_SIZE = 4

# Multi-core setup
CORE_POS_INIT = np.array([
    [0.0, 0.0, 0.0],
    [18.0, 0.0, 0.0],
], dtype=np.float64)

# Strength of core-core attraction (tune this!)
CORE_MASSES = np.array([3500.0, 3500.0], dtype=np.float64)

# Disk particles per core (total particles = C*(N_PER_CORE+1))
N_PER_CORE = 5000

# Galaxy disk init params (reused for each core)
DISK_RADIUS = 8.0
CENTRAL_MASS = 1500.0     # used only in your initializer masses; not used by physics
VELOCITY_NOISE = 0.01

# ----------------------------
# Auto circular-orbit initial velocities for 2 cores
# ----------------------------
# If you want an elliptical orbit / merge, scale these down (e.g. *0.9)
dvec = CORE_POS_INIT[1] - CORE_POS_INIT[0]
d = np.linalg.norm(dvec)
u = dvec / (d + 1e-12)

# perpendicular direction in xy plane
perp = np.array([-u[1], u[0], 0.0], dtype=np.float64)

M1, M2 = CORE_MASSES[0], CORE_MASSES[1]
omega = math.sqrt(1.0 * (M1 + M2) / (d**3 + 1e-12))

r1 = d * (M2 / (M1 + M2))
r2 = d * (M1 / (M1 + M2))

v1 = omega * r1
v2 = omega * r2

CORE_VEL_INIT = np.array([
    +perp * v1,
    -perp * v2,
], dtype=np.float64)

# Optional: make it slightly more likely to merge than orbit forever
CORE_VEL_INIT *= 1


# ----------------------------
# Initialize pygame
# ----------------------------
pygame.init()
screen = pygame.display.set_mode((SCREEN_SIZE, SCREEN_SIZE))
pygame.display.set_caption("3D Multi-Core Galaxy Simulation")
clock = pygame.time.Clock()

camera_rot = [0.0, 0.0]
mouse_down = False
last_mouse_pos = None
zoom = 0.5


# ----------------------------
# Colormap
# ----------------------------
def smooth_colormap(t):
    stops = [
        (0.0, (20, 20, 120)),
        (0.25, (0, 180, 255)),
        (0.5, (255, 255, 255)),
        (0.75, (255, 200, 50)),
        (1.0, (255, 60, 60)),
    ]
    for i in range(len(stops) - 1):
        t0, c0 = stops[i]
        t1, c1 = stops[i + 1]
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0)
            return (
                int(c0[0] + u * (c1[0] - c0[0])),
                int(c0[1] + u * (c1[1] - c0[1])),
                int(c0[2] + u * (c1[2] - c0[2])),
            )
    return stops[-1][1]


LOG_MAX_RADIUS = math.log(DISK_RADIUS + 1e-6)

# ----------------------------
# Build multiple galaxies without touching particles.py
# ----------------------------
def build_multi_galaxy(core_pos_init, core_vel_init, n_per_core):
    """
    Uses your existing initialize_particles() to create one galaxy (core + disk),
    then clones and offsets it for each core.

    Returns:
      positions (N,3), velocities (N,3), core_indices (C,), block_size
    """
    C = core_pos_init.shape[0]

    # Create a template galaxy centered at origin
    template_pos, template_vel, _ = initialize_particles(
        N=n_per_core,
        disk_radius=DISK_RADIUS,
        central_mass=CENTRAL_MASS,
        velocity_noise=VELOCITY_NOISE,
    )
    block_size = template_pos.shape[0]  # n_per_core + 1

    positions_blocks = []
    velocities_blocks = []
    core_indices = np.zeros(C, dtype=np.int64)

    for c in range(C):
        pos = template_pos.copy()
        vel = template_vel.copy()

        # offset whole galaxy to core position
        pos += core_pos_init[c]

        # override the core position exactly
        pos[0] = core_pos_init[c]

        # add a bulk drift velocity to everything (including disk)
        vel += core_vel_init[c]

        # ensure core has exactly the core velocity
        vel[0] = core_vel_init[c]

        core_indices[c] = c * block_size
        positions_blocks.append(pos)
        velocities_blocks.append(vel)

    positions = np.vstack(positions_blocks)
    velocities = np.vstack(velocities_blocks)
    return positions, velocities, core_indices, block_size


positions, velocities, core_indices, BLOCK_SIZE = build_multi_galaxy(
    CORE_POS_INIT, CORE_VEL_INIT, N_PER_CORE
)

# Track cores from particle array
CORES = positions[core_indices].copy()
C = CORES.shape[0]

# Per-core analytic potential parameters
params = make_core_params(C)
M_bulge, A_bulge, M_disk, A_disk, B_disk, V_halo, R_core = params

# Initial forces:
# - analytic multi-core field for all particles
# - but we REMOVE analytic forces on cores (prevents double-counting)
# - then add Newtonian core-core forces on cores
forces = compute_forces_multi(
    positions, CORES,
    M_bulge, A_bulge,
    M_disk,  A_disk, B_disk,
    V_halo,  R_core
)
forces[core_indices] = 0.0
add_core_core_forces(forces, CORES, CORE_MASSES, core_indices)


# ----------------------------
# Main loop
# ----------------------------
running = True
core_set = set(core_indices.tolist())

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        camera_rot, mouse_down, last_mouse_pos, zoom = handle_mouse(
            camera_rot, mouse_down, last_mouse_pos, zoom, event
        )

    # --- Physics ---
    for _ in range(PHYSICS_STEPS_PER_FRAME):
        positions += velocities * DT + 0.5 * forces * DT**2

        # update core positions from the particle array
        CORES = positions[core_indices].copy()

        new_forces = compute_forces_multi(
            positions, CORES,
            M_bulge, A_bulge,
            M_disk,  A_disk, B_disk,
            V_halo,  R_core
        )

        # Prevent double-counting on cores: cores are governed ONLY by core-core gravity
        new_forces[core_indices] = 0.0
        add_core_core_forces(new_forces, CORES, CORE_MASSES, core_indices)

        velocities += 0.5 * (forces + new_forces) * DT
        forces = new_forces

    # --- Camera ---
    camera_center = CORES.mean(axis=0)
    projected, mask, z2 = project(
        positions, camera_center, camera_rot, SCREEN_SIZE, zoom=zoom
    )

    # --- Color by nearest-core radius in disk plane ---
    diffs = positions[:, None, :] - CORES[None, :, :]
    d2_xy = np.sum(diffs[:, :, :2] ** 2, axis=2)   # (N,C)
    nearest_r = np.sqrt(np.min(d2_xy, axis=1)) + 1e-6

    # --- Render ---
    screen.fill((0, 0, 0))
    visible_indices = np.where(mask)[0]

    for idx in visible_indices:
        if idx in core_set:
            continue

        p = projected[idx]
        r = nearest_r[idx]
        t = math.log(r) / LOG_MAX_RADIUS
        t = max(0.0, min(1.0, t))
        color = smooth_colormap(t)

        pygame.draw.circle(
            screen,
            color,
            (int(p[0]), int(p[1])),
            PARTICLE_SIZE,
        )

    # Draw all cores
    for c_i in core_indices:
        if mask[c_i]:
            pygame.draw.circle(
                screen,
                (255, 255, 0),
                (int(projected[c_i, 0]), int(projected[c_i, 1])),
                CORE_SIZE,
            )

    pygame.display.flip()
    clock.tick(FPS)

pygame.quit()
