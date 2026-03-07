import numpy as np
from numba import njit

G = 1.0

# Softening for the analytic potential to avoid singularities / jitter
SOFTENING = 0.15

# ----------------------------
# Galaxy potential parameters
# ----------------------------

# Bulge (Plummer)
M_BULGE = 800.0
A_BULGE = 0.5

# Disk (Miyamoto–Nagai)
M_DISK = 1200.0
A_DISK = 4.0
B_DISK = 0.4

# Halo (Isothermal)
V_HALO = 12.0
R_CORE = 6.0

# Soft outer truncation (system-level envelope)
R_MAX = 120.0
K_TETHER = 0.002

# Core-core gravity softening (separate from SOFTENING)
CORE_SOFTENING = .6


# ----------------------------
# Internal helpers
# ----------------------------

@njit
def _accel_one_core(dx, dy, dz,
                    M_bulge, A_bulge,
                    M_disk, A_disk, B_disk,
                    V_halo, R_core):
    """
    Acceleration from one analytic galaxy potential centered at the origin,
    evaluated at relative coordinates (dx,dy,dz).
    """
    x = dx
    y = dy
    z = dz

    r2 = x*x + y*y + z*z + SOFTENING*SOFTENING
    r = np.sqrt(r2) + 1e-12

    # ---------- BULGE ----------
    denom_b = (r2 + A_bulge*A_bulge) ** 1.5
    ax_b = -G * M_bulge * x / denom_b
    ay_b = -G * M_bulge * y / denom_b
    az_b = -G * M_bulge * z / denom_b

    # ---------- DISK ----------
    R = np.sqrt(x*x + y*y) + 1e-12
    B = A_disk + np.sqrt(z*z + B_disk*B_disk)
    denom_d = (R*R + B*B) ** 1.5

    ax_d = -G * M_disk * x / denom_d
    ay_d = -G * M_disk * y / denom_d

    sqrt_term = np.sqrt(z*z + B_disk*B_disk) + 1e-12
    az_d = -G * M_disk * B * z / (sqrt_term * denom_d)

    # ---------- HALO ----------
    denom_h = r2 + R_core*R_core
    ax_h = -2.0 * V_halo*V_halo * x / denom_h
    ay_h = -2.0 * V_halo*V_halo * y / denom_h
    az_h = -2.0 * V_halo*V_halo * z / denom_h

    return ax_b + ax_d + ax_h, ay_b + ay_d + ay_h, az_b + az_d + az_h


# ----------------------------
# Backward-compatible single-core API
# ----------------------------

@njit
def compute_forces(pos):
    """
    Original behavior: analytic potential centered at (0,0,0).
    Kept for compatibility.
    """
    N = pos.shape[0]
    forces = np.zeros_like(pos)

    for i in range(N):
        x, y, z = pos[i]
        ax, ay, az = _accel_one_core(
            x, y, z,
            M_BULGE, A_BULGE,
            M_DISK, A_DISK, B_DISK,
            V_HALO, R_CORE
        )

        # System-level tether relative to origin (legacy)
        r = np.sqrt(x*x + y*y + z*z) + 1e-12
        if r > R_MAX:
            factor = -K_TETHER * (r - R_MAX)
            ax += factor * x / r
            ay += factor * y / r
            az += factor * z / r

        forces[i, 0] = ax
        forces[i, 1] = ay
        forces[i, 2] = az

    return forces


@njit
def acceleration_at_point(x, y, z):
    ax, ay, az = _accel_one_core(
        x, y, z,
        M_BULGE, A_BULGE,
        M_DISK, A_DISK, B_DISK,
        V_HALO, R_CORE
    )
    return ax, ay, az


@njit
def circular_velocity(x, y):
    """
    Original behavior: circular velocity in disk plane about origin.
    """
    R = np.sqrt(x*x + y*y) + 1e-12
    ax, ay, _ = acceleration_at_point(x, y, 0.0)
    a_R = (ax * x + ay * y) / R
    return np.sqrt(R * abs(a_R))


