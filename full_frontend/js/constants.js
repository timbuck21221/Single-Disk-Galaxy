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

// Default simulation parameters (can be overridden by controls)
let dt = 0.02;
let physics_steps_per_frame = 2;
let n_per_core = 500;
let disk_radius = 8.0;
let velocity_noise = 0.01;
let core_vel_scale = 1.0;
let core_mass = 3500.0;
let CORE_MASSES = [core_mass, core_mass];
let r_max = 120.0;
let k_tether = 0.002;
let enable_trails = true;
let trail_fade = 0.05;

// Derived / state
let log_max_radius = Math.log(disk_radius + 1e-6);
