<?php

return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'skfedbzl_refresko_prod',
        'user' => 'skfedbzl_refapi_api',
        'pass' => 'refresko26',
        'charset' => 'utf8mb4',
    ],

    'supabase' => [
        'url' => getenv('SUPABASE_URL') ?: '',
        'service_key' => getenv('SUPABASE_SERVICE_ROLE_KEY') ?: '',
        'anon_key' => getenv('SUPABASE_ANON_KEY') ?: '',
    ],

    'cors_allowed_origins' => [
        'https://refresko.skf.edu.in',
        'https://api-refresko.skf.edu.in',
        'http://localhost:5173',
    ],
    'max_upload_mb' => 10,
    'upload_dir' => __DIR__ . '/../uploads/payment-proofs',
    'base_upload_url' => '/uploads/payment-proofs',
];
