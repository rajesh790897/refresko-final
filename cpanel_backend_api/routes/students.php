<?php

function boolish_to_int($value): int
{
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }

    if (is_int($value) || is_float($value)) {
        return ((int)$value) === 1 ? 1 : 0;
    }

    $normalized = strtolower(trim((string)$value));
    if (in_array($normalized, ['1', 'true', 'yes', 'y', 'on'], true)) {
        return 1;
    }

    if (in_array($normalized, ['0', 'false', 'no', 'n', 'off', 'null', ''], true)) {
        return 0;
    }

    return 0;
}

function normalize_payment_approved_state($value): string
{
    $normalized = strtolower(trim((string)$value));
    if (in_array($normalized, ['approved', 'declined', 'pending'], true)) {
        return $normalized;
    }
    return 'pending';
}

function students_get_one(): void
{
    $studentCode = strtoupper(trim((string)($_GET['student_code'] ?? '')));
    if ($studentCode === '') {
        json_response(['success' => false, 'message' => 'student_code is required'], 422);
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM student_details WHERE student_code = :student_code LIMIT 1');
    $stmt->execute([':student_code' => $studentCode]);
    $student = $stmt->fetch();

    if (!$student) {
        json_response(['success' => false, 'message' => 'Student not found'], 404);
    }

    $student['profile_completed'] = boolish_to_int($student['profile_completed'] ?? 0);
    $student['payment_completion'] = boolish_to_int($student['payment_completion'] ?? 0);
    $student['gate_pass_created'] = boolish_to_int($student['gate_pass_created'] ?? 0);
    $student['food_included'] = boolish_to_int($student['food_included'] ?? 0);
    $student['payment_approved'] = normalize_payment_approved_state($student['payment_approved'] ?? 'pending');

    $latestPaymentStmt = $pdo->prepare('SELECT status, payment_approved
                                        FROM payments
                                        WHERE student_code = :student_code
                                        ORDER BY id DESC
                                        LIMIT 1');
    $latestPaymentStmt->execute([':student_code' => $studentCode]);
    $latestPayment = $latestPaymentStmt->fetch();

    if ($latestPayment) {
        $approvedState = normalize_payment_approved_state($latestPayment['payment_approved'] ?? 'pending');

        $statusState = strtolower(trim((string)($latestPayment['status'] ?? 'pending')));
        $isPaymentSubmitted = $statusState === 'pending' || $statusState === 'completed' || $approvedState === 'approved';
        $isGatePassReady = $approvedState === 'approved';

        $student['payment_completion'] = $isPaymentSubmitted ? 1 : 0;
        $student['gate_pass_created'] = $isGatePassReady ? 1 : 0;
        $student['payment_approved'] = $approvedState;
    } else {
        $student['payment_completion'] = 0;
        $student['gate_pass_created'] = 0;
        $student['payment_approved'] = 'pending';
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

    $sql = 'INSERT INTO student_details (
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
        ':profile_completed' => boolish_to_int($payload['profile_completed'] ?? true),
        ':payment_completion' => boolish_to_int($payload['payment_completion'] ?? false),
        ':gate_pass_created' => boolish_to_int($payload['gate_pass_created'] ?? false),
        ':payment_approved' => normalize_payment_approved_state($payload['payment_approved'] ?? 'pending'),
        ':food_included' => boolish_to_int($payload['food_included'] ?? false),
        ':food_preference' => normalize_food_preference($payload['food_preference'] ?? null),
    ]);

    json_response(['success' => true, 'message' => 'Student profile saved']);
}