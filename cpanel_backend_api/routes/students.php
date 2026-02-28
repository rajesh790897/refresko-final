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
    $stmt = $pdo->prepare('SELECT *
                          FROM student_details
                          WHERE UPPER(TRIM(student_code)) = :student_code
                          ORDER BY profile_completed DESC, id DESC
                          LIMIT 1');
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

        $isPaymentSubmitted = true;
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
    $originalStudentCode = strtoupper(trim((string)($payload['original_student_code'] ?? '')));
    $name = trim((string)($payload['name'] ?? ''));

    if ($studentCode === '' || $name === '') {
        json_response(['success' => false, 'message' => 'Invalid student profile payload'], 422);
    }

    $pdo = db();

    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $phone = trim((string)($payload['phone'] ?? ''));
    $department = trim((string)($payload['department'] ?? ''));
    $year = trim((string)($payload['year'] ?? ''));
    $profileCompleted = boolish_to_int($payload['profile_completed'] ?? true);
    $paymentCompletion = boolish_to_int($payload['payment_completion'] ?? false);
    $gatePassCreated = boolish_to_int($payload['gate_pass_created'] ?? false);
    $paymentApproved = normalize_payment_approved_state($payload['payment_approved'] ?? 'pending');
    $foodIncluded = boolish_to_int($payload['food_included'] ?? false);
    $foodPreference = normalize_food_preference($payload['food_preference'] ?? null);

    $lookupCode = $originalStudentCode !== '' ? $originalStudentCode : $studentCode;
    $findExistingStmt = $pdo->prepare('SELECT id FROM student_details WHERE UPPER(TRIM(student_code)) = :student_code LIMIT 1');
    $findExistingStmt->execute([':student_code' => $lookupCode]);
    $existingRow = $findExistingStmt->fetch();

    if (!$existingRow && $email !== '') {
        $findByEmailStmt = $pdo->prepare('SELECT id, student_code
                                          FROM student_details
                                          WHERE LOWER(TRIM(email)) = :email
                                          ORDER BY id DESC
                                          LIMIT 1');
        $findByEmailStmt->execute([':email' => strtolower(trim($email))]);
        $existingByEmail = $findByEmailStmt->fetch();
        if ($existingByEmail) {
            $existingRow = $existingByEmail;
            $lookupCode = strtoupper(trim((string)($existingByEmail['student_code'] ?? $lookupCode)));
        }
    }

    if ($existingRow) {
        $existingStatusStmt = $pdo->prepare('SELECT payment_completion, gate_pass_created, payment_approved, food_included, food_preference
                                             FROM student_details
                                             WHERE UPPER(TRIM(student_code)) = :student_code
                                             ORDER BY gate_pass_created DESC, payment_completion DESC, id DESC
                                             LIMIT 1');
        $existingStatusStmt->execute([':student_code' => $lookupCode]);
        $existingStatus = $existingStatusStmt->fetch();

        if ($existingStatus) {
            $paymentCompletion = boolish_to_int($existingStatus['payment_completion'] ?? 0);
            $gatePassCreated = boolish_to_int($existingStatus['gate_pass_created'] ?? 0);
            $paymentApproved = normalize_payment_approved_state($existingStatus['payment_approved'] ?? 'pending');
            $foodIncluded = boolish_to_int($existingStatus['food_included'] ?? 0);
            $foodPreference = normalize_food_preference($existingStatus['food_preference'] ?? null);
        }

        $updateStmt = $pdo->prepare('UPDATE student_details
                                     SET student_code = :student_code,
                                         name = :name,
                                         email = :email,
                                         phone = :phone,
                                         department = :department,
                                         year = :year,
                                         profile_completed = :profile_completed,
                                         payment_completion = :payment_completion,
                                         gate_pass_created = :gate_pass_created,
                                         payment_approved = :payment_approved,
                                         food_included = :food_included,
                                         food_preference = :food_preference
                                     WHERE UPPER(TRIM(student_code)) = :lookup_student_code');

        $updateStmt->execute([
            ':student_code' => $studentCode,
            ':name' => $name,
            ':email' => $email,
            ':phone' => $phone,
            ':department' => $department,
            ':year' => $year,
            ':profile_completed' => $profileCompleted,
            ':payment_completion' => $paymentCompletion,
            ':gate_pass_created' => $gatePassCreated,
            ':payment_approved' => $paymentApproved,
            ':food_included' => $foodIncluded,
            ':food_preference' => $foodPreference,
            ':lookup_student_code' => $lookupCode,
        ]);
    } else {
        json_response([
            'success' => false,
            'message' => 'Student record not found for update. Profile setup can only update an existing student row.'
        ], 404);
    }

    json_response(['success' => true, 'message' => 'Student profile saved']);
}