import { mat4, vec3, quat, glMatrix } from 'gl-matrix';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

class TempCamera {
    constructor() {
        // Transform parameters
        this.Pos = vec3.fromValues(0, 0, 5);           // Position vector
        this.Rotation = quat.create();                 // Rotation quaternion
        this.Forward = vec3.fromValues(0, 0, -1);      // Forward vector
        this.Right = vec3.fromValues(1, 0, 0);         // Right vector
        this.Up = vec3.fromValues(0, 1, 0);            // Up vector

        // Projection parameters
        this.FOV = 45.0;                               // Field of view in degrees
        this.AspectRatio = 1.0;                        // Aspect ratio
        this.NearPlane = 0.1;                          // Near clip plane
        this.FarPlane = 1000.0;                        // Far clip plane

        // Cached matrices
        this.ViewMatrix = mat4.create();
        this.ProjectionMatrix = mat4.create();
        this.ViewProjectionMatrix = mat4.create();

        // Initialize matrices
        this.UpdateViewMatrix();
        this.UpdateProjectionMatrix();

        // Add input sensitivity parameters
        this.RotationSpeed = 1.0;    // Degrees per input value
        this.MovementSpeed = 1.0;    // Units per input value

        // Add name attribute
        this.Name = 'Camera';  // Default name
    }

    // Convert quaternion to Euler angles (in degrees)
    GetEulerAngles() {
        const euler = vec3.create();
        
        // Extract Euler angles from quaternion
        // Pitch (X-axis rotation)
        const sinp = 2.0 * (this.Rotation[3] * this.Rotation[1] - this.Rotation[2] * this.Rotation[0]);
        if (Math.abs(sinp) >= 1) {
            euler[0] = Math.sign(sinp) * 90; // Use 90 degrees if sinp is 1 or -1
        } else {
            euler[0] = Math.asin(sinp) * RAD2DEG;
        }
        
        // Yaw (Y-axis rotation)
        const siny = 2.0 * (this.Rotation[3] * this.Rotation[2] + this.Rotation[0] * this.Rotation[1]);
        const cosy = 1.0 - 2.0 * (this.Rotation[1] * this.Rotation[1] + this.Rotation[2] * this.Rotation[2]);
        euler[1] = Math.atan2(siny, cosy) * RAD2DEG;
        
        // Roll (Z-axis rotation)
        const sinr = 2.0 * (this.Rotation[3] * this.Rotation[0] + this.Rotation[1] * this.Rotation[2]);
        const cosr = 1.0 - 2.0 * (this.Rotation[0] * this.Rotation[0] + this.Rotation[1] * this.Rotation[1]);
        euler[2] = Math.atan2(sinr, cosr) * RAD2DEG;
        
        return euler;
    }

    // Set rotation using Euler angles (in degrees)
    SetRotationFromEuler(pitch, yaw, roll) {
        quat.fromEuler(this.Rotation, pitch, yaw, roll);
        this.UpdateVectors();
        this.UpdateViewMatrix();
    }

    // Update direction vectors based on rotation
    UpdateVectors() {
        // Calculate forward vector
        vec3.transformQuat(this.Forward, vec3.fromValues(0, 0, -1), this.Rotation);
        vec3.normalize(this.Forward, this.Forward);

        // Calculate right vector
        vec3.cross(this.Right, this.Forward, vec3.fromValues(0, 1, 0));
        vec3.normalize(this.Right, this.Right);

        // Calculate up vector
        vec3.cross(this.Up, this.Right, this.Forward);
        vec3.normalize(this.Up, this.Up);
    }

    UpdateViewMatrix() {
        // Calculate view matrix using position and rotation
        const target = vec3.create();
        vec3.add(target, this.Pos, this.Forward);
        mat4.lookAt(this.ViewMatrix, this.Pos, target, this.Up);
        this.UpdateViewProjectionMatrix();
        return this.ViewMatrix;
    }

    UpdateProjectionMatrix() {
        mat4.perspective(
            this.ProjectionMatrix,
            this.FOV * DEG2RAD,
            this.AspectRatio,
            this.NearPlane,
            this.FarPlane
        );
        this.UpdateViewProjectionMatrix();
        return this.ProjectionMatrix;
    }

    UpdateViewProjectionMatrix() {
        mat4.multiply(this.ViewProjectionMatrix, this.ProjectionMatrix, this.ViewMatrix);
        return this.ViewProjectionMatrix;
    }

    SetPosition(x, y, z) {
        this.Pos[0] = x;
        this.Pos[1] = y;
        this.Pos[2] = z;
        this.UpdateViewMatrix();
    }

    SetRotation(quatX, quatY, quatZ, quatW) {
        quat.set(this.Rotation, quatX, quatY, quatZ, quatW);
        this.UpdateVectors();
        this.UpdateViewMatrix();
    }

    SetAspectRatio(aspectRatio) {
        this.AspectRatio = aspectRatio;
        this.UpdateProjectionMatrix();
    }