# ----------------------------
# Multi-core API
# ----------------------------

def make_core_params(C,
                     M_bulge=M_BULGE, A_bulge=A_BULGE,
                     M_disk=M_DISK,   A_disk=A_DISK, B_disk=B_DISK,
                     V_halo=V_HALO,   R_core=R_CORE):
    """
    Convenience helper: returns parameter arrays of length C.
    """
    return (
        np.full(C, M_bulge, dtype=np.float64),
        np.full(C, A_bulge, dtype=np.float64),
        np.full(C, M_disk,  dtype=np.float64),
        np.full(C, A_disk,  dtype=np.float64),
        np.full(C, B_disk,  dtype=np.float64),
        np.full(C, V_halo,  dtype=np.float64),
        np.full(C, R_core,  dtype=np.float64),
    )


@njit
def compute_forces_multi(pos, core_pos,
                         M_bulge, A_bulge,
                         M_disk,  A_disk,  B_disk,
                         V_halo,  R_core):
    """
    Sum analytic accelerations from multiple cores.

    pos:      (N,3)
    core_pos: (C,3)
    params: arrays (C,)
    """
    N = pos.shape[0]
    C = core_pos.shape[0]
    forces = np.zeros_like(pos)

    # barycenter for the outer tether (massless average = stable enough)
    bx = 0.0
    by = 0.0
    bz = 0.0
    for c in range(C):
        bx += core_pos[c, 0]
        by += core_pos[c, 1]
        bz += core_pos[c, 2]
    bx /= C
    by /= C
    bz /= C

    for i in range(N):
        x, y, z = pos[i]
        ax = 0.0
        ay = 0.0
        az = 0.0

        for c in range(C):
            dx = x - core_pos[c, 0]
            dy = y - core_pos[c, 1]
            dz = z - core_pos[c, 2]

            axt, ayt, azt = _accel_one_core(
                dx, dy, dz,
                M_bulge[c], A_bulge[c],
                M_disk[c],  A_disk[c],  B_disk[c],
                V_halo[c],  R_core[c]
            )
            ax += axt
            ay += ayt
            az += azt

        # System-level outer tether relative to barycenter
        tx = x - bx
        ty = y - by
        tz = z - bz
        rr = np.sqrt(tx*tx + ty*ty + tz*tz) + 1e-12
        if rr > R_MAX:
            factor = -K_TETHER * (rr - R_MAX)
            ax += factor * tx / rr
            ay += factor * ty / rr
            az += factor * tz / rr

        forces[i, 0] = ax
        forces[i, 1] = ay
        forces[i, 2] = az

    return forces


@njit
def add_core_core_forces(forces, core_pos, core_masses, core_indices):
    """
    Adds Newtonian attraction between cores only (in-place).
    forces: (N,3)
    core_pos: (C,3)
    core_masses: (C,)
    core_indices: (C,) indices into forces/positions of core particles
    """
    C = core_pos.shape[0]

    for a in range(C):
        ia = core_indices[a]
        xa = core_pos[a, 0]
        ya = core_pos[a, 1]
        za = core_pos[a, 2]

        ax = 0.0
        ay = 0.0
        az = 0.0

        for b in range(C):
            if b == a:
                continue

            dx = xa - core_pos[b, 0]
            dy = ya - core_pos[b, 1]
            dz = za - core_pos[b, 2]

            r2 = dx*dx + dy*dy + dz*dz + CORE_SOFTENING*CORE_SOFTENING
            inv_r3 = 1.0 / (r2 * np.sqrt(r2) + 1e-12)

            ax += -G * core_masses[b] * dx * inv_r3
            ay += -G * core_masses[b] * dy * inv_r3
            az += -G * core_masses[b] * dz * inv_r3

        forces[ia, 0] += ax
        forces[ia, 1] += ay
        forces[ia, 2] += az