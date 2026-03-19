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
let dt = 0.005;
let physics_steps_per_frame = 1;
let time_scale = 0.11;

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

const STAR_DISPLAY_FILTER_ALL = 'all';
const STAR_DISPLAY_FILTER_COMPACT_REMNANT = 'compact_remnant';
const STAR_DISPLAY_FILTER_SUPERNOVA_REMNANT = 'supernova_remnant';
let star_display_filter = STAR_DISPLAY_FILTER_ALL;

const STAR_TYPE_BROWN_DWARF = 'brown_dwarf';
const STAR_TYPE_LOW_MASS = 'low_mass_star';
const STAR_TYPE_MAIN_SEQUENCE = 'main_sequence_star';
const STAR_TYPE_MASSIVE = 'massive_star';
const STAR_TYPE_RED_GIANT = 'red_giant';
const STAR_TYPE_RED_SUPERGIANT = 'red_supergiant';
const STAR_TYPE_WHITE_DWARF = 'white_dwarf';
const STAR_TYPE_NEUTRON_STAR = 'neutron_star';
const STAR_TYPE_PULSAR = 'pulsar';
const STAR_TYPE_BLACK_HOLE = 'black_hole';

// Simulation-unit mass thresholds used for birth classification
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

// Lifecycle
const STAR_AGE_RATE = 2.5;

// Minimum age before a branch is eligible to evolve
const STAR_EVOLVE_AGE_LOW_MASS = 20.0;
const STAR_EVOLVE_AGE_MAIN_SEQUENCE = 15.0;
const STAR_EVOLVE_AGE_MASSIVE = 7.0;

// Per-step evolution probability scale after age threshold is reached
const STAR_EVOLVE_CHANCE_RATE_LOW_MASS = 0.0050;
const STAR_EVOLVE_CHANCE_RATE_MAIN_SEQUENCE = 0.003;
const STAR_EVOLVE_CHANCE_RATE_MASSIVE = 0.004;

// Mass evolution during giant phases
const STAR_GIANT_MASS_GROWTH_RATE = 0.020;
const STAR_SUPERGIANT_MASS_GROWTH_RATE = 0.045;

// Evolutionary mass multipliers relative to birth mass
const STAR_RED_GIANT_TARGET_MASS_FACTOR_LOW = 1.45;
const STAR_RED_GIANT_TARGET_MASS_FACTOR_MAIN = 1.75;
const STAR_RED_SUPERGIANT_TARGET_MASS_FACTOR = 2.35;

// Supernova + remnant
const STAR_SUPERNOVA_STAGE_AGE_RED_SUPERGIANT = 5.5;
const STAR_SUPERNOVA_CHANCE_RATE_RED_SUPERGIANT = 0.500;

const STAR_SUPERNOVA_GAS_RETURN_FRACTION = 0.78;
const STAR_SUPERNOVA_REMNANT_FRACTION = 0.22;

const STAR_WHITE_DWARF_MIN_REMNANT_MASS = 12.0;
const STAR_NEUTRON_STAR_MIN_REMNANT_MASS = 26.0;
const STAR_PULSAR_MIN_REMNANT_MASS = 36.0;
const STAR_BLACK_HOLE_MIN_REMNANT_MASS = 52.0;
const STAR_PULSAR_CHANCE = 0.12;

// Black hole lifecycle + accretion
const BLACK_HOLE_CORE_PROMOTION_MASS = 1500.0;

const BLACK_HOLE_SOFTENING = 0.10;
const BLACK_HOLE_LOCAL_GRAVITY_STRENGTH = 1.85;

const BLACK_HOLE_INFLUENCE_RADIUS_BASE = 1.9;
const BLACK_HOLE_INFLUENCE_RADIUS_MASS_FACTOR = 1.55;

const BLACK_HOLE_GAS_ABSORB_RADIUS_BASE = 0.12;
const BLACK_HOLE_GAS_ABSORB_RADIUS_MASS_FACTOR = 0.055;

const BLACK_HOLE_STAR_ABSORB_RADIUS_BASE = 0.16;
const BLACK_HOLE_STAR_ABSORB_RADIUS_MASS_FACTOR = 0.070;

const BLACK_HOLE_GAS_ACCRETION_EFFICIENCY = 1.0;
const BLACK_HOLE_STAR_ACCRETION_EFFICIENCY = 1.0;