    SetFOV(fov) {
        this.FOV = fov;
        this.UpdateProjectionMatrix();
    }

    GetViewMatrix() {
        return this.ViewMatrix;
    }

    GetProjectionMatrix() {
        return this.ProjectionMatrix;
    }

    GetViewProjectionMatrix() {
        return this.ViewProjectionMatrix;
    }

    GetPosition() {
        return this.Pos;
    }

    GetRotation() {
        return this.Rotation;
    }

    GetForwardVector() {
        return this.Forward;
    }

    GetRightVector() {
        return this.Right;
    }

    GetUpVector() {
        return this.Up;
    }

    // Rotation inputs (in degrees)
    AddYawInput(value) {
        const euler = this.GetEulerAngles();
        this.SetRotationFromEuler(
            euler[0],                                    // Keep current pitch
            euler[1] + (value * this.RotationSpeed),    // Add yaw input
            euler[2]                                     // Keep current roll
        );
    }

    AddPitchInput(value) {
        const euler = this.GetEulerAngles();
        // Clamp pitch between -89 and 89 degrees to prevent gimbal lock
        const newPitch = Math.max(-89, Math.min(89, euler[0] + (value * this.RotationSpeed)));
        this.SetRotationFromEuler(
            newPitch,    // Add clamped pitch input
            euler[1],    // Keep current yaw
            euler[2]     // Keep current roll
        );
    }

    AddRollInput(value) {
        const euler = this.GetEulerAngles();
        this.SetRotationFromEuler(
            euler[0],                                    // Keep current pitch
            euler[1],                                    // Keep current yaw
            euler[2] + (value * this.RotationSpeed)     // Add roll input
        );
    }

    // Movement inputs
    AddForwardInput(value) {
        const movement = vec3.create();
        vec3.scale(movement, this.Forward, value * this.MovementSpeed);
        vec3.add(this.Pos, this.Pos, movement);
        this.UpdateViewMatrix();
    }

    AddRightInput(value) {
        const movement = vec3.create();
        vec3.scale(movement, this.Right, value * this.MovementSpeed);
        vec3.add(this.Pos, this.Pos, movement);
        this.UpdateViewMatrix();
    }

    AddUpInput(value) {
        const movement = vec3.create();
        vec3.scale(movement, this.Up, value * this.MovementSpeed);
        vec3.add(this.Pos, this.Pos, movement);
        this.UpdateViewMatrix();
    }

    // Speed control
    SetRotationSpeed(speed) {
        this.RotationSpeed = speed;
    }

    SetMovementSpeed(speed) {
        this.MovementSpeed = speed;
    }

    GetRotationSpeed() {
        return this.RotationSpeed;
    }

    GetMovementSpeed() {
        return this.MovementSpeed;
    }

    AddToDetailBuilder(DetailBuilder) {
        // 添加相机属性到DetailBuilder
        DetailBuilder.addProperties({
            [`${this.Name}.Position`]: {
                value: [...this.Pos],
                label: '相机位置',
                type: 'vector3',
                onChange: (path, value) => {
                    this.SetPosition(value[0], value[1], value[2]);
                }
            },
            [`${this.Name}.Rotation`]: {
                value: this.GetEulerAngles(),
                label: '相机旋转',
                type: 'vector3',
                onChange: (path, value) => {
                    const euler = value.map(v => v * Math.PI / 180);
                    this.SetRotationFromEuler(euler[0], euler[1], euler[2]);
                }
            },
            [`${this.Name}.FOV`]: {
                value: this.FOV,
                label: '视野角度',
                type: 'float',
                min: 1,
                max: 179,
                onChange: (path, value) => {
                    this.SetFOV(value);
                }
            },
            [`${this.Name}.Near`]: {
                value: this.NearPlane,
                label: '近裁面',
                type: 'float',
                min: 0.001,
                max: 100,
                onChange: (path, value) => {
                    this.NearPlane = value;
                    this.UpdateProjectionMatrix();
                }
            },
            [`${this.Name}.Far`]: {
                value: this.FarPlane,
                label: '远裁面',
                type: 'float',
                min: 1,
                max: 10000,
                onChange: (path, value) => {
                    this.FarPlane = value;
                    this.UpdateProjectionMatrix();
                }
            },
            [`${this.Name}.MovementSpeed`]: {
                value: this.MovementSpeed,
                label: '移动速度',
                type: 'float',
                min: 0.1,
                max: 100,
                onChange: (path, value) => {
                    this.SetMovementSpeed(value);
                }
            },
            [`${this.Name}.RotationSpeed`]: {
                value: this.RotationSpeed,
                label: '旋转速度',
                type: 'float',
                min: 0.1,
                max: 10,
                onChange: (path, value) => {
                    this.SetRotationSpeed(value);
                }
            }
        });
    }

    SetName(name) {
        this.Name = name;
    }
}

export default TempCamera;