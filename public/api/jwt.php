<?php
// ==============================================================================
// LIGHTWEIGHT JWT UTILITIES (HMAC-SHA256)
// Zero External Dependencies - Hostinger PHP Compatible
// ==============================================================================

require_once __DIR__ . '/config.php';

class JWT {
    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function encode(array $payload, string $secret = JWT_SECRET, int $expirySeconds = JWT_EXPIRY_SECONDS): string {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload['iat'] = time();
        $payload['exp'] = time() + $expirySeconds;
        $encodedPayload = json_encode($payload);

        $base64Header = self::base64UrlEncode($header);
        $base64Payload = self::base64UrlEncode($encodedPayload);

        $signature = hash_hmac('sha256', "$base64Header.$base64Payload", $secret, true);
        $base64Signature = self::base64UrlEncode($signature);

        return "$base64Header.$base64Payload.$base64Signature";
    }

    public static function decode(string $token, string $secret = JWT_SECRET): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        list($base64Header, $base64Payload, $base64Signature) = $parts;

        $expectedSig = hash_hmac('sha256', "$base64Header.$base64Payload", $secret, true);
        $providedSig = self::base64UrlDecode($base64Signature);

        if (!hash_equals($expectedSig, $providedSig)) {
            return null; // Signature verification failed
        }

        $payload = json_decode(self::base64UrlDecode($base64Payload), true);
        if (!is_array($payload)) {
            return null;
        }

        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null; // Token expired
        }

        return $payload;
    }
}
