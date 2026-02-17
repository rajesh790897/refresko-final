<?php

function apply_cors(): void
{
    $config = require __DIR__ . '/../config/env.php';
    $allowed = $config['cors_allowed_origins'] ?? [];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array($origin, $allowed, true)) {
        header("Access-Control-Allow-Origin: {$origin}");
    }

    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
