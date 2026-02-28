<?php

function normalize_origin(string $origin): string
{
    $origin = trim($origin);
    if ($origin === '') {
        return '';
    }

    $parts = parse_url($origin);
    if (!is_array($parts)) {
        return rtrim($origin, '/');
    }

    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    $host = strtolower((string)($parts['host'] ?? ''));
    $port = isset($parts['port']) ? (int)$parts['port'] : null;

    if ($scheme === '' || $host === '') {
        return rtrim($origin, '/');
    }

    $normalized = $scheme . '://' . $host;
    if ($port !== null) {
        $normalized .= ':' . $port;
    }

    return $normalized;
}

function apply_cors(): void
{
    $config = require __DIR__ . '/../config/env.php';
    $allowed = $config['cors_allowed_origins'] ?? [];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    $normalizedOrigin = normalize_origin($origin);
    $normalizedAllowed = array_values(array_unique(array_filter(array_map(static function ($item) {
        return normalize_origin((string)$item);
    }, is_array($allowed) ? $allowed : []))));

    if ($normalizedOrigin !== '' && in_array($normalizedOrigin, $normalizedAllowed, true)) {
        header("Access-Control-Allow-Origin: {$normalizedOrigin}");
    }

    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-SUPERADMIN-TOKEN');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
