import numpy as np
import pygame

def project(pos, camera_pos, camera_rot, screen_size,
            focal_length=500, zoom=1.0):
    """
    Project 3D positions into 2D screen coordinates.
    Returns:
        projected: (N,2)
        mask: particles in front of camera
        z_cam: depth values (camera space)
    """
    # Translate into camera frame
    p = pos - camera_pos
    yaw, pitch = camera_rot

    # ---------- Yaw (Z-axis) ----------
    cy, sy = np.cos(yaw), np.sin(yaw)
    x1 =  cy * p[:,0] + sy * p[:,1]
    y1 = -sy * p[:,0] + cy * p[:,1]
    z1 =  p[:,2]

    # ---------- Pitch (X-axis) ----------
    cp, sp = np.cos(pitch), np.sin(pitch)
    y2 = cp * y1 - sp * z1
    z2 = sp * y1 + cp * z1
    x2 = x1

    # ---------- Perspective ----------
    eps = 1e-2
    f = focal_length * zoom

    screen_x = screen_size / 2 + f * x2 / (z2 + 5 + eps)
    screen_y = screen_size / 2 + f * y2 / (z2 + 5 + eps)

    # Keep particles in front of camera
    mask = z2 > -4.9

    return np.column_stack((screen_x, screen_y)), mask, z2


def handle_mouse(camera_rot, mouse_down, last_mouse_pos,
                 zoom, event, sensitivity=0.005):
    """
    Mouse drag → rotate
    Mouse wheel → zoom
    """
    if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
        mouse_down = True
        last_mouse_pos = event.pos

    elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
        mouse_down = False

    elif event.type == pygame.MOUSEMOTION and mouse_down:
        dx = event.pos[0] - last_mouse_pos[0]
        dy = event.pos[1] - last_mouse_pos[1]
        last_mouse_pos = event.pos

        camera_rot[0] += dx * sensitivity
        camera_rot[1] += dy * sensitivity
        camera_rot[1] = np.clip(
            camera_rot[1],
            -np.pi/2 + 0.01,
             np.pi/2 - 0.01
        )

    elif event.type == pygame.MOUSEWHEEL:
        zoom *= (1.0 + event.y * 0.1)
        zoom = np.clip(zoom, 0.05, 6.0)

    return camera_rot, mouse_down, last_mouse_pos, zoom
