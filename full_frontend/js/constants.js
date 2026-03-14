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
let time_scale = 1.0;

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

// ------------------------------
// Star system settings
// ------------------------------
const STAR_RENDER_MODE_CORE_DISTANCE = 'core_distance';
const STAR_RENDER_MODE_STAR_TYPE = 'star_type';
let star_render_mode = STAR_RENDER_MODE_CORE_DISTANCE;

const STAR_TYPE_BROWN_DWARF = 'brown_dwarf';
const STAR_TYPE_LOW_MASS = 'low_mass_star';
const STAR_TYPE_MAIN_SEQUENCE = 'main_sequence_star';
const STAR_TYPE_MASSIVE = 'massive_star';

// Simulation-unit mass thresholds used for classification
const STAR_MASS_BROWN_DWARF_MAX = 20.0;
const STAR_MASS_LOW_MASS_MAX = 80.0;
const STAR_MASS_MAIN_SEQUENCE_MAX = 180.0;

// Weighted initial mass generation buckets
const STAR_INIT_MASS_BROWN_DWARF_MIN = 6.0;
const STAR_INIT_MASS_BROWN_DWARF_MAX = 20.0;

const STAR_INIT_MASS_LOW_MASS_MIN = 20.0;
const STAR_INIT_MASS_LOW_MASS_MAX = 80.0;

const STAR_INIT_MASS_MAIN_SEQUENCE_MIN = 80.0;
const STAR_INIT_MASS_MAIN_SEQUENCE_MAX = 180.0;

const STAR_INIT_MASS_MASSIVE_MIN = 180.0;
const STAR_INIT_MASS_MASSIVE_MAX = 360.0;

// Relative probabilities for initial star population
const STAR_INIT_WEIGHT_BROWN_DWARF = 0.22;
const STAR_INIT_WEIGHT_LOW_MASS = 0.50;
const STAR_INIT_WEIGHT_MAIN_SEQUENCE = 0.22;
const STAR_INIT_WEIGHT_MASSIVE = 0.06;

// Raw metadata defaults
const STAR_METALLICITY_MIN = 0.008;
const STAR_METALLICITY_MAX = 0.030;

// Visual tuning
const STAR_SIZE_MIN = 1.0;
const STAR_SIZE_MAX = 4.4;

const STAR_BASE_RADIUS_BROWN_DWARF = 1.00;
const STAR_BASE_RADIUS_LOW_MASS = 1.20;
const STAR_BASE_RADIUS_MAIN_SEQUENCE = 1.50;
const STAR_BASE_RADIUS_MASSIVE = 1.95;

const STAR_MASS_RADIUS_FACTOR_BROWN_DWARF = 0.16;
const STAR_MASS_RADIUS_FACTOR_LOW_MASS = 0.19;
const STAR_MASS_RADIUS_FACTOR_MAIN_SEQUENCE = 0.22;
const STAR_MASS_RADIUS_FACTOR_MASSIVE = 0.27;

const STAR_COLOR_BROWN_DWARF = [175, 95, 95];
const STAR_COLOR_LOW_MASS = [255, 195, 120];
const STAR_COLOR_MAIN_SEQUENCE = [255, 245, 210];
const STAR_COLOR_MASSIVE = [170, 215, 255];

const STAR_GLOW_ALPHA_BROWN_DWARF = 0.07;
const STAR_GLOW_ALPHA_LOW_MASS = 0.10;
const STAR_GLOW_ALPHA_MAIN_SEQUENCE = 0.13;
const STAR_GLOW_ALPHA_MASSIVE = 0.18;

// ------------------------------
// Gas particle system settings
// ------------------------------
const GAS_PARTICLES_ENABLED = true;

// Initial cloud population per galaxy
const GAS_INITIAL_CLOUDS_PER_GALAXY_MIN = 3;
const GAS_INITIAL_CLOUDS_PER_GALAXY_MAX = 8;

// Number of gas particles spawned by each cloud
const GAS_PARTICLES_PER_CLOUD_MIN = 35;
const GAS_PARTICLES_PER_CLOUD_MAX = 100;

// Total mass assigned to each spawned cloud
const GAS_CLOUD_MASS_MIN = 700.0;
const GAS_CLOUD_MASS_MAX = 1400.0;

// Initial gas-cluster radius around each generated cloud center
const GAS_CLOUD_SPAWN_RADIUS_MIN = 0.85;
const GAS_CLOUD_SPAWN_RADIUS_MAX = 1.35;

// Orbital placement of cloud centers around each galaxy
const GAS_CLOUD_ORBIT_RADIUS_MIN_FACTOR = 0.35;
const GAS_CLOUD_ORBIT_RADIUS_MAX_FACTOR = 1.05;

// Vertical spread for cloud center placement relative to disk thickness
const GAS_CLOUD_CENTER_Z_STD = 0.18;

// Random velocity offsets applied to particles within a cloud
const GAS_CLOUD_INTERNAL_VEL_STD_XY = 0.02;
const GAS_CLOUD_INTERNAL_VEL_STD_Z = 0.008;

// Small drift added to whole cloud center velocity
const GAS_CLOUD_BULK_DRIFT_STD_XY = 0.05;
const GAS_CLOUD_BULK_DRIFT_STD_Z = 0.01;

// Procedural cloud visual palette
const GAS_CLOUD_COLOR_PALETTE = [
    [120, 190, 255],
    [255, 110, 150],
    [150, 220, 255],
    [180, 255, 210],
    [255, 180, 120]
];

const GAS_CLOUD_OPACITY_MIN = 0.14;
const GAS_CLOUD_OPACITY_MAX = 0.22;

// Main neighborhood radius for gas-gas interaction
const GAS_NEIGHBOR_RADIUS = 0.95;

// Short-range repulsion radius inside the neighborhood
const GAS_REPULSION_RADIUS = 0.24;

// Attraction / repulsion strengths
const GAS_ATTRACTION_STRENGTH = 3.6;
const GAS_REPULSION_STRENGTH = 5.5;

// Small local velocity-matching damping between nearby gas particles
const GAS_ALIGNMENT_DAMPING = 0.075;

// Mild overall gas damping to prevent noisy blow-up
const GAS_GLOBAL_DAMPING = 0.0012;

// Rendering
const GAS_PARTICLE_BASE_SIZE = 1;
const GAS_PARTICLE_DENSITY_SIZE_BOOST = 0.16;
const GAS_PARTICLE_BASE_ALPHA = 0.20;
const GAS_PARTICLE_DENSITY_ALPHA_BOOST = 0.018;
const GAS_DENSITY_RENDER_RADIUS = 0.6;

// Star formation
const GAS_FORMATION_RADIUS = 0.42;
const GAS_FORMATION_THRESHOLD = 20;
const GAS_CONSUME_COUNT = 12;
const GAS_MAX_STARS_PER_SUBSTEP = 1;

// Star birth flash
const STAR_BIRTH_FLASH_LIFETIME = 0.02;
const STAR_BIRTH_FLASH_MAX_WORLD_RADIUS = 0.55;

// Derived / state
let log_max_radius = Math.log(disk_radius + 1e-6);