// Pulsar beam tuning
const PULSAR_BEAM_LENGTH = 55.0;
const PULSAR_BEAM_WIDTH = 0.15;
const PULSAR_BEAM_CORE_ALPHA = 0.45;
const PULSAR_BEAM_HAZE_ALPHA = 0.16;
const PULSAR_BEAM_SPIN_RATE_MIN = 1.3;
const PULSAR_BEAM_SPIN_RATE_MAX = 3.1;
const PULSAR_BEAM_PULSE_RATE_MIN = 4.5;
const PULSAR_BEAM_PULSE_RATE_MAX = 9.0;
const PULSAR_BEAM_PULSE_STRENGTH_MIN = 0.55;
const PULSAR_BEAM_PULSE_STRENGTH_MAX = 1.00;

// Visual tuning
const STAR_SIZE_MIN = 1.0;
const STAR_SIZE_MAX = 6.8;

const STAR_BASE_RADIUS_BROWN_DWARF = 1.00;
const STAR_BASE_RADIUS_LOW_MASS = 1.20;
const STAR_BASE_RADIUS_MAIN_SEQUENCE = 1.50;
const STAR_BASE_RADIUS_MASSIVE = 1.95;
const STAR_BASE_RADIUS_RED_GIANT = 2.70;
const STAR_BASE_RADIUS_RED_SUPERGIANT = 3.55;
const STAR_BASE_RADIUS_WHITE_DWARF = 1.15;
const STAR_BASE_RADIUS_NEUTRON_STAR = 1.18;
const STAR_BASE_RADIUS_PULSAR = 1.10;

// Legacy compatibility only.
// Black holes no longer use the generic star radius pipeline for rendering.
const STAR_BASE_RADIUS_BLACK_HOLE = STAR_BASE_RADIUS_BROWN_DWARF;
const STAR_MASS_RADIUS_FACTOR_BLACK_HOLE = 0.18;

const STAR_MASS_RADIUS_FACTOR_BROWN_DWARF = 0.16;
const STAR_MASS_RADIUS_FACTOR_LOW_MASS = 0.19;
const STAR_MASS_RADIUS_FACTOR_MAIN_SEQUENCE = 0.22;
const STAR_MASS_RADIUS_FACTOR_MASSIVE = 0.27;
const STAR_MASS_RADIUS_FACTOR_RED_GIANT = 0.36;
const STAR_MASS_RADIUS_FACTOR_RED_SUPERGIANT = 0.46;
const STAR_MASS_RADIUS_FACTOR_WHITE_DWARF = 0.12;
const STAR_MASS_RADIUS_FACTOR_NEUTRON_STAR = 0.08;
const STAR_MASS_RADIUS_FACTOR_PULSAR = 0.09;

const STAR_COLOR_BROWN_DWARF = [175, 95, 95];
const STAR_COLOR_LOW_MASS = [255, 195, 120];
const STAR_COLOR_MAIN_SEQUENCE = [255, 245, 210];
const STAR_COLOR_MASSIVE = [170, 215, 255];
const STAR_COLOR_RED_GIANT = [255, 135, 90];
const STAR_COLOR_RED_SUPERGIANT = [255, 82, 70];
const STAR_COLOR_WHITE_DWARF = [220, 235, 255];
const STAR_COLOR_NEUTRON_STAR = [255, 255, 255];
const STAR_COLOR_PULSAR = [135, 215, 255];
const STAR_COLOR_BLACK_HOLE = [8, 8, 10];
const PULSAR_BEAM_COLOR = [120, 210, 255];

const STAR_GLOW_ALPHA_BROWN_DWARF = 0.07;
const STAR_GLOW_ALPHA_LOW_MASS = 0.10;
const STAR_GLOW_ALPHA_MAIN_SEQUENCE = 0.13;
const STAR_GLOW_ALPHA_MASSIVE = 0.18;
const STAR_GLOW_ALPHA_RED_GIANT = 0.22;
const STAR_GLOW_ALPHA_RED_SUPERGIANT = 0.30;
const STAR_GLOW_ALPHA_WHITE_DWARF = 0.11;
const STAR_GLOW_ALPHA_NEUTRON_STAR = 0.34;
const STAR_GLOW_ALPHA_PULSAR = 0.28;
const STAR_GLOW_ALPHA_BLACK_HOLE = 0.06;

// Black hole visuals
// Unified body sizing curve for ALL black holes, promoted or not.
const BLACK_HOLE_RENDER_RADIUS_MIN = STAR_BASE_RADIUS_BROWN_DWARF;
const BLACK_HOLE_RENDER_RADIUS_MAX = 2.8;

// Mass anchor points for the unified visual curve.
// At remnant birth mass -> min render radius.
// At promotion mass -> max render radius.
const BLACK_HOLE_RENDER_MASS_MIN = STAR_BLACK_HOLE_MIN_REMNANT_MASS;
const BLACK_HOLE_RENDER_MASS_MAX = BLACK_HOLE_CORE_PROMOTION_MASS;

