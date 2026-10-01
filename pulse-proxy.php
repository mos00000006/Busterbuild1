<?php
// BusterBuild read-only catalogue proxy for the public Pulse Tiles WooCommerce Store API.
// Keeps browser requests on the BusterBuild domain and avoids cross-origin browser failures.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

$action = isset($_GET['action']) ? $_GET['action'] : '';
$page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
$base = 'https://pulsetiles.co.za/wp-json/wc/store/v1';

if ($action === 'categories') {
    $url = $base . '/products/categories?per_page=100&page=' . $page;
    $cacheKey = 'categories-' . $page;
} elseif ($action === 'products') {
    $category = isset($_GET['category']) ? intval($_GET['category']) : 0;
    if ($category <= 0) {
        http_response_code(400);
        echo json_encode(array('error' => 'Invalid category'));
        exit;
    }
    $url = $base . '/products?category=' . $category . '&per_page=100&page=' . $page . '&orderby=title&order=asc';
    $cacheKey = 'products-' . $category . '-' . $page;
} else {
    http_response_code(400);
    echo json_encode(array('error' => 'Invalid action'));
    exit;
}

$cacheDir = __DIR__ . DIRECTORY_SEPARATOR . 'cache';
if (!is_dir($cacheDir)) { @mkdir($cacheDir, 0755, true); }
$cacheFile = $cacheDir . DIRECTORY_SEPARATOR . preg_replace('/[^a-zA-Z0-9\-]/', '', $cacheKey) . '.json';
$cacheTtl = 1800; // 30 minutes
if (is_file($cacheFile) && (time() - filemtime($cacheFile) < $cacheTtl)) {
    readfile($cacheFile);
    exit;
}

$body = false;
$status = 0;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, array(
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_USERAGENT => 'BusterBuild-Catalogue/1.0',
        CURLOPT_HTTPHEADER => array('Accept: application/json')
    ));
    $body = curl_exec($ch);
    $status = intval(curl_getinfo($ch, CURLINFO_HTTP_CODE));
    curl_close($ch);
} else {
    $context = stream_context_create(array('http' => array(
        'method' => 'GET', 'timeout' => 20,
        'header' => "Accept: application/json\r\nUser-Agent: BusterBuild-Catalogue/1.0\r\n"
    )));
    $body = @file_get_contents($url, false, $context);
    $status = $body === false ? 0 : 200;
}

if ($body !== false && $status >= 200 && $status < 300) {
    @file_put_contents($cacheFile, $body, LOCK_EX);
    echo $body;
    exit;
}

// If Pulse is temporarily unavailable, use the most recent cached response when possible.
if (is_file($cacheFile)) {
    header('X-BusterBuild-Cache: stale');
    readfile($cacheFile);
    exit;
}

http_response_code(502);
echo json_encode(array('error' => 'Catalogue source unavailable', 'status' => $status));
