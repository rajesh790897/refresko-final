<?php

function admin_login(): void
{
    $payload = get_json_input();
    require_fields($payload, ['email', 'password']);

    $email = strtolower(trim((string)$payload['email']));
    $password = (string)$payload['password'];

    $pdo = db();
    $stmt = $pdo->prepare('SELECT id, display_name, email, password_hash, role, is_active FROM admin_users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $admin = $stmt->fetch();

    if (!$admin || (int)$admin['is_active'] !== 1) {
        json_response(['success' => false, 'message' => 'Invalid credentials'], 401);
    }

    if (!password_verify($password, (string)$admin['password_hash'])) {
        json_response(['success' => false, 'message' => 'Invalid credentials'], 401);
    }

    json_response([
        'success' => true,
        'admin' => [
            'id' => $admin['id'],
            'name' => $admin['display_name'] ?: $admin['email'],
            'email' => $admin['email'],
            'role' => $admin['role'],
        ]
    ]);
}

function admin_create(): void
{
    $payload = get_json_input();
    require_fields($payload, ['email', 'password', 'role']);

    $name = trim((string)($payload['name'] ?? ''));
    $email = strtolower(trim((string)$payload['email']));
    $password = (string)$payload['password'];
    $role = strtolower(trim((string)$payload['role']));

    if (!in_array($role, ['admin', 'superadmin'], true)) {
        json_response(['success' => false, 'message' => 'Invalid role'], 422);
    }

    if (strlen($password) < 8) {
        json_response(['success' => false, 'message' => 'Password must be at least 8 characters'], 422);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    if ($name === '') {
        $name = $email;
    }

    $pdo = db();
    $stmt = $pdo->prepare('INSERT INTO admin_users (display_name, email, password_hash, role, is_active)
                           VALUES (:display_name, :email, :password_hash, :role, 1)');

    try {
        $stmt->execute([
            ':display_name' => $name,
            ':email' => $email,
            ':password_hash' => $hash,
            ':role' => $role,
        ]);
    } catch (Throwable $error) {
        json_response(['success' => false, 'message' => 'Unable to create admin', 'error' => $error->getMessage()], 500);
    }

    json_response(['success' => true, 'message' => 'Admin created'], 201);
}

function admin_list(): void
{
    $pdo = db();
    $stmt = $pdo->query('SELECT id, display_name, email, role, is_active, created_at
                         FROM admin_users
                         ORDER BY id DESC');
    $rows = $stmt->fetchAll();

    $admins = array_map(static function (array $row): array {
        return [
            'id' => 'ADM' . $row['id'],
            'db_id' => (int)$row['id'],
            'name' => $row['display_name'] ?: $row['email'],
            'email' => $row['email'],
            'role' => $row['role'],
            'status' => ((int)$row['is_active'] === 1) ? 'active' : 'inactive',
            'createdAt' => $row['created_at'],
        ];
    }, $rows);

    json_response(['success' => true, 'admins' => $admins]);
}

function admin_update(): void
{
    $payload = get_json_input();
    require_fields($payload, ['admin_id']);

    $rawId = trim((string)$payload['admin_id']);
    $dbId = (int)preg_replace('/[^0-9]/', '', $rawId);
    if ($dbId <= 0) {
        json_response(['success' => false, 'message' => 'Invalid admin_id'], 422);
    }

    $hasStatus = array_key_exists('status', $payload);
    $hasPassword = array_key_exists('password', $payload);
    $hasName = array_key_exists('name', $payload);

    if (!$hasStatus && !$hasPassword && !$hasName) {
        json_response(['success' => false, 'message' => 'No updates provided'], 422);
    }

    $updates = [];
    $params = [':id' => $dbId];

    if ($hasStatus) {
        $status = strtolower(trim((string)$payload['status']));
        if (!in_array($status, ['active', 'inactive'], true)) {
            json_response(['success' => false, 'message' => 'Invalid status'], 422);
        }
        $updates[] = 'is_active = :is_active';
        $params[':is_active'] = $status === 'active' ? 1 : 0;
    }

    if ($hasPassword) {
        $password = trim((string)$payload['password']);
        if (strlen($password) < 8) {
            json_response(['success' => false, 'message' => 'Password must be at least 8 characters'], 422);
        }
        $updates[] = 'password_hash = :password_hash';
        $params[':password_hash'] = password_hash($password, PASSWORD_BCRYPT);
    }

    if ($hasName) {
        $name = trim((string)$payload['name']);
        if ($name === '') {
            json_response(['success' => false, 'message' => 'Name cannot be empty'], 422);
        }
        $updates[] = 'display_name = :display_name';
        $params[':display_name'] = $name;
    }

    $sql = 'UPDATE admin_users SET ' . implode(', ', $updates) . ' WHERE id = :id';
    $pdo = db();
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        json_response(['success' => false, 'message' => 'Admin not found or unchanged'], 404);
    }

    json_response(['success' => true, 'message' => 'Admin updated']);
}

function admin_delete(): void
{
    $payload = get_json_input();
    require_fields($payload, ['admin_id']);

    $rawId = trim((string)$payload['admin_id']);
    $dbId = (int)preg_replace('/[^0-9]/', '', $rawId);
    if ($dbId <= 0) {
        json_response(['success' => false, 'message' => 'Invalid admin_id'], 422);
    }

    $pdo = db();
    $stmt = $pdo->prepare('DELETE FROM admin_users WHERE id = :id');
    $stmt->execute([':id' => $dbId]);

    if ($stmt->rowCount() === 0) {
        json_response(['success' => false, 'message' => 'Admin not found'], 404);
    }

    json_response(['success' => true, 'message' => 'Admin deleted']);
}
