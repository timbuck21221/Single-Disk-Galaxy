// Physical & visual constants
const PARTICLE_SIZE = 1.5;
const CORE_SIZE = 6;
const G = 1.0;
const SOFTENING = 0.15;
const CORE_SOFTENING = 0.6;
const M_BULGE = 800.0;
const A_BULGE = 0.5;
const M_DISK = 1200.0;
const A_DISK = 4.0;
const B_DISK = 0.4;
const V_HALO = 12.0;
const R_CORE = 6.0;
const CENTRAL_MASS = 1500.0;
const CORE_POS_INIT = [[0.0, 0.0, 0.0], [18.0, 0.0, 0.0]];

// Default simulation parameters
let dt = 0.02;
let physics_steps_per_frame = 2;
let disk_radius = 8.0;
let velocity_noise = 0.01;
let r_max = 120.0;
let k_tether = 0.002;
let enable_trails = true;
let trail_fade = 0.05;

// Per-core editable initialization parameters
let CORE_PARTICLE_COUNTS = new Array(CORE_POS_INIT.length).fill(500);
let CORE_VEL_SCALES = new Array(CORE_POS_INIT.length).fill(1.0);
let CORE_MASSES = new Array(CORE_POS_INIT.length).fill(3500.0);

// Legacy compatibility values retained for existing references
let n_per_core = CORE_PARTICLE_COUNTS[0];
let core_vel_scale = CORE_VEL_SCALES[0];
let core_mass = CORE_MASSES[0];

// Derived / state
let log_max_radius = Math.log(disk_radius + 1e-6);