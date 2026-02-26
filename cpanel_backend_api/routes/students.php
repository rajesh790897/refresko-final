<?php

function supabase_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $env = require __DIR__ . '/../config/env.php';
    $supabase = $env['supabase'] ?? [];

    $config = [
        'url' => rtrim((string)($supabase['url'] ?? ''), '/'),
        'service_key' => (string)($supabase['service_key'] ?? ''),
        'anon_key' => (string)($supabase['anon_key'] ?? ''),
    ];

    return $config;
}

function supabase_fetch_student(string $studentCode): ?array
{
    $config = supabase_config();
    $supabaseKey = $config['service_key'] !== '' ? $config['service_key'] : $config['anon_key'];

    if ($config['url'] === '' || $supabaseKey === '') {
        return null;
    }

    $select = 'name,student_code,email,phone,department,year,profile_completed,'
        . 'payment_completion,gate_pass_created,payment_approved,food_included,food_preference';
    $query = 'select=' . urlencode($select) . '&student_code=eq.' . urlencode($studentCode) . '&limit=1';
    $url = $config['url'] . '/rest/v1/students?' . $query;

    $headers = [
        'Content-Type: application/json',
        'apikey: ' . $supabaseKey,
        'Authorization: Bearer ' . $supabaseKey,
    ];

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => implode("\r\n", $headers),
            'timeout' => 5,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        return null;
    }

    $data = json_decode($response, true);
    if (!is_array($data) || count($data) === 0) {
        return null;
    }

    return $data[0];
}

function students_get_one(): void
{
    $studentCode = strtoupper(trim((string)($_GET['student_code'] ?? '')));
    if ($studentCode === '') {
        json_response(['success' => false, 'message' => 'student_code is required'], 422);
    }
    

    $supabaseStudent = supabase_fetch_student($studentCode);
    if ($supabaseStudent) {
        json_response(['success' => true, 'student' => $supabaseStudent]);
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM students WHERE student_code = :student_code LIMIT 1');
    $stmt->execute([':student_code' => $studentCode]);
    $student = $stmt->fetch();

    if (!$student) {
        json_response(['success' => false, 'message' => 'Student not found'], 404);
    }

    json_response(['success' => true, 'student' => $student]);
}

function students_upsert_profile(): void
{
    $payload = get_json_input();
    require_fields($payload, ['student_code', 'name', 'phone']);

    $studentCode = strtoupper(trim((string)$payload['student_code']));
    $name = trim((string)($payload['name'] ?? ''));

    if ($studentCode === '' || $name === '') {
        json_response(['success' => false, 'message' => 'Invalid student profile payload'], 422);
    }

    $pdo = db();

    $sql = 'INSERT INTO students (
                student_code, name, email, phone, department, year,
                profile_completed, payment_completion, gate_pass_created,
                payment_approved, food_included, food_preference
            ) VALUES (
                :student_code, :name, :email, :phone, :department, :year,
                :profile_completed, :payment_completion, :gate_pass_created,
                :payment_approved, :food_included, :food_preference
            )
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                email = VALUES(email),
                phone = VALUES(phone),
                department = VALUES(department),
                year = VALUES(year),
                profile_completed = VALUES(profile_completed),
                payment_completion = VALUES(payment_completion),
                gate_pass_created = VALUES(gate_pass_created),
                payment_approved = VALUES(payment_approved),
                food_included = VALUES(food_included),
                food_preference = VALUES(food_preference)';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':student_code' => $studentCode,
        ':name' => $name,
        ':email' => strtolower(trim((string)($payload['email'] ?? ''))),
        ':phone' => trim((string)($payload['phone'] ?? '')),
        ':department' => trim((string)($payload['department'] ?? '')),
        ':year' => trim((string)($payload['year'] ?? '')),
        ':profile_completed' => bool_to_int((bool)($payload['profile_completed'] ?? true)),
        ':payment_completion' => bool_to_int((bool)($payload['payment_completion'] ?? false)),
        ':gate_pass_created' => bool_to_int((bool)($payload['gate_pass_created'] ?? false)),
        ':payment_approved' => (string)($payload['payment_approved'] ?? 'pending'),
        ':food_included' => bool_to_int((bool)($payload['food_included'] ?? false)),
        ':food_preference' => normalize_food_preference($payload['food_preference'] ?? null),
    ]);

    json_response(['success' => true, 'message' => 'Student profile saved']);
}