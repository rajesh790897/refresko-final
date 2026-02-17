<?php

function normalize_food_preference($value): ?string
{
    if ($value === null) {
        return null;
    }

    $normalized = strtoupper(trim((string)$value));
    if ($normalized === '' || $normalized === 'NULL') {
        return null;
    }

    if ($normalized === 'VEGETARIAN') {
        return 'VEG';
    }

    if ($normalized === 'NONVEG' || $normalized === 'NON VEGETARIAN') {
        return 'NON-VEG';
    }

    return in_array($normalized, ['VEG', 'NON-VEG'], true) ? $normalized : null;
}

function bool_to_int($value): int
{
    return $value ? 1 : 0;
}

function now_utc(): string
{
    return gmdate('Y-m-d H:i:s');
}