// Cap the full visible footprint so black holes never visually exceed core size.
const BLACK_HOLE_MAX_VISUAL_RADIUS = CORE_SIZE;

// Body + ring + lensing appearance
const BLACK_HOLE_RIM_COLOR = [255, 255, 255];
const BLACK_HOLE_RIM_ALPHA = 0.95;
const BLACK_HOLE_RIM_WIDTH_FACTOR = 0.22;
const BLACK_HOLE_CORE_DARK_SCALE = 0.86;

const BLACK_HOLE_LENSING_RADIUS_FACTOR = 2.05;
const BLACK_HOLE_LENSING_ALPHA = 0.14;

// Slightly stronger footprint once promoted, without changing the body-size system.
const BLACK_HOLE_PROMOTED_LENSING_ALPHA_SCALE = 1.12;
const BLACK_HOLE_PROMOTED_SUBTLE_RING_ALPHA = 0.10;
const BLACK_HOLE_PROMOTED_SUBTLE_RING_SCALE = 1.24;

// Legacy compatibility only.
// These are no longer the canonical black-hole sizing controls.
const BLACK_HOLE_CORE_RADIUS_MIN = BLACK_HOLE_RENDER_RADIUS_MIN;
const BLACK_HOLE_CORE_RADIUS_MAX = BLACK_HOLE_RENDER_RADIUS_MAX;
const BLACK_HOLE_CORE_MASS_RADIUS_LOG_FACTOR = 0.85;

// Supernova visual event
const SUPERNOVA_EVENT_LIFETIME = 0.28;
const SUPERNOVA_EVENT_MAX_WORLD_RADIUS = 3.8;
const SUPERNOVA_EVENT_COLOR = [255, 170, 120];

// Supernova scene-dimming and core tuning
const SUPERNOVA_SCENE_DIM_STRENGTH = 0.75;
const SUPERNOVA_SCENE_DIM_EXPONENT = 2.7;
const SUPERNOVA_REMNANT_WHITE_COLOR = [255, 255, 255];
const SUPERNOVA_REMNANT_FLASH_GLOW_ALPHA = 0.79;
const SUPERNOVA_REMNANT_FLASH_RADIUS_BOOST = 0.45;

const SUPERNOVA_CORE_ALPHA = 0.96;
const SUPERNOVA_CORE_RADIUS_FACTOR = 0.16;
const SUPERNOVA_CORE_BLOOM_RADIUS_FACTOR = 0.72;
const SUPERNOVA_CORE_BLOOM_ALPHA = 0.52;
const SUPERNOVA_CORE_COLOR = [255, 248, 238];

// ------------------------------
// Gas particle system settings
// ------------------------------
const GAS_PARTICLES_ENABLED = true;

// Initial cloud population per galaxy
const GAS_INITIAL_CLOUDS_PER_GALAXY_MIN = 3;
const GAS_INITIAL_CLOUDS_PER_GALAXY_MAX = 8;

// Number of gas particles spawned by each cloud
const GAS_PARTICLES_PER_CLOUD_MIN = 35;
const GAS_PARTICLES_PER_CLOUD_MAX = 75;

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

// Supernova ejecta gas
const SUPERNOVA_EJECTA_PARTICLE_COUNT_MIN = 56;
const SUPERNOVA_EJECTA_PARTICLE_COUNT_MAX = 96;
const SUPERNOVA_EJECTA_SPAWN_RADIUS_MIN = 0.12;
const SUPERNOVA_EJECTA_SPAWN_RADIUS_MAX = 0.34;
const SUPERNOVA_EJECTA_SPEED_MIN = 1.2;
const SUPERNOVA_EJECTA_SPEED_MAX = 3.0;
const SUPERNOVA_EJECTA_OPACITY_MIN = 0.20;
const SUPERNOVA_EJECTA_OPACITY_MAX = 0.25;
const SUPERNOVA_EJECTA_COLOR_PALETTE = [
    [255, 185, 120],
    [255, 130, 110],
    [255, 210, 150],
    [255, 160, 95]
];
const SUPERNOVA_EJECTA_HOT_COLOR = [255, 248, 235];
const SUPERNOVA_EJECTA_HEAT_LIFETIME_MIN = 0.18;
const SUPERNOVA_EJECTA_HEAT_LIFETIME_MAX = 0.22;
const SUPERNOVA_EJECTA_HEAT_ALPHA_BOOST = 0.02;
const SUPERNOVA_EJECTA_HEAT_SIZE_BOOST = 0.15;

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
const GAS_PARTICLE_DENSITY_ALPHA_BOOST = 0.0;
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