// camera.js – independent orbit camera, projection, and input handling

const camera = {
    target: [0, 0, 0],
    yaw: 0.0,
    pitch: 0.35,
    distance: 65.0,
    focalLength: 600.0,

    nearPlane: 0.1,
    minDistance: 4.0,
    maxDistance: 1000.0,

    rotateSensitivity: 0.005,
    panSensitivity: 1.0,
    zoomSensitivity: 0.12,

    minPitch: -Math.PI / 2 + 0.01,
    maxPitch:  Math.PI / 2 - 0.01,

    followEnabled: true,
    followLerp: 0.08,
    initialized: false
};

const mouseState = {
    leftDown: false,
    rightDown: false,
    middleDown: false,
    lastX: 0,
    lastY: 0
};

let lastFollowTarget = [0, 0, 0];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function vecAdd(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vecSub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecScale(v, s) {
    return [v[0] * s, v[1] * s, v[2] * s];
}

function vecDot(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function vecCross(a, b) {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0]
    ];
}

function vecLength(v) {
    return Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
}

function vecNormalize(v) {
    const len = vecLength(v);
    if (len < 1e-12) return [0, 0, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
}

function setCameraTarget(target, snap = true) {
    camera.target = target.slice();
    lastFollowTarget = target.slice();
    camera.initialized = true;

    if (snap) {
        // Snap just means immediately set the target rather than lerping over time.
        camera.target = target.slice();
    }
}

function updateCameraFollow(desiredTarget) {
    lastFollowTarget = desiredTarget.slice();

    if (!camera.initialized) {
        setCameraTarget(desiredTarget, true);
        return;
    }

    if (!camera.followEnabled) return;

    camera.target[0] += (desiredTarget[0] - camera.target[0]) * camera.followLerp;
    camera.target[1] += (desiredTarget[1] - camera.target[1]) * camera.followLerp;
    camera.target[2] += (desiredTarget[2] - camera.target[2]) * camera.followLerp;
}

function getCameraBasis(cameraState = camera) {
    const cy = Math.cos(cameraState.yaw);
    const sy = Math.sin(cameraState.yaw);
    const cp = Math.cos(cameraState.pitch);
    const sp = Math.sin(cameraState.pitch);

    // Orbit camera position derived from target + spherical offset
    const offset = [
        -cameraState.distance * cp * cy,
        -cameraState.distance * cp * sy,
         cameraState.distance * sp
    ];

    const position = vecAdd(cameraState.target, offset);

    // Camera looks toward the target
    const forward = vecNormalize(vecSub(cameraState.target, position));

    const worldUp = [0, 0, 1];
    let right = vecCross(forward, worldUp);
    if (vecLength(right) < 1e-8) {
        right = [1, 0, 0];
    } else {
        right = vecNormalize(right);
    }

    const up = vecNormalize(vecCross(right, forward));

    return { position, forward, right, up };
}

function project(pos, canvasEl, cameraState = camera) {
    const N = pos.length;
    const projected = new Array(N);
    const mask = new Array(N).fill(false);

    const { position, forward, right, up } = getCameraBasis(cameraState);

    const centerX = canvasEl.width / 2;
    const centerY = canvasEl.height / 2;
    const f = cameraState.focalLength;
    const eps = 1e-6;

    for (let i = 0; i < N; i++) {
        const rel = [
            pos[i][0] - position[0],
            pos[i][1] - position[1],
            pos[i][2] - position[2]
        ];

        const xCam = vecDot(rel, right);
        const yCam = vecDot(rel, up);
        const zCam = vecDot(rel, forward);

        if (zCam > cameraState.nearPlane) {
            const screenX = centerX + f * xCam / (zCam + eps);
            const screenY = centerY - f * yCam / (zCam + eps);
            projected[i] = [screenX, screenY];
            mask[i] = true;
        } else {
            projected[i] = [0, 0];
            mask[i] = false;
        }
    }

    return { projected, mask };
}

function panCamera(dx, dy) {
    const { right, up } = getCameraBasis(camera);

    // World-units-per-pixel pan scale
    const scale = (camera.distance / camera.focalLength) * camera.panSensitivity;

    // "Grab and drag" style pan
    const panRight = vecScale(right, -dx * scale);
    const panUp = vecScale(up, dy * scale);
    const delta = vecAdd(panRight, panUp);

    camera.target[0] += delta[0];
    camera.target[1] += delta[1];
    camera.target[2] += delta[2];
}

function setupMouseControls(canvas) {
    canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
    });

    canvas.addEventListener('mousedown', e => {
        e.preventDefault();

        if (e.button === 0) mouseState.leftDown = true;
        if (e.button === 1) mouseState.middleDown = true;
        if (e.button === 2) mouseState.rightDown = true;

        mouseState.lastX = e.clientX;
        mouseState.lastY = e.clientY;
    });

    window.addEventListener('mouseup', e => {
        if (e.button === 0) mouseState.leftDown = false;
        if (e.button === 1) mouseState.middleDown = false;
        if (e.button === 2) mouseState.rightDown = false;
    });

    window.addEventListener('blur', () => {
        mouseState.leftDown = false;
        mouseState.middleDown = false;
        mouseState.rightDown = false;
    });

    window.addEventListener('mousemove', e => {
        if (!mouseState.leftDown && !mouseState.middleDown && !mouseState.rightDown) return;

        const dx = e.clientX - mouseState.lastX;
        const dy = e.clientY - mouseState.lastY;

        mouseState.lastX = e.clientX;
        mouseState.lastY = e.clientY;

        if (mouseState.leftDown) {
            camera.yaw += dx * camera.rotateSensitivity;
            camera.pitch += dy * camera.rotateSensitivity;
            camera.pitch = clamp(camera.pitch, camera.minPitch, camera.maxPitch);
        }

        if (mouseState.rightDown || mouseState.middleDown) {
            camera.followEnabled = false;
            panCamera(dx, dy);
        }
    });

    canvas.addEventListener('wheel', e => {
        e.preventDefault();

        const zoomDir = Math.sign(e.deltaY);
        camera.distance *= Math.exp(zoomDir * camera.zoomSensitivity);
        camera.distance = clamp(camera.distance, camera.minDistance, camera.maxDistance);
    }, { passive: false });

    window.addEventListener('keydown', e => {
        if (e.key === 'f' || e.key === 'F') {
            camera.followEnabled = !camera.followEnabled;
        }

        if (e.key === 'r' || e.key === 'R') {
            camera.followEnabled = true;
            setCameraTarget(lastFollowTarget, true);
        }
    });
}