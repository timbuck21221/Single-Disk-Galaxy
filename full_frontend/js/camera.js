// Camera projection & input handling

function project(pos, camera_pos, camera_rot, focal_length = 600, zoom = 1.0) {
    const N = pos.length;
    const projected = new Array(N).fill(0).map(() => [0, 0]);
    const mask = new Array(N).fill(false);

    const yaw = camera_rot[0];
    const pitch = camera_rot[1];
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const eps = 1e-2;
    const f = focal_length * zoom;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < N; i++) {
        let px = pos[i][0] - camera_pos[0];
        let py = pos[i][1] - camera_pos[1];
        let pz = pos[i][2] - camera_pos[2];

        const x1 = cy * px + sy * py;
        const y1 = -sy * px + cy * py;
        const z1 = pz;

        const y2 = cp * y1 - sp * z1;
        const z2 = sp * y1 + cp * z1;
        const x2 = x1;

        const screen_x = centerX + f * x2 / (z2 + 5 + eps);
        const screen_y = centerY + f * y2 / (z2 + 5 + eps);

        projected[i] = [screen_x, screen_y];
        mask[i] = z2 > -4.9;
    }

    return { projected, mask };
}

// Global camera state (used by main)
let camera_rot = [0.0, 0.0];
let mouse_down = false;
let last_mouse_pos = null;
let zoom = 0.5;

function setupMouseControls(canvas) {
    canvas.addEventListener('mousedown', e => {
        if (e.button === 0) {
            mouse_down = true;
            const rect = canvas.getBoundingClientRect();
            last_mouse_pos = [e.clientX - rect.left, e.clientY - rect.top];
        }
    });

    canvas.addEventListener('mouseup', e => {
        if (e.button === 0) mouse_down = false;
    });

    canvas.addEventListener('mousemove', e => {
        if (mouse_down) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const dx = x - last_mouse_pos[0];
            const dy = y - last_mouse_pos[1];
            last_mouse_pos = [x, y];
            camera_rot[0] += dx * 0.005;
            camera_rot[1] += dy * 0.005;
            camera_rot[1] = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, camera_rot[1]));
        }
    });

    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        zoom *= (1.0 - Math.sign(e.deltaY) * 0.08);
        zoom = Math.max(0.05, Math.min(8.0, zoom));
    });
}
