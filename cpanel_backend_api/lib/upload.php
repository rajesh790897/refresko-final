<?php

require_once __DIR__ . '/response.php';

function store_payment_proof(string $fieldName = 'screenshot'): array
{
    if (!isset($_FILES[$fieldName]) || !is_array($_FILES[$fieldName])) {
        json_response(['success' => false, 'message' => 'No upload file found'], 422);
    }

    $file = $_FILES[$fieldName];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        json_response(['success' => false, 'message' => 'Upload failed'], 422);
    }

    $config = require __DIR__ . '/../config/env.php';
    $uploadDir = $config['upload_dir'];
    $maxBytes = ((int)($config['max_upload_mb'] ?? 10)) * 1024 * 1024;

    if (($file['size'] ?? 0) > $maxBytes) {
        json_response(['success' => false, 'message' => 'File too large'], 422);
    }

    $mime = mime_content_type($file['tmp_name']);
    $allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($mime, $allowed, true)) {
        json_response(['success' => false, 'message' => 'Only JPG/PNG/WEBP allowed'], 422);
    }

    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
        json_response(['success' => false, 'message' => 'Upload directory not writable'], 500);
    }

    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $safeName = 'proof_' . bin2hex(random_bytes(12)) . ($ext ? '.' . strtolower($ext) : '');
    $target = rtrim($uploadDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $safeName;

    if (!move_uploaded_file($file['tmp_name'], $target)) {
        json_response(['success' => false, 'message' => 'Unable to save file'], 500);
    }

    $relativePath = rtrim($config['base_upload_url'], '/') . '/' . $safeName;

    return [
        'relative_path' => $relativePath,
        'stored_name' => $safeName,
        'original_name' => $file['name'] ?? $safeName,
        'mime' => $mime,
        'size' => $file['size'] ?? 0,
    ];
}
