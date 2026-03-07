# particles.py
import numpy as np
from physics import G, circular_velocity

def initialize_particles(N, disk_radius, central_mass, velocity_noise, scale_height=0.2):
    """
    Initialize a galaxy with:
    - Exponential thin disk
    - Small vertical thickness
    - Circular velocities computed from the full potential
    """
    np.random.seed(2)

    # --- Disk positions ---
    R_d = disk_radius / 3.0  # scale radius
    r = np.random.exponential(scale=R_d, size=N)
    r = np.clip(r, 0.5, disk_radius)
    theta = np.random.uniform(0, 2*np.pi, N)
    z = np.random.normal(0, scale_height, N)

    x = r * np.cos(theta)
    y = r * np.sin(theta)
    positions = np.column_stack((x, y, z))

    # --- Masses ---
    masses = np.ones(N + 1)
    masses[0] = central_mass

    # --- Circular velocities from full galaxy potential ---
    vx = np.zeros(N)
    vy = np.zeros(N)
    vz = np.random.normal(0, velocity_noise*0.1, N)

    for i in range(N):
        v_circ = circular_velocity(x[i], y[i])
        vx[i] = -v_circ * np.sin(theta[i]) + np.random.normal(0, velocity_noise)
        vy[i] =  v_circ * np.cos(theta[i]) + np.random.normal(0, velocity_noise)

    velocities = np.column_stack((vx, vy, vz))

    # --- Add central core ---
    positions = np.vstack(([0.0, 0.0, 0.0], positions))
    velocities = np.vstack(([0.0, 0.0, 0.0], velocities))

    return positions, velocities, masses