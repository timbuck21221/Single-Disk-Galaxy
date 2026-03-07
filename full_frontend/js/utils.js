// Utility functions
function gaussian(mean, std) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z0;
}

function norm(v) {
    return Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2);
}

function mean_pos(arr) {
    const s = [0, 0, 0];
    arr.forEach(a => {
        s[0] += a[0];
        s[1] += a[1];
        s[2] += a[2];
    });
    return s.map(ss => ss / arr.length);
}

function smooth_colormap(t) {
    const stops = [
        [0.0, [20, 20, 120]],
        [0.25, [0, 180, 255]],
        [0.5, [255, 255, 255]],
        [0.75, [255, 200, 50]],
        [1.0, [255, 60, 60]]
    ];
    for (let i = 0; i < stops.length - 1; i++) {
        const [t0, c0] = stops[i];
        const [t1, c1] = stops[i + 1];
        if (t0 <= t && t <= t1) {
            const u = (t - t0) / (t1 - t0);
            return [
                Math.round(c0[0] + u * (c1[0] - c0[0])),
                Math.round(c0[1] + u * (c1[1] - c0[1])),
                Math.round(c0[2] + u * (c1[2] - c0[2]))
            ];
        }
    }
    return stops[stops.length - 1][1];
}